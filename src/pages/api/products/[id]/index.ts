import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { productUpdateSchema } from "@/lib/validators/productSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const productId = params.id!;
    const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const supabase = createSupabaseServerClient(cookies);

    const updates: Record<string, unknown> = {};
    if (input.categoryId !== undefined) updates.category_id = input.categoryId;
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = input.slug;
    if (input.description !== undefined) updates.description = input.description;
    if (input.price !== undefined) updates.price = input.price;
    if (input.imageUrl !== undefined) updates.image_url = input.imageUrl;
    if (input.stock !== undefined) updates.stock = input.stock;
    if (input.minStock !== undefined) updates.min_stock = input.minStock;
    if (input.active !== undefined) updates.active = input.active;

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("products").update(updates).eq("id", productId);
        if (error) {
        console.error("Error actualizando producto:", error.message);
        return json({ error: "No se pudo actualizar el producto" }, 500);
        }
    }

    if (input.ingredients !== undefined) {
        await supabase.from("product_ingredients").delete().eq("product_id", productId);
        if (input.ingredients.length > 0) {
        const rows = input.ingredients.map((i) => ({
            product_id: productId,
            ingredient_id: i.ingredientId,
            is_included: i.isIncluded,
            is_removable: i.isRemovable,
            is_addable_extra: i.isAddableExtra,
            price_override: i.priceOverride ?? null,
        }));
        const { error: linkError } = await supabase.from("product_ingredients").insert(rows);
        if (linkError) console.error("Error re-vinculando ingredientes:", linkError.message);
        }
    }

    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}