import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { productSchema } from "@/lib/validators/productSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos", details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    // Cliente autenticado normal: products_staff_write ya permite crear
    // a cualquier staff, y products_public_read deja que el staff se
    // lea a sí mismo el producto recién creado (a diferencia de orders,
    // acá no hace falta el cliente admin).
    const supabase = createSupabaseServerClient(cookies);

    const { data: product, error } = await supabase
        .from("products")
        .insert({
        category_id: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        price: input.price,
        image_url: input.imageUrl ?? null,
        stock: input.stock,
        min_stock: input.minStock,
        active: input.active,
        })
        .select("id")
        .single();

    if (error || !product) {
        console.error("Error creando producto:", error?.message);
        const message = error?.message.includes("duplicate") ? "Ya existe un producto con ese slug" : "No se pudo crear el producto";
        return json({ error: message }, 500);
    }

    if (input.ingredients.length > 0) {
        const rows = input.ingredients.map((i) => ({
        product_id: product.id,
        ingredient_id: i.ingredientId,
        is_included: i.isIncluded,
        is_removable: i.isRemovable,
        is_addable_extra: i.isAddableExtra,
        price_override: i.priceOverride ?? null,
        }));
        const { error: linkError } = await supabase.from("product_ingredients").insert(rows);
        if (linkError) console.error("Error vinculando ingredientes:", linkError.message);
    }

    return json({ id: product.id });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}