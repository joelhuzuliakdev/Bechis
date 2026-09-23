import type { APIRoute } from "astro";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["admin", "empleado"]).optional(),
  active: z.boolean().optional(),
});

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") return json({ error: "No autorizado" }, 401);

  const targetId = params.id!;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
  const input = parsed.data;

  // Protección: un admin no puede desactivarse a sí mismo (se
  // quedaría afuera del panel sin que nadie más pueda reactivarlo
  // desde la UI en el momento).
  if (targetId === profile.id && input.active === false) {
    return json({ error: "No podés desactivar tu propia cuenta" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (input.fullName !== undefined) updates.full_name = input.fullName;
  if (input.role !== undefined) updates.role = input.role;
  if (input.active !== undefined) updates.active = input.active;

  if (Object.keys(updates).length === 0) return json({ error: "Nada para actualizar" }, 400);

  const supabase = createSupabaseServerClient(cookies);
  const { error } = await supabase.from("profiles").update(updates).eq("id", targetId);

  if (error) {
    console.error("Error actualizando empleado:", error.message);
    return json({ error: "No se pudo actualizar la cuenta" }, 500);
  }

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") return json({ error: "No autorizado" }, 401);

  const targetId = params.id!;

  // Protección: un admin no puede eliminarse a sí mismo.
  if (targetId === profile.id) {
    return json({ error: "No podés eliminar tu propia cuenta" }, 400);
  }

  // Eliminar el usuario de Auth es lo único que hace falta: profiles.id
  // tiene "on delete cascade" contra auth.users, así que el perfil se
  // borra solo. Esto requiere la API de administración (service role).
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);

  if (error) {
    console.error("Error eliminando empleado:", error.message);
    return json({ error: "No se pudo eliminar la cuenta" }, 500);
  }

  return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}