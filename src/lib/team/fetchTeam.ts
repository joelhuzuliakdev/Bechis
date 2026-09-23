import type { AstroCookies } from "astro";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export interface TeamMember {
  id: string;
  fullName: string;
  email: string | null;
  role: "admin" | "empleado";
  active: boolean;
  createdAt: string;
}

/**
 * El email vive en auth.users, no en profiles, y auth.users no se
 * puede leer con el cliente normal (ni siquiera autenticado como
 * admin) — solo con la API de administración de Auth, que exige
 * service role. Por eso esta función combina dos fuentes: profiles
 * (con el cliente autenticado normal, ya que RLS ya lo permite) y los
 * emails (con el cliente admin, solo para esta lectura puntual).
 */
export async function fetchTeam(cookies: AstroCookies): Promise<TeamMember[]> {
  const supabase = createSupabaseServerClient(cookies);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .order("created_at", { ascending: true });

  if (error || !profiles) return [];

  const admin = createSupabaseAdminClient();
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersData?.users ?? []).map((u) => [u.id, u.email ?? null]));

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: emailById.get(p.id) ?? null,
    role: p.role,
    active: p.active,
    createdAt: p.created_at,
  }));
}