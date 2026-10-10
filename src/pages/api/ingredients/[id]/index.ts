import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ingredientUpdateSchema } from "@/lib/validators/productSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

    const parsed = ingredientUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.extraPrice !== undefined) updates.extra_price = input.extraPrice;
    if (input.extraQuantity !== undefined) updates.extra_quantity = input.extraQuantity;
    if (input.minStock !== undefined) updates.min_stock = input.minStock;
    if (input.active !== undefined) updates.active = input.active;
    // El stock NO se cambia desde acá: se mueve desde la pantalla Stock (con historial).

    const supabase = createSupabaseServerClient(cookies);

    // Cambiar la unidad con stock cargado cambiaría el significado del número
    // (5 unidades pasarían a ser 5 g), así que se exige stock 0 antes.
    if (input.unit !== undefined) {
        const { data: current, error: currentError } = await supabase
            .from("ingredients")
            .select("unit, stock")
            .eq("id", params.id)
            .maybeSingle();
        if (currentError || !current) return json({ error: "No se encontró el ingrediente" }, 404);
        if (current.unit !== input.unit) {
            if (Number(current.stock) > 0) {
                return json(
                    {
                        error:
                            "Para cambiar la unidad, primero dejá el stock de este ingrediente en 0 desde la pantalla Stock (Corregir) y después cargalo de nuevo en la unidad nueva.",
                    },
                    409
                );
            }
            updates.unit = input.unit;
        }
    }

    if (Object.keys(updates).length === 0) return json({ ok: true });

    const { error } = await supabase.from("ingredients").update(updates).eq("id", params.id);

    if (error) {
        console.error("Error actualizando ingrediente:", error.message);
        return json({ error: "No se pudo actualizar el ingrediente" }, 500);
    }

    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}