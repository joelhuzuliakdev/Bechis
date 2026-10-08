import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { supplierSchema } from "@/lib/validators/supplierSchema";

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireRole(cookies, ["admin"]);
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseServerClient(cookies);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  const { name, company, phone, email, cuit, address, notes } = parsed.data;

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name,
      company: company ?? null,
      phone: phone ?? null,
      email: email ?? null,
      cuit: cuit ?? null,
      address: address ?? null,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creando proveedor:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo crear el proveedor" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ id: data.id }), { status: 201 });
};