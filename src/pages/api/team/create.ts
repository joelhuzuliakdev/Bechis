import type { APIRoute } from "astro";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "empleado"]),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const profile = await getSessionProfile(cookies);
  if (!profile || profile.role !== "admin") {
    return json({ error: "No autorizado" }, 401);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  }
  const { fullName, email, password, role } = parsed.data;

  const admin = createSupabaseAdminClient();

  // El trigger handle_new_user (ver supabase/migrations/0003) lee
  // exactamente estos dos campos de user_metadata y crea el profile
  // solo, con el rol correcto.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error || !data.user) {
    console.error("Error creando usuario:", error?.message);
    return json({ error: error?.message ?? "No se pudo crear la cuenta" }, 500);
  }

  return json({ id: data.user.id });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}