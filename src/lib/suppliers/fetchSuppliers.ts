import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupplierRow {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  cuit: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

function mapRow(row: any): SupplierRow {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    phone: row.phone,
    email: row.email,
    cuit: row.cuit,
    address: row.address ?? null,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = "id, name, company, phone, email, cuit, address, notes, active, created_at";

export interface FetchSuppliersParams {
  search?: string;
  onlyActive?: boolean;
}

export async function fetchSuppliers(
  client: SupabaseClient,
  { search, onlyActive }: FetchSuppliersParams = {}
): Promise<SupplierRow[]> {
  let query = client.from("suppliers").select(SELECT_COLUMNS).order("name", { ascending: true });

  if (onlyActive) {
    query = query.eq("active", true);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},company.ilike.${term},cuit.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando proveedores:", error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function fetchSupplierById(
  client: SupabaseClient,
  id: string
): Promise<SupplierRow | null> {
  const { data, error } = await client
    .from("suppliers")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapRow(data);
}