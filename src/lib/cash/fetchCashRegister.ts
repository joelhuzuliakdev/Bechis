import type { SupabaseClient } from "@supabase/supabase-js";

export interface OpenCashRegister {
  id: string;
  openedAt: string;
  openingAmount: number;
  openedByName: string | null;
}

export interface CashMovementRow {
  id: string;
  type: "ingreso" | "egreso" | "retiro";
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface CashRegisterSummary {
  register: OpenCashRegister;
  cashSales: number;
  ingresos: number;
  egresos: number;
  retiros: number;
  expectedTotal: number;
  movements: CashMovementRow[];
}

export interface CashRegisterHistoryRow {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  expectedTotal: number | null;
  realAmount: number | null;
  difference: number | null;
  status: "abierta" | "cerrada";
  openedByName: string | null;
  closedByName: string | null;
}

export async function getOpenCashRegister(client: SupabaseClient): Promise<OpenCashRegister | null> {
  const { data, error } = await client
    .from("cash_register")
    .select("id, opened_at, opening_amount, profiles!cash_register_opened_by_fkey ( full_name )")
    .eq("status", "abierta")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    openedAt: data.opened_at,
    openingAmount: data.opening_amount,
    openedByName: (data as any).profiles?.full_name ?? null,
  };
}

/**
 * Calcula ventas en efectivo + movimientos manuales de una caja puntual.
 * El "esperado" se calcula acá para reutilizarse tanto en la pantalla
 * (mostrarlo en vivo) como en el cierre (validarlo en el servidor).
 */
export async function getCashRegisterSummary(
  client: SupabaseClient,
  register: OpenCashRegister
): Promise<CashRegisterSummary> {
  const { data: salesData } = await client
    .from("sales")
    .select("total")
    .eq("cash_register_id", register.id)
    .eq("payment_method", "efectivo");

  const cashSales = (salesData ?? []).reduce((sum, s) => sum + s.total, 0);

  const { data: movementsData } = await client
    .from("cash_movements")
    .select("id, type, amount, description, created_at")
    .eq("cash_register_id", register.id)
    .order("created_at", { ascending: false });

  const movements: CashMovementRow[] = (movementsData ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    amount: m.amount,
    description: m.description,
    createdAt: m.created_at,
  }));

  const ingresos = movements.filter((m) => m.type === "ingreso").reduce((s, m) => s + m.amount, 0);
  const egresos = movements.filter((m) => m.type === "egreso").reduce((s, m) => s + m.amount, 0);
  const retiros = movements.filter((m) => m.type === "retiro").reduce((s, m) => s + m.amount, 0);

  const expectedTotal = register.openingAmount + cashSales + ingresos - egresos - retiros;

  return { register, cashSales, ingresos, egresos, retiros, expectedTotal, movements };
}

export async function getCashRegisterHistory(
  client: SupabaseClient,
  from: Date,
  to: Date
): Promise<CashRegisterHistoryRow[]> {
  const { data, error } = await client
    .from("cash_register")
    .select(
      `
      id, opened_at, closed_at, opening_amount, expected_total, real_amount, difference, status,
      opened_by_profile:profiles!cash_register_opened_by_fkey ( full_name ),
      closed_by_profile:profiles!cash_register_closed_by_fkey ( full_name )
    `
    )
    .eq("status", "cerrada")
    .gte("opened_at", from.toISOString())
    .lte("opened_at", to.toISOString())
    .order("opened_at", { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingAmount: r.opening_amount,
    expectedTotal: r.expected_total,
    realAmount: r.real_amount,
    difference: r.difference,
    status: r.status,
    openedByName: r.opened_by_profile?.full_name ?? null,
    closedByName: r.closed_by_profile?.full_name ?? null,
  }));
}