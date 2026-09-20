import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchOrderById } from "@/lib/orders/fetchOrders";

export const GET: APIRoute = async ({ params, cookies }) => {
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