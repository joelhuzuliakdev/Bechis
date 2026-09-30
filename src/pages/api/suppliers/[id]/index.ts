import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supplierPatchSchema } from "@/lib/validators/supplierSchema";

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

  const parsed = supplierPatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  const { address, active, ...rest } = parsed.data;

  const update: Record<string, unknown> = { ...rest };
  if (address !== undefined) update.address = address;
  if (active !== undefined) update.active = active;

  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ error: "No hay nada para actualizar" }), { status: 400 });
  }

  const { error } = await supabase.from("suppliers").update(update).eq("id", id);

  if (error) {
    console.error("Error editando proveedor:", error.message);
    return new Response(JSON.stringify({ error: "No se pudo guardar el proveedor" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};