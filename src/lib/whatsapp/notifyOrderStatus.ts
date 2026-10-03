import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderCardData } from "@/lib/orders/fetchOrders";
import type { OrderStatus } from "@/lib/orders/orderStatus";
import { normalizePhoneAR } from "@/lib/whatsapp/phone";
import { sendTemplateMessage } from "@/lib/whatsapp/client";

// Solo estos 3 cambios de estado disparan WhatsApp. "pedidos" (recién
// creado) y "cancelado" no mandan nada por ahora.
const NOTIFIABLE_STATUSES: OrderStatus[] = ["confirmado", "en_proceso", "listo_para_retirar"];

const LANGUAGE_CODE = "es_AR";

function templateFor(status: OrderStatus, deliveryType: string): string | null {
    switch (status) {
        case "confirmado":
        return "pedido_confirmado";
        case "en_proceso":
        return "pedido_en_proceso";
        case "listo_para_retirar":
        return deliveryType === "envio" ? "pedido_listo_envio" : "pedido_listo_retiro";
        default:
        return null;
    }
}

// Manda (a lo sumo una vez por pedido+evento) el WhatsApp correspondiente
// al nuevo estado. Nunca lanza — si algo falla, lo deja registrado en
// `order_notifications` y listo; el cambio de estado del pedido ya se
// guardó antes de llamar a esto y no debe revertirse por un error de
// WhatsApp.
export async function notifyOrderStatus(
    supabase: SupabaseClient,
    order: OrderCardData,
    status: OrderStatus
    ): Promise<void> {
    if (!NOTIFIABLE_STATUSES.includes(status)) return;

    const templateName = templateFor(status, order.deliveryType);
    if (!templateName) return;

    const event = status; // event = el propio estado, matchea el enum

    // Reserva idempotente: si ya existe una fila para (order_id, event),
    // el índice único la rechaza y no mandamos el mensaje de nuevo.
    const { error: insertError } = await supabase.from("order_notifications").insert({
        order_id: order.id,
        event,
        channel: "whatsapp",
        status: "pendiente",
    });

    if (insertError) {
        // 23505 = unique_violation -> ya se había mandado este evento antes.
        if (insertError.code !== "23505") {
        console.error(`notifyOrderStatus: no se pudo reservar notificación (${event}):`, insertError.message);
        }
        return;
    }

    const phone = normalizePhoneAR(order.customerPhone);
    if (!phone) {
        await supabase
        .from("order_notifications")
        .update({ status: "error", error_message: `Teléfono inválido: "${order.customerPhone}"` })
        .eq("order_id", order.id)
        .eq("event", event);
        console.error(`notifyOrderStatus: teléfono inválido para pedido #${order.orderNumber}: "${order.customerPhone}"`);
        return;
    }

    const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;

    const result = await sendTemplateMessage(phone, templateName, LANGUAGE_CODE, [
        { type: "text", text: firstName },
        { type: "text", text: order.orderNumber },
    ]);

    if (result.ok) {
        await supabase
        .from("order_notifications")
        .update({ status: "enviado", sent_at: new Date().toISOString() })
        .eq("order_id", order.id)
        .eq("event", event);
    } else {
        await supabase
        .from("order_notifications")
        .update({ status: "error", error_message: result.error ?? "Error desconocido" })
        .eq("order_id", order.id)
        .eq("event", event);
        console.error(`notifyOrderStatus: fallo enviando WhatsApp (${event}) a pedido #${order.orderNumber}:`, result.error);
    }
}