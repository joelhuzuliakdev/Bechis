import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const bodySchema = z.object({
  openingAmount: z.number().nonnegative(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") {
    return json({ error: "No autorizado" }, 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Monto inicial inválido" }, 400);

  const supabase = createSupabaseServerClient(cookies);

  // Chequeo defensivo: el índice único one_open_cash_register de la
  // base ya impide dos cajas abiertas a la vez, pero devolvemos un
  // mensaje claro en vez de dejar que explote como error genérico.
  const { data: existing } = await supabase.from("cash_register").select("id").eq("status", "abierta").maybeSingle();
  if (existing) return json({ error: "Ya hay una caja abierta" }, 400);

  const { data, error } = await supabase
    .from("cash_register")
    .insert({
      opening_amount: parsed.data.openingAmount,
      opened_by: profile.id,
      status: "abierta",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error abriendo caja:", error?.message);
    return json({ error: "No se pudo abrir la caja" }, 500);
  }

  return json({ id: data.id });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}