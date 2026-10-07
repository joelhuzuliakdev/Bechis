import type { SupabaseClient } from "@supabase/supabase-js";

export interface TicketItem {
    quantity: number;
    name: string;
    unitPrice: number;
    lineTotal: number;
    added: string[];
    removed: string[];
}

export interface TicketData {
    saleNumber: number | string;
    orderNumber: number | string | null;
    createdAt: string;
    customerName: string;
    deliveryType: string | null;
    deliveryZoneName: string | null;
    address: string | null;
    items: TicketItem[];
    subtotal: number;
    deliveryCost: number;
    discount: number;
    total: number;
    paymentMethod: string;
    receivedAmount: number | null;
    changeAmount: number | null;
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// Arma todo lo que lleva el ticket de una venta. Se usa con el cliente ADMIN,
// después de validar que quien pide el ticket es personal del local.
export async function fetchTicketData(admin: SupabaseClient, saleId: string): Promise<TicketData | null> {
    const { data: sale, error: saleError } = await admin
        .from("sales")
        .select("id, sale_number, order_id, customer_name, subtotal, discount, total, payment_method, created_at")
        .eq("id", saleId)
        .maybeSingle();

    if (saleError) console.error("fetchTicketData sale error:", saleError.message);
    if (!sale) return null;

    let order: any = null;
    let payment: any = null;

    if (sale.order_id) {
        const [orderRes, paymentRes] = await Promise.all([
            admin
                .from("orders")
                .select(
                    `order_number, delivery_type, address, subtotal, discount, delivery_cost,
                     delivery_zones ( name ),
                     order_items (
                       quantity, unit_price, subtotal,
                       products ( name ),
                       order_item_ingredients ( action, ingredients ( name ) )
                     )`
                )
                .eq("id", sale.order_id)
                .maybeSingle(),
            admin
                .from("payments")
                .select("received_amount, change_amount")
                .eq("order_id", sale.order_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);
        order = orderRes.data;
        payment = paymentRes.data;
    }

    let items: TicketItem[] = [];
    if (order?.order_items?.length) {
        items = order.order_items.map((it: any) => {
            const ings = it.order_item_ingredients ?? [];
            return {
                quantity: num(it.quantity),
                name: it.products?.name ?? "Producto",
                unitPrice: num(it.unit_price),
                lineTotal: num(it.subtotal),
                added: ings.filter((i: any) => i.action === "agregado").map((i: any) => i.ingredients?.name ?? "Ingrediente"),
                removed: ings.filter((i: any) => i.action === "quitado").map((i: any) => i.ingredients?.name ?? "Ingrediente"),
            };
        });
    } else {
        // Venta sin pedido asociado: se imprime lo que quedó en sale_items.
        const { data: saleItems } = await admin
            .from("sale_items")
            .select("quantity, unit_price, subtotal, products ( name )")
            .eq("sale_id", sale.id);
        items = (saleItems ?? []).map((it: any) => ({
            quantity: num(it.quantity),
            name: it.products?.name ?? "Producto",
            unitPrice: num(it.unit_price),
            lineTotal: num(it.subtotal),
            added: [],
            removed: [],
        }));
    }

    return {
        saleNumber: sale.sale_number,
        orderNumber: order?.order_number ?? null,
        createdAt: sale.created_at,
        customerName: sale.customer_name ?? "",
        deliveryType: order?.delivery_type ?? null,
        deliveryZoneName: order?.delivery_zones?.name ?? null,
        address: order?.address ?? null,
        items,
        subtotal: num(sale.subtotal),
        deliveryCost: num(order?.delivery_cost),
        // Descuento del pedido (hoy 0) + el que se aplicó al cobrar.
        discount: num(order?.discount) + num(sale.discount),
        total: num(sale.total),
        paymentMethod: String(sale.payment_method ?? ""),
        receivedAmount: numOrNull(payment?.received_amount),
        changeAmount: numOrNull(payment?.change_amount),
    };
}