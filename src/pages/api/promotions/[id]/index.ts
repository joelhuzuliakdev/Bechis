import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

// Update parcial: desde el listado solo se manda { active }, desde el
// formulario de edición se manda todo el resto también.
const updateSchema = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    type: z.enum(["2x1", "descuento_porcentual", "combo"]).optional(),
    discountValue: z.number().nonnegative().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    active: z.boolean().optional(),
    productIds: z.array(z.string().uuid()).optional(), // si viene, reemplaza los vínculos existentes
});

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const supabase = createSupabaseServerClient(cookies);
    const promotionId = params.id!;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type !== undefined) updates.type = input.type;
    if (input.discountValue !== undefined) updates.discount_value = input.discountValue;
    if (input.dayOfWeek !== undefined) updates.day_of_week = input.dayOfWeek;
    if (input.startDate !== undefined) updates.start_date = input.startDate;
    if (input.endDate !== undefined) updates.end_date = input.endDate;
    if (input.active !== undefined) updates.active = input.active;

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("promotions").update(updates).eq("id", promotionId);
        if (error) {
        console.error("Error actualizando promoción:", error.message);
        return json({ error: "No se pudo actualizar la promoción" }, 500);
        }
    }

    if (input.productIds !== undefined) {
        await supabase.from("promotion_products").delete().eq("promotion_id", promotionId);
        if (input.productIds.length > 0) {
        const rows = input.productIds.map((productId) => ({ promotion_id: promotionId, product_id: productId }));
        const { error: linkError } = await supabase.from("promotion_products").insert(rows);
        if (linkError) console.error("Error re-vinculando productos:", linkError.message);
        }
    }

    return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const supabase = createSupabaseServerClient(cookies);
    const { error } = await supabase.from("promotions").delete().eq("id", params.id);

    if (error) {
        console.error("Error eliminando promoción:", error.message);
        return json({ error: "No se pudo eliminar la promoción" }, 500);
    }
    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}