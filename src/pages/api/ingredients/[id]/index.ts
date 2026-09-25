import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { ingredientUpdateSchema } from "@/lib/validators/productSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = ingredientUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.extraPrice !== undefined) updates.extra_price = input.extraPrice;
    if (input.stock !== undefined) updates.stock = input.stock;
    if (input.minStock !== undefined) updates.min_stock = input.minStock;
    if (input.active !== undefined) updates.active = input.active;

    if (Object.keys(updates).length === 0) return json({ error: "Nada para actualizar" }, 400);

    const supabase = createSupabaseServerClient(cookies);
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