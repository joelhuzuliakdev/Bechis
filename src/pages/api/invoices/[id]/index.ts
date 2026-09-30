import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateInvoiceSchema } from "@/lib/validators/invoiceSchema";

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
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

  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  // Usamos la función update_invoice (en vez de un .update() directo)
  // para que, si la factura ya está pagada, el gasto vinculado se
  // actualice en la misma transacción — ver migración 0010.
  const { error } = await supabase.rpc("update_invoice", {
    p_invoice_id: id,
    p_supplier_id: parsed.data.supplierId,
    p_invoice_number: parsed.data.invoiceNumber,
    p_date: parsed.data.date,
    p_due_date: parsed.data.dueDate ?? null,
    p_detail: parsed.data.detail ?? null,
    p_image_url: parsed.data.imageUrl ?? null,
    p_total: parsed.data.total,
  });

  if (error) {
    console.error("Error editando factura:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo editar la factura" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};