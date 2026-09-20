import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  status: z.enum(["pedidos", "en_proceso", "finalizado"]),
});

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Estado inválido" }, 400);
  }

  const supabase = createSupabaseServerClient(cookies);

  // La policy orders_staff_update de RLS ya exige que quien llama esté
  // logueado como staff — si no lo es, este update simplemente no
  // afecta ninguna fila (0 rows), no hace falta chequearlo a mano acá.
  const { data, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", params.id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Error actualizando estado del pedido:", error.message);
    return json({ error: "No se pudo actualizar el pedido" }, 500);
  }
  if (!data) {
    return json({ error: "Pedido no encontrado o sin permiso" }, 404);
  }

  return json(data);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}