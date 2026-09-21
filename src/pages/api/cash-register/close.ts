import type { APIRoute } from "astro";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { getOpenCashRegister, getCashRegisterSummary } from "@/lib/cash/fetchCashRegister";

const bodySchema = z.object({
  realAmount: z.number().nonnegative(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") {
    return json({ error: "No autorizado" }, 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Monto real inválido" }, 400);

  const supabase = createSupabaseServerClient(cookies);

  const register = await getOpenCashRegister(supabase);
  if (!register) return json({ error: "No hay ninguna caja abierta" }, 400);

  // El esperado se recalcula acá, no se confía en nada que venga del
  // navegador — mismo criterio que usamos para precios de pedidos.
  const summary = await getCashRegisterSummary(supabase, register);
  const difference = parsed.data.realAmount - summary.expectedTotal;

  const { error } = await supabase
    .from("cash_register")
    .update({
      status: "cerrada",
      closed_at: new Date().toISOString(),
      closed_by: profile.id,
      expected_total: summary.expectedTotal,
      real_amount: parsed.data.realAmount,
      difference,
    })
    .eq("id", register.id);

  if (error) {
    console.error("Error cerrando caja:", error.message);
    return json({ error: "No se pudo cerrar la caja" }, 500);
  }

  return json({ expectedTotal: summary.expectedTotal, realAmount: parsed.data.realAmount, difference });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}