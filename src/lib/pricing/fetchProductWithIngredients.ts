// Usado por producto/[id].astro (mostrar el personalizador) y por
// api/orders/create.ts (recalcular el precio real de cada línea del
// pedido antes de guardarlo). Centralizar esto evita que las dos
// partes del sistema puedan quedar "desincronizadas" sobre qué
// significa is_included / is_removable / is_addable_extra.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductWithIngredients } from "@/types";

export async function fetchProductWithIngredients(
    client: SupabaseClient,
    productId: string
    ): Promise<ProductWithIngredients | null> {
    const { data, error } = await client
        .from("products")
        .select(
        `
        id, category_id, name, slug, description, price, image_url, stock, min_stock, active,
        product_ingredients (
            ingredient_id, is_included, is_removable, is_addable_extra, price_override,
            ingredients ( name, extra_price )
        )
        `
        )
        .eq("id", productId)
        .eq("active", true)
        .maybeSingle();

    if (error || !data) return null;

    const raw = data as any;

    return {
        id: raw.id,
        category_id: raw.category_id,
        name: raw.name,
        slug: raw.slug,
        description: raw.description,
        price: raw.price,
        image_url: raw.image_url,
        stock: raw.stock,
        min_stock: raw.min_stock,
        active: raw.active,
        ingredients: (raw.product_ingredients ?? []).map((pi: any) => ({
        ingredient_id: pi.ingredient_id,
        ingredient_name: pi.ingredients?.name ?? "",
        is_included: pi.is_included,
        is_removable: pi.is_removable,
        is_addable_extra: pi.is_addable_extra,
        extra_price: pi.price_override ?? pi.ingredients?.extra_price ?? 0,
        })),
    };
}