import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { categoryCreateSchema, slugify } from "@/lib/validators/categorySchema";

// Solo admin. Se usa el cliente admin (servidor) después de validar la
// sesión y el rol, igual que en checkout: no depende de las políticas RLS
// de `categories`.
export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active || profile.role !== "admin") return json({ error: "No autorizado" }, 401);

    const parsed = categoryCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, 400);
    const input = parsed.data;

    const admin = createSupabaseAdminClient();

    // Slug único: si ya existe, se agrega -2, -3...
    const baseSlug = slugify(input.name);
    if (!baseSlug) return json({ error: "El nombre no es válido" }, 400);

    const { data: existing } = await admin.from("categories").select("slug, sort_order");
    const slugs = new Set((existing ?? []).map((c) => c.slug));
    let slug = baseSlug;
    for (let i = 2; slugs.has(slug); i++) slug = `${baseSlug}-${i}`;

    const nextOrder = Math.max(0, ...(existing ?? []).map((c) => c.sort_order ?? 0)) + 1;

    const { data, error } = await admin
        .from("categories")
        .insert({
            name: input.name,
            slug,
            icon_emoji: input.iconEmoji,
            accent_color: input.accentColor,
            sort_order: nextOrder,
            active: true,
        })
        .select("id, name, slug, sort_order, active, icon_emoji, accent_color")
        .single();

    if (error || !data) {
        console.error("Error creando categoría:", error?.message);
        return json({ error: "No se pudo crear la categoría" }, 500);
    }

    return json({ ok: true, category: data });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}