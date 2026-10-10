import type { APIRoute } from "astro";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { productSchema } from "@/lib/validators/productSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

    const parsed = productSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos", details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    // Cliente autenticado normal: products_staff_write ya permite crear
    // a cualquier staff, y products_public_read deja que el staff se
    // lea a sí mismo el producto recién creado (a diferencia de orders,
    // acá no hace falta el cliente admin).
    const supabase = createSupabaseServerClient(cookies);

    // Se crea con stock 0: el stock inicial entra como un movimiento (queda en el historial).
    const { data: product, error } = await supabase
        .from("products")
        .insert({
        category_id: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        price: input.price,
        image_url: input.imageUrl ?? null,
        stock: 0,
        min_stock: input.minStock,
        track_stock: input.trackStock,
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
        quantity_per_unit: i.quantityPerUnit ?? null,
        }));
        const { error: linkError } = await supabase.from("product_ingredients").insert(rows);
        if (linkError) {
            console.error("Error vinculando ingredientes:", linkError.message);
            return json(
                {
                    id: product.id,
                    error: "El producto se creó, pero no se pudieron guardar sus ingredientes. Abrilo desde Productos y guardalo de nuevo.",
                },
                500
            );
        }
    }

    if (input.trackStock && input.stock > 0) {
        const admin = createSupabaseAdminClient();
        const { data: movement, error: movementError } = await admin.rpc("apply_stock_movement", {
            p_target: "producto",
            p_item_id: product.id,
            p_type: "ingreso",
            p_quantity: input.stock,
            p_reason: "Stock inicial",
            p_user_id: auth.profile.id,
        });
        const result = movement as { ok?: boolean } | null;
        if (movementError || !result?.ok) {
            console.error("Error cargando stock inicial del producto:", movementError?.message ?? result);
            return json(
                {
                    id: product.id,
                    error: "El producto se creó, pero no se pudo cargar el stock inicial. Cargalo desde la pantalla Stock.",
                },
                500
            );
        }
    }

    return json({ id: product.id });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}