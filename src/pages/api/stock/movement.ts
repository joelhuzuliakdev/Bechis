import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

const bodySchema = z.object({
    target: z.enum(["producto", "ingrediente"]),
    itemId: z.string().uuid(),
    type: z.enum(["ingreso", "egreso", "correccion"]),
    // Siempre en la UNIDAD BASE del item (gramos, ml o unidades): la pantalla
    // convierte los kilos a gramos antes de mandar. Para ingreso/egreso: cuánto
    // sumar o restar. Para corrección: el valor NUEVO y correcto del stock.
    quantity: z.number().finite().nonnegative(),
    reason: z.string().trim().max(200).optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const { target, itemId, type, quantity, reason } = parsed.data;

    // El movimiento lo hace la función de la base (apply_stock_movement): bloquea
    // la fila, valida y deja el historial en una sola transacción. Solo la puede
    // ejecutar el servidor, por eso se usa el cliente admin, después de validar el rol.
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("apply_stock_movement", {
        p_target: target,
        p_item_id: itemId,
        p_type: type,
        p_quantity: quantity,
        p_reason: reason ?? null,
        p_user_id: auth.profile.id,
    });

    if (error) {
        console.error("Error registrando movimiento de stock:", error.message);
        return json({ error: "No se pudo registrar el movimiento" }, 500);
    }

    const result = data as { ok: boolean; code?: string; newStock?: number; available?: number } | null;
    if (!result || !result.ok) {
        switch (result?.code) {
            case "invalid_quantity":
                return json({ error: "La cantidad tiene que ser mayor a 0.", code: result.code }, 400);
            case "insufficient_stock":
                return json(
                    { error: "No hay stock suficiente para ese egreso.", code: result.code, available: result.available },
                    409
                );
            case "not_found":
                return json({ error: "No se encontró el producto/ingrediente", code: result.code }, 404);
            default:
                return json({ error: "No se pudo registrar el movimiento", code: result?.code }, 400);
        }
    }

    return json({ newStock: result.newStock });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}