import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

export const POST: APIRoute = async ({ params, cookies }) => {
  const auth = await requireRole(cookies, ["admin"]);
  if (!auth.ok) return auth.response;

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el id" }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies);

  // mark_invoice_pending vuelve la factura a pendiente Y borra el gasto
  // vinculado en una sola transacción — ver migración 0010.
  const { error } = await supabase.rpc("mark_invoice_pending", {
    p_invoice_id: id,
  });

  if (error) {
    console.error("Error volviendo la factura a pendiente:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo actualizar la factura" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};