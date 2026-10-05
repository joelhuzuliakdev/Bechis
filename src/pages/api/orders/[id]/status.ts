import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canTransition, timestampColumnFor, type OrderStatus } from "@/lib/orders/orderStatus";
import { fetchOrderById } from "@/lib/orders/fetchOrders";
import { notifyOrderStatus } from "@/lib/whatsapp/notifyOrderStatus";

const ALL_STATUSES = [
  "pedidos",
  "confirmado",
  "en_proceso",
  "listo_para_retirar",
  "finalizado",
  "cancelado",
] as const;

const bodySchema = z.object({
  status: z.enum(ALL_STATUSES),
  reason: z.string().trim().min(1).max(300).optional(),
  // Solo se usa al cancelar un pedido que ya descontó stock desde "en proceso".
  stockAction: z.enum(["reponer", "merma"]).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function formatQty(n: number, unit: string): string {
  const num = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return unit === "unidad" ? num : `${num} ${unit}`;
}

// Traduce el resultado de las funciones de stock (jsonb) a una respuesta HTTP.
function stockFailure(result: any): Response {
  switch (result?.code) {
    case "not_found":
      return json({ error: "Pedido no encontrado" }, 404);
    case "insufficient_stock": {
      const missing: any[] = result.missing ?? [];
      const detail = missing
        .map((m) => `${m.name} (necesita ${formatQty(m.required, m.unit)}, hay ${formatQty(m.available, m.unit)})`)
        .join(", ");
      return json(
        { error: `No hay stock suficiente para confirmar el pedido: ${detail}`, code: "insufficient_stock", missing },
        409
      );
    }
    case "stock_decision_required":
      return json(
        { error: "Este pedido ya descontó stock: elegí si se repone o se registra como merma.", code: "stock_decision_required" },
        409
      );
    case "invalid_status":
    case "already_deducted":
      return json({ error: "El pedido ya cambió de estado. Actualizá el tablero.", code: result.code }, 409);
    default:
      return json({ error: "No se pudo actualizar el pedido" }, 500);
  }
}

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const id = params.id;
  if (!id) {
    return json({ error: "Falta el id" }, 400);
  }

  const profile = await getSessionProfile(cookies);
  if (!profile || !profile.active) {
    return json({ error: "No autorizado" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  }

  const nextStatus = parsed.data.status as OrderStatus;
  const supabase = createSupabaseServerClient(cookies);

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return json({ error: "Pedido no encontrado" }, 404);
  }

  const currentStatus = current.status as OrderStatus;

  if (!canTransition(currentStatus, nextStatus)) {
    return json({ error: `No se puede pasar de "${currentStatus}" a "${nextStatus}"` }, 400);
  }

  if (nextStatus === "confirmado") {
    // Confirmar + descontar stock: una sola transacción en la base.
    // Si falta stock no cambia nada y se informa qué falta.
    const admin = createSupabaseAdminClient();
    const { data: result, error: rpcError } = await admin.rpc("confirm_order_with_stock", {
      p_order_id: id,
      p_user_id: profile.id,
    });
    if (rpcError) {
      console.error("Error en confirm_order_with_stock:", rpcError.message);
      return json({ error: "No se pudo confirmar el pedido" }, 500);
    }
    if (!result?.ok) return stockFailure(result);
  } else if (nextStatus === "cancelado") {
    // Desde "en proceso" en adelante solo un admin puede cancelar.
    if ((currentStatus === "en_proceso" || currentStatus === "listo_para_retirar") && profile.role !== "admin") {
      return json({ error: "Solo un administrador puede cancelar un pedido que ya está en proceso." }, 403);
    }

    const admin = createSupabaseAdminClient();
    const { data: result, error: rpcError } = await admin.rpc("cancel_order_with_stock", {
      p_order_id: id,
      p_user_id: profile.id,
      p_reason: parsed.data.reason ?? null,
      p_stock_action: parsed.data.stockAction ?? null,
    });
    if (rpcError) {
      console.error("Error en cancel_order_with_stock:", rpcError.message);
      return json({ error: "No se pudo cancelar el pedido" }, 500);
    }
    if (!result?.ok) return stockFailure(result);
  } else {
    // En proceso / Listo / Finalizado: no tocan stock, igual que antes.
    const update: Record<string, unknown> = { status: nextStatus };

    const timestampColumn = timestampColumnFor(nextStatus);
    if (timestampColumn) {
      update[timestampColumn] = new Date().toISOString();
    }

    const { error: updateError } = await supabase.from("orders").update(update).eq("id", id);

    if (updateError) {
      console.error("Error actualizando estado del pedido:", updateError.message);
      return json({ error: "No se pudo actualizar el pedido" }, 500);
    }
  }

  // El pedido ya quedó actualizado en este punto. Si el WhatsApp falla,
  // no revertimos el cambio de estado — solo queda registrado el error
  // en order_notifications (ver notifyOrderStatus).
  try {
    const updatedOrder = await fetchOrderById(supabase, id);
    if (updatedOrder) {
      await notifyOrderStatus(supabase, updatedOrder, nextStatus);
    }
  } catch (notifyError) {
    console.error("Error enviando notificación de WhatsApp:", notifyError);
  }

  return json({ ok: true, status: nextStatus });
};