import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { ingredientSchema } from "@/lib/validators/productSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = ingredientSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const input = parsed.data;

    const supabase = createSupabaseServerClient(cookies);
    const { data, error } = await supabase
        .from("ingredients")
        .insert({
        name: input.name,
        extra_price: input.extraPrice,
        stock: input.stock,
        min_stock: input.minStock,
        active: input.active,
        })
        .select("id")
        .single();

    if (error || !data) {
        console.error("Error creando ingrediente:", error?.message);
        return json({ error: "No se pudo crear el ingrediente" }, 500);
    }

    return json({ id: data.id });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}