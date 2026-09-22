import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresetRange } from "@/lib/format/dateRanges";

export interface TodaySales {
    total: number;
    count: number;
}

export interface PendingOrder {
    id: string;
    orderNumber: number;
    customerName: string;
    total: number;
    status: "pedidos" | "en_proceso";
    createdAt: string;
}

export interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
    minStock: number;
}

export async function getTodaySales(client: SupabaseClient): Promise<TodaySales> {
    const { from, to } = getPresetRange("hoy");

    const { data, error } = await client
        .from("sales")
        .select("total")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

    if (error || !data) return { total: 0, count: 0 };

    return {
        total: data.reduce((sum, s) => sum + s.total, 0),
        count: data.length,
    };
}

/**
 * Todos los pedidos que todavía no llegaron a "finalizado" (punto 6
 * del brief: "pedidos que todavía no fueron finalizados"). `limit`
 * corta la lista que se muestra en pantalla, pero el conteo total
 * siempre refleja el número real, aunque la lista esté acotada.
 */
export async function getPendingOrders(
    client: SupabaseClient,
    limit = 5
    ): Promise<{ orders: PendingOrder[]; count: number }> {
    const { data, error, count } = await client
        .from("orders")
        .select("id, order_number, customer_name, status, total, created_at", { count: "exact" })
        .in("status", ["pedidos", "en_proceso"])
        .order("created_at", { ascending: true })
        .limit(limit);

    if (error || !data) return { orders: [], count: 0 };

    const orders: PendingOrder[] = data.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        total: o.total,
        status: o.status,
        createdAt: o.created_at,
    }));

    return { orders, count: count ?? orders.length };
}

export async function getLowStockProducts(client: SupabaseClient): Promise<LowStockProduct[]> {
    const { data, error } = await client
        .from("products")
        .select("id, name, stock, min_stock")
        .eq("active", true)
        .order("stock", { ascending: true });

    if (error || !data) return [];

    // El filtro "stock <= min_stock" se hace acá porque comparar dos
    // columnas entre sí no es directo con el query builder de
    // supabase-js (necesitaría un rpc/filter crudo); con la cantidad de
    // productos de una hamburguesería esto es liviano de sobra.
    return data
        .filter((p) => p.stock <= p.min_stock)
        .map((p) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.min_stock }));
}