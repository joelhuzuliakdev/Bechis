import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { fetchOrderById } from "@/lib/orders/fetchOrders";

export const GET: APIRoute = async ({ params, cookies }) => {
  const auth = await requireRole(cookies, ["admin", "empleado"]);
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseServerClient(cookies);

  const order = await fetchOrderById(supabase, params.id!);

  if (!order) {
    return new Response(JSON.stringify({ error: "Pedido no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(order), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};