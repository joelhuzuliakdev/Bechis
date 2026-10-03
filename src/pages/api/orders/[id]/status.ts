import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canTransition, timestampColumnFor, type OrderStatus } from "@/lib/orders/orderStatus";

const ALL_STATUSES = [
  "pedidos",
  "confirmado",
  "en_proceso",
  "listo_para_retirar",
  "finalizado",
  "cancelado",
] as const;

const bodySchema = z.object({
  status: z.enum(ALL_STATUSES),
  reason: z.string().trim().min(1).max(300).optional(),
});

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Falta el id" }), { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }),
      { status: 400 }
    );
  }

  const nextStatus = parsed.data.status as OrderStatus;
  const supabase = createSupabaseServerClient(cookies);

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return new Response(JSON.stringify({ error: "Pedido no encontrado" }), { status: 404 });
  }

  const currentStatus = current.status as OrderStatus;

  if (!canTransition(currentStatus, nextStatus)) {
    return new Response(
      JSON.stringify({ error: `No se puede pasar de "${currentStatus}" a "${nextStatus}"` }),
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { status: nextStatus };

  const timestampColumn = timestampColumnFor(nextStatus);
  if (timestampColumn) {
    update[timestampColumn] = new Date().toISOString();
  }

  if (nextStatus === "cancelado") {
    update.cancel_reason = parsed.data.reason ?? null;
  }

  const { error: updateError } = await supabase.from("orders").update(update).eq("id", id);

  if (updateError) {
    console.error("Error actualizando estado del pedido:", updateError.message);
    return new Response(JSON.stringify({ error: "No se pudo actualizar el pedido" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true, status: nextStatus }), { status: 200 });
};