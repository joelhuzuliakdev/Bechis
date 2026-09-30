import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { payInvoiceSchema } from "@/lib/validators/invoiceSchema";

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el id" }), { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = payInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  // mark_invoice_paid marca la factura como pagada Y crea el gasto
  // vinculado en una sola transacción — ver migración 0010. Si algo
  // falla, Postgres revierte todo: nunca queda pagada sin su gasto.
  const { data, error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: id,
    p_category_id: parsed.data.categoryId,
    p_payment_method: parsed.data.paymentMethod,
  });

  if (error) {
    console.error("Error marcando factura como pagada:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo marcar la factura como pagada" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true, expenseId: data }), { status: 200 });
};