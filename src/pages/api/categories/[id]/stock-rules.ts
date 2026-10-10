import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

// Regla de consumo por categoría: "cada unidad de un producto de esta categoría
// consume X de este ingrediente" (ej. 300 g de papas). Reemplaza la lista completa
// de reglas de la categoría. Solo admin.
const bodySchema = z.object({
    rules: z
        .array(
            z.object({
                ingredientId: z.string().uuid(),
                quantityPerUnit: z.number().finite().positive(),
            })
        )
        .max(30),
});

export const PUT: APIRoute = async ({ params, request, cookies }) => {
    const auth = await requireRole(cookies, ["admin"]);
    if (!auth.ok) return auth.response;

    const categoryId = params.id!;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const { rules } = parsed.data;

    const ids = rules.map((r) => r.ingredientId);
    if (new Set(ids).size !== ids.length) return json({ error: "Hay un ingrediente repetido." }, 400);

    const admin = createSupabaseAdminClient();

    // Primero se guardan/actualizan las reglas y después se borran las que ya no
    // están: si algo falla a la mitad, nunca queda la categoría sin reglas.
    if (rules.length > 0) {
        const { error: upsertError } = await admin.from("category_stock_rules").upsert(
            rules.map((r) => ({ category_id: categoryId, ingredient_id: r.ingredientId, quantity_per_unit: r.quantityPerUnit })),
            { onConflict: "category_id,ingredient_id" }
        );
        if (upsertError) {
            console.error("Error guardando reglas de consumo:", upsertError.message);
            return json({ error: "No se pudieron guardar las reglas" }, 500);
        }
    }

    let deleteQuery = admin.from("category_stock_rules").delete().eq("category_id", categoryId);
    // Los ids ya están validados como uuid, por eso se pueden armar así.
    if (ids.length > 0) deleteQuery = deleteQuery.not("ingredient_id", "in", `(${ids.join(",")})`);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
        console.error("Error quitando reglas de consumo:", deleteError.message);
        return json({ error: "No se pudieron guardar las reglas" }, 500);
    }

    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}