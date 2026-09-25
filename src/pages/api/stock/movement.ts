import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const bodySchema = z.object({
    target: z.enum(["producto", "ingrediente"]),
    itemId: z.string().uuid(),
    type: z.enum(["ingreso", "egreso", "correccion"]),
    // Para ingreso/egreso: cuánto sumar o restar. Para corrección: el
    // valor NUEVO y correcto del stock (no una diferencia).
    quantity: z.number().nonnegative(),
    reason: z.string().trim().max(200).optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const { target, itemId, type, quantity, reason } = parsed.data;

    const supabase = createSupabaseServerClient(cookies);
    const table = target === "producto" ? "products" : "ingredients";

    const { data: item, error: fetchError } = await supabase.from(table).select("stock").eq("id", itemId).maybeSingle();
    if (fetchError || !item) return json({ error: "No se encontró el producto/ingrediente" }, 404);

    const currentStock = item.stock as number;
    let newStock: number;
    let movementQuantity: number;

    if (type === "ingreso") {
        newStock = currentStock + quantity;
        movementQuantity = quantity;
    } else if (type === "egreso") {
        newStock = Math.max(0, currentStock - quantity);
        movementQuantity = quantity;
    } else {
        // corrección: `quantity` es el nuevo valor absoluto.
        newStock = quantity;
        movementQuantity = Math.abs(quantity - currentStock);
    }

    const { error: updateError } = await supabase.from(table).update({ stock: newStock }).eq("id", itemId);
    if (updateError) {
        console.error("Error actualizando stock:", updateError.message);
        return json({ error: "No se pudo actualizar el stock" }, 500);
    }

    const movementReason =
        type === "correccion" ? `Corrección: ${currentStock} → ${newStock}${reason ? ` (${reason})` : ""}` : reason ?? null;

    const { error: movementError } = await supabase.from("stock_movements").insert({
        target,
        product_id: target === "producto" ? itemId : null,
        ingredient_id: target === "ingrediente" ? itemId : null,
        type,
        quantity: movementQuantity,
        reason: movementReason,
        user_id: profile.id,
    });

    if (movementError) console.error("Error registrando movimiento:", movementError.message);

    return json({ newStock });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}