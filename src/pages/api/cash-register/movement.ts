import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { getOpenCashRegister } from "@/lib/cash/fetchCashRegister";

const bodySchema = z.object({
  type: z.enum(["ingreso", "egreso", "retiro"]),
  amount: z.number().positive(),
  description: z.string().trim().max(200).optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") {
    return json({ error: "No autorizado" }, 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos inválidos" }, 400);

  const supabase = createSupabaseServerClient(cookies);

  const register = await getOpenCashRegister(supabase);
  if (!register) return json({ error: "No hay ninguna caja abierta" }, 400);

  const { error } = await supabase.from("cash_movements").insert({
    cash_register_id: register.id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    description: parsed.data.description ?? null,
    user_id: profile.id,
  });

  if (error) {
    console.error("Error creando movimiento de caja:", error.message);
    return json({ error: "No se pudo registrar el movimiento" }, 500);
  }

  return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}