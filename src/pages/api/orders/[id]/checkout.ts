// POST /api/orders/[id]/checkout
//
// Esto es el punto 16 del brief: "Cobrar / Pasar a venta". A partir de
// acá, un pedido finalizado se convierte en una venta real, que
// impacta Caja (si hay una abierta). El Stock se descuenta al CONFIRMAR el pedido.
//
// Usamos el cliente ADMIN para las escrituras, no porque cualquiera
// pueda llamar esto (primero se valida que quien llama esté logueado
// y sea staff), sino porque esta acción toca `cash_register`, que por
// diseño de RLS es de acceso exclusivo para admin — pero "Cobrar" es
// una acción que también puede hacer un EMPLEADO (punto 16 del brief).
// El servidor actúa acá como intermediario de confianza: valida quién
// sos vos, y después hace, en tu nombre, lo que tu rol necesita para
// completar la acción.

import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const bodySchema = z.object({
    paymentMethod: z.enum(["efectivo", "transferencia", "qr", "debito", "credito"]),
    receivedAmount: z.number().nonnegative().optional(),
    discount: z.number().nonnegative().default(0),
});

export const POST: APIRoute = async ({ params, request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) {
        return json({ error: "No autorizado" }, 401);
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return json({ error: "Datos inválidos" }, 400);
    }
    const { paymentMethod, receivedAmount, discount } = parsed.data;

    const admin = createSupabaseAdminClient();
    const orderId = params.id!;

    // 1. Traer el pedido con sus items.
    const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id, order_number, customer_name, subtotal, total, status, payment_status, stock_deducted_at, order_items ( id, product_id, quantity, unit_price, subtotal )")
        .eq("id", orderId)
        .maybeSingle();

    if (orderError || !order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.status !== "finalizado") return json({ error: "El pedido todavía no está Finalizado" }, 400);
    if (order.payment_status === "cobrado") return json({ error: "Este pedido ya fue cobrado" }, 400);

    // Red de seguridad: un pedido Finalizado debería haber descontado stock
    // al confirmarse. Si no lo hizo (pedido anterior a este cambio), no se
    // frena el cobro, pero queda el aviso en el log.
    if (!order.stock_deducted_at) {
        console.warn(`Cobro del pedido #${order.order_number} sin descuento de stock registrado.`);
    }

    const finalTotal = Math.max(0, order.total - discount);
    const changeAmount =
        paymentMethod === "efectivo" && receivedAmount !== undefined ? receivedAmount - finalTotal : null;

    // 2. ¿Hay una caja abierta? Si no la hay, igual dejamos cobrar (para
    // no trabar el flujo mientras el módulo de Caja no está terminado),
    // pero la venta queda sin caja asociada.
    const { data: openCash } = await admin
        .from("cash_register")
        .select("id")
        .eq("status", "abierta")
        .maybeSingle();

    // 3. Registrar el pago.
    const { error: paymentError } = await admin.from("payments").insert({
        order_id: order.id,
        method: paymentMethod,
        amount: finalTotal,
        received_amount: receivedAmount ?? null,
        change_amount: changeAmount,
        created_by: profile.id,
    });
    if (paymentError) console.error("Error creando payment:", paymentError.message);

    // 4. Crear la venta.
    const { data: sale, error: saleError } = await admin
        .from("sales")
        .insert({
        order_id: order.id,
        customer_name: order.customer_name,
        subtotal: order.subtotal,
        discount,
        total: finalTotal,
        payment_method: paymentMethod,
        employee_id: profile.id,
        cash_register_id: openCash?.id ?? null,
        })
        .select("id, sale_number")
        .single();

    if (saleError || !sale) {
        console.error("Error creando venta:", saleError?.message);
        return json({ error: "No se pudo registrar la venta" }, 500);
    }

    // 5. Copiar los items del pedido a la venta.
    // OJO: acá YA NO se descuenta stock. El stock se descuenta una única
    // vez cuando el pedido pasa a "Confirmado" (confirm_order_with_stock).
    // Descontar de nuevo al cobrar duplicaría el descuento.
    for (const item of order.order_items) {
        await admin.from("sale_items").insert({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        });
    }

    // 6. Marcar el pedido como cobrado.
    await admin.from("orders").update({ payment_status: "cobrado" }).eq("id", order.id);

    return json({ saleId: sale.id, saleNumber: sale.sale_number, total: finalTotal });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}