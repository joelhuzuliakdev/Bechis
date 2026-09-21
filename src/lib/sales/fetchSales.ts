import type { SupabaseClient } from "@supabase/supabase-js";

export interface SaleRow {
  id: string;
  saleNumber: number;
  createdAt: string;
  customerName: string | null;
  total: number;
  paymentMethod: string;
  employeeName: string | null;
  orderNumber: number | null;
}

export interface SalesSummary {
  sales: SaleRow[];
  totalAmount: number;
  totalsByMethod: Record<string, number>;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  qr: "QR",
  debito: "Débito",
  credito: "Crédito",
};

export async function fetchSalesInRange(client: SupabaseClient, from: Date, to: Date): Promise<SalesSummary> {
  const { data, error } = await client
    .from("sales")
    .select(
      `
      id, sale_number, created_at, customer_name, total, payment_method,
      profiles ( full_name ),
      orders ( order_number )
    `
    )
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("Error cargando ventas:", error.message);
    return { sales: [], totalAmount: 0, totalsByMethod: {} };
  }

  const sales: SaleRow[] = data.map((raw: any) => ({
    id: raw.id,
    saleNumber: raw.sale_number,
    createdAt: raw.created_at,
    customerName: raw.customer_name,
    total: raw.total,
    paymentMethod: raw.payment_method,
    employeeName: raw.profiles?.full_name ?? null,
    orderNumber: raw.orders?.order_number ?? null,
  }));

  const totalsByMethod: Record<string, number> = {};
  Object.keys(PAYMENT_METHOD_LABELS).forEach((m) => (totalsByMethod[m] = 0));

  let totalAmount = 0;
  sales.forEach((s) => {
    totalAmount += s.total;
    totalsByMethod[s.paymentMethod] = (totalsByMethod[s.paymentMethod] ?? 0) + s.total;
  });

  return { sales, totalAmount, totalsByMethod };
}