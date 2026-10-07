import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { categoryUpdateSchema } from "@/lib/validators/categorySchema";

// Editar nombre / emoji / color y activar o desactivar. El slug NO cambia
// al renombrar, para que los links /categoria/<slug> no se rompan.
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active || profile.role !== "admin") return json({ error: "No autorizado" }, 401);

    const id = params.id!;
    const parsed = categoryUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, 400);
    const input = parsed.data;

    const admin = createSupabaseAdminClient();

    // No se puede ocultar una categoría con productos activos: quedarían
    // sin forma de encontrarlos navegando el catálogo.
    if (input.active === false) {
        const { count, error: countError } = await admin
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("category_id", id)
            .eq("active", true);
        if (countError) {
            console.error("Error contando productos:", countError.message);
            return json({ error: "No se pudo verificar los productos de la categoría" }, 500);
        }
        if ((count ?? 0) > 0) {
            return json(
                { error: `Esta categoría tiene ${count} producto(s) activo(s). Movelos a otra categoría antes de ocultarla.` },
                409
            );
        }
    }

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.iconEmoji !== undefined) updates.icon_emoji = input.iconEmoji;
    if (input.accentColor !== undefined) updates.accent_color = input.accentColor;
    if (input.active !== undefined) updates.active = input.active;
    if (Object.keys(updates).length === 0) return json({ ok: true });

    const { error } = await admin.from("categories").update(updates).eq("id", id);
    if (error) {
        console.error("Error actualizando categoría:", error.message);
        return json({ error: "No se pudo actualizar la categoría" }, 500);
    }
    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}