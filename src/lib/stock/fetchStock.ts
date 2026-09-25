import type { SupabaseClient } from "@supabase/supabase-js";

export interface StockItem {
    id: string;
    name: string;
    stock: number;
    minStock: number;
}

export interface StockMovementRow {
    id: string;
    target: "producto" | "ingrediente";
    itemName: string;
    type: "ingreso" | "egreso" | "correccion" | "venta";
    quantity: number;
    reason: string | null;
    userName: string | null;
    createdAt: string;
}

export async function listProductStock(client: SupabaseClient): Promise<StockItem[]> {
    const { data, error } = await client
        .from("products")
        .select("id, name, stock, min_stock")
        .eq("active", true)
        .order("name");

    if (error || !data) return [];
    return data.map((p) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.min_stock }));
}

export async function listIngredientStock(client: SupabaseClient): Promise<StockItem[]> {
    const { data, error } = await client
        .from("ingredients")
        .select("id, name, stock, min_stock")
        .eq("active", true)
        .order("name");

    if (error || !data) return [];
    return data.map((i) => ({ id: i.id, name: i.name, stock: i.stock, minStock: i.min_stock }));
}

export async function fetchStockMovements(
    client: SupabaseClient,
    from: Date,
    to: Date,
    limit = 100
    ): Promise<StockMovementRow[]> {
    const { data, error } = await client
        .from("stock_movements")
        .select(
        `
        id, target, type, quantity, reason, created_at,
        products ( name ),
        ingredients ( name ),
        profiles ( full_name )
        `
        )
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) {
        if (error) console.error("Error cargando movimientos de stock:", error.message);
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        target: m.target,
        itemName: m.target === "producto" ? m.products?.name ?? "—" : m.ingredients?.name ?? "—",
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        userName: m.profiles?.full_name ?? null,
        createdAt: m.created_at,
    }));
}