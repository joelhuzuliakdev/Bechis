import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInvoiceSchema } from "@/lib/validators/invoiceSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(cookies);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      supplier_id: parsed.data.supplierId,
      invoice_number: parsed.data.invoiceNumber,
      date: parsed.data.date,
      due_date: parsed.data.dueDate ?? null,
      detail: parsed.data.detail ?? null,
      image_url: parsed.data.imageUrl ?? null,
      total: parsed.data.total,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creando factura:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo registrar la factura" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ id: data.id }), { status: 201 });
};