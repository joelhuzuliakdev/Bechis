import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { categoryReorderSchema } from "@/lib/validators/categorySchema";

// Recibe los ids en el orden deseado y guarda sort_order = 1, 2, 3...
export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active || profile.role !== "admin") return json({ error: "No autorizado" }, 401);

    const parsed = categoryReorderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);

    const admin = createSupabaseAdminClient();
    const results = await Promise.all(
        parsed.data.ids.map((id, index) => admin.from("categories").update({ sort_order: index + 1 }).eq("id", id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
        console.error("Error reordenando categorías:", failed.error.message);
        return json({ error: "No se pudo guardar el orden" }, 500);
    }
    return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}