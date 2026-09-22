import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { promotionSchema } from "@/lib/validators/promotionSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active) return json({ error: "No autorizado" }, 401);

    const parsed = promotionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Datos inválidos", details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    const supabase = createSupabaseServerClient(cookies);

    const { data: promo, error } = await supabase
        .from("promotions")
        .insert({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        discount_value: input.discountValue,
        day_of_week: input.dayOfWeek ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        active: input.active,
        })
        .select("id")
        .single();

    if (error || !promo) {
        console.error("Error creando promoción:", error?.message);
        return json({ error: "No se pudo crear la promoción" }, 500);
    }

    if (input.productIds.length > 0) {
        const rows = input.productIds.map((productId) => ({ promotion_id: promo.id, product_id: productId }));
        const { error: linkError } = await supabase.from("promotion_products").insert(rows);
        if (linkError) console.error("Error vinculando productos a la promo:", linkError.message);
    }

    return json({ id: promo.id });
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}