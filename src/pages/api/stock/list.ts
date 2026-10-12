import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { listProductStock, listIngredientStock } from "@/lib/stock/fetchStock";

// Solo lectura: devuelve el stock actual para que la pantalla se refresque sola.
export const GET: APIRoute = async ({ cookies }) => {
    const auth = await requireRole(cookies, ["admin", "empleado"]);
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServerClient(cookies);
    const [products, ingredients] = await Promise.all([listProductStock(supabase), listIngredientStock(supabase)]);

    return new Response(JSON.stringify({ products, ingredients }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
};