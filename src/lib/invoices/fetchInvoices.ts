import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceRow {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  detail: string | null;
  imageUrl: string | null;
  total: number;
  paymentStatus: "pendiente" | "pagada";
  /** true solo si sigue pendiente Y ya pasó la fecha de vencimiento */
  isOverdue: boolean;
  createdAt: string;
}

const SELECT_COLUMNS =
  "id, supplier_id, invoice_number, date, due_date, detail, image_url, total, payment_status, created_at, suppliers(name)";

function mapRow(row: any): InvoiceRow {
  const paymentStatus = row.payment_status as "pendiente" | "pagada";
  const isOverdue =
    paymentStatus === "pendiente" &&
    !!row.due_date &&
    new Date(`${row.due_date}T23:59:59`) < new Date();

  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? "Proveedor eliminado",
    invoiceNumber: row.invoice_number,
    date: row.date,
    dueDate: row.due_date,
    detail: row.detail,
    imageUrl: row.image_url,
    total: Number(row.total),
    paymentStatus,
    isOverdue,
    createdAt: row.created_at,
  };
}

export interface FetchInvoicesParams {
  supplierId?: string;
  status?: "pendiente" | "pagada";
}

export async function fetchInvoices(
  client: SupabaseClient,
  { supplierId, status }: FetchInvoicesParams = {}
): Promise<InvoiceRow[]> {
  let query = client.from("invoices").select(SELECT_COLUMNS).order("date", { ascending: false });

  if (supplierId) {
    query = query.eq("supplier_id", supplierId);
  }
  if (status) {
    query = query.eq("payment_status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando facturas:", error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function fetchInvoiceById(
  client: SupabaseClient,
  id: string
): Promise<InvoiceRow | null> {
  const { data, error } = await client.from("invoices").select(SELECT_COLUMNS).eq("id", id).single();

  if (error || !data) return null;

  return mapRow(data);
}