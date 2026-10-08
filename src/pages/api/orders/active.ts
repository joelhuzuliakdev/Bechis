// GET /api/orders/active
//
// Devuelve los pedidos activos (los mismos que arma la página del Kanban al
// cargar). Lo usa newOrderAlert.ts para ponerse al día después de una
// reconexión de Realtime. Solo lectura; no cambia nada.

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { fetchActiveOrders } from "@/lib/orders/fetchOrders";

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}

export const GET: APIRoute = async ({ cookies }) => {
    const profile = await getSessionProfile(cookies);
    if (!profile || !profile.active || !(["admin", "empleado"] as string[]).includes(profile.role)) {
        return json({ error: "No autorizado" }, 401);
    }

    const orders = await fetchActiveOrders(createSupabaseServerClient(cookies));
    return json({ orders });
};