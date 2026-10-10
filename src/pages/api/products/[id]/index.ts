import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { productUpdateSchema } from "@/lib/validators/productSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

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
    if (input.minStock !== undefined) updates.min_stock = input.minStock;
    if (input.trackStock !== undefined) updates.track_stock = input.trackStock;
    if (input.active !== undefined) updates.active = input.active;
    // El stock NO se cambia desde acá: se mueve desde la pantalla Stock (con historial).

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("products").update(updates).eq("id", productId);
        if (error) {
        console.error("Error actualizando producto:", error.message);
        return json({ error: "No se pudo actualizar el producto" }, 500);
        }
    }

    if (input.ingredients !== undefined) {
        // Se reemplaza la lista de ingredientes. Antes de borrar se guarda una copia:
        // si la carga nueva falla, se restaura la anterior, para no perder nunca las
        // recetas (cantidades que consume cada producto) por un error a mitad de camino.
        const { data: previous, error: snapshotError } = await supabase
            .from("product_ingredients")
            .select("*")
            .eq("product_id", productId);
        if (snapshotError) {
            console.error("Error leyendo ingredientes actuales:", snapshotError.message);
            return json({ error: "No se pudieron guardar los ingredientes" }, 500);
        }

        const { error: deleteError } = await supabase.from("product_ingredients").delete().eq("product_id", productId);
        if (deleteError) {
            console.error("Error limpiando ingredientes:", deleteError.message);
            return json({ error: "No se pudieron guardar los ingredientes" }, 500);
        }

        if (input.ingredients.length > 0) {
            const rows = input.ingredients.map((i) => ({
                product_id: productId,
                ingredient_id: i.ingredientId,
                is_included: i.isIncluded,
                is_removable: i.isRemovable,
                is_addable_extra: i.isAddableExtra,
                price_override: i.priceOverride ?? null,
                quantity_per_unit: i.quantityPerUnit ?? null,
            }));
            const { error: linkError } = await supabase.from("product_ingredients").insert(rows);
            if (linkError) {
                console.error("Error re-vinculando ingredientes:", linkError.message);
                if (previous && previous.length > 0) {
                    const { error: restoreError } = await supabase.from("product_ingredients").insert(previous);
                    if (restoreError) console.error("Error restaurando ingredientes:", restoreError.message);
                }
                return json({ error: "No se pudieron guardar los ingredientes. Se mantuvieron los anteriores." }, 500);
            }
        }
    }

    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}