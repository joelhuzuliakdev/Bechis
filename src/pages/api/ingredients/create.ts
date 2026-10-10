import type { APIRoute } from "astro";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ingredientSchema } from "@/lib/validators/productSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

    const parsed = ingredientSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const supabase = createSupabaseServerClient(cookies);
    // Se crea con stock 0: el stock inicial entra como un movimiento (queda en el historial).
    const { data, error } = await supabase
        .from("ingredients")
        .insert({
        name: input.name,
        extra_price: input.extraPrice,
        unit: input.unit,
        extra_quantity: input.extraQuantity,
        stock: 0,
        min_stock: input.minStock,
        active: input.active,
        })
        .select("id")
        .single();

    if (error || !data) {
        console.error("Error creando ingrediente:", error?.message);
        return json({ error: "No se pudo crear el ingrediente" }, 500);
    }

    if (input.stock > 0) {
        const admin = createSupabaseAdminClient();
        const { data: movement, error: movementError } = await admin.rpc("apply_stock_movement", {
            p_target: "ingrediente",
            p_item_id: data.id,
            p_type: "ingreso",
            p_quantity: input.stock,
            p_reason: "Stock inicial",
            p_user_id: auth.profile.id,
        });
        const result = movement as { ok?: boolean } | null;
        if (movementError || !result?.ok) {
            console.error("Error cargando stock inicial del ingrediente:", movementError?.message ?? result);
            return json({
                id: data.id,
                warning: "El ingrediente se creó, pero no se pudo cargar el stock inicial. Cargalo desde la pantalla Stock.",
            });
        }
    }

    return json({ id: data.id });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}