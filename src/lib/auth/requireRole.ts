// Chequeo de sesión + rol para las rutas /api/*.
//
// El middleware solo protege las PÁGINAS (/admin y /empleado). Las rutas
// de API no pasan por ahí, así que cada una tiene que validar por su cuenta
// quién la llama. Esta función es esa validación, en un solo lugar:
//
//   const auth = await requireRole(cookies, ["admin"]);
//   if (!auth.ok) return auth.response;
//   // auth.profile = { id, role, ... }
//
// 401 = no hay sesión válida (o la cuenta está desactivada).
// 403 = hay sesión pero el rol no alcanza.

import type { AstroCookies } from "astro";
import { getSessionProfile, type SessionProfile } from "@/lib/auth/session";
import type { UserRole } from "@/types";

type RequireRoleResult = { ok: true; profile: SessionProfile } | { ok: false; response: Response };

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}

export async function requireRole(
    cookies: AstroCookies,
    allowed: readonly UserRole[]
): Promise<RequireRoleResult> {
    const profile = await getSessionProfile(cookies);

    if (!profile || !profile.active) {
        return { ok: false, response: json({ error: "No autorizado" }, 401) };
    }
    if (!allowed.includes(profile.role)) {
        return { ok: false, response: json({ error: "No tenés permiso para esta acción" }, 403) };
    }
    return { ok: true, profile };
}