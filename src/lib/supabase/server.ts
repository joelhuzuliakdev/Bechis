// Clientes de Supabase para usar SOLO EN EL SERVIDOR
// (páginas .astro con output "server", middleware, API routes).
//
// Hay dos, y es importante no mezclarlos:
//
// 1. createSupabaseServerClient(cookies)
//    Actúa "como el usuario logueado" (admin o empleado), leyendo su
//    sesión desde las cookies. Respeta RLS: si un empleado no tiene
//    permiso para leer `expenses`, esto tampoco se lo va a dar.
//    Usar esto en: páginas de /admin y /empleado, y en API routes que
//    actúan a nombre de un usuario autenticado.
//
// 2. createSupabaseAdminClient()
//    Usa la SUPABASE_SERVICE_ROLE_KEY y SALTA todas las políticas de
//    RLS. Tiene acceso total a la base de datos.
//    Usar SOLO para operaciones de sistema muy puntuales donde no hay
//    un usuario logueado de por medio pero la acción es legítima —
//    el caso principal es cuando un CLIENTE ANÓNIMO crea un pedido
//    desde el catálogo público (orders/create.ts): ahí no hay sesión,
//    pero igual necesitamos insertar en varias tablas relacionadas de
//    forma consistente.
//    NUNCA exponer esta key ni este cliente al navegador.

import { createServerClient } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSupabaseServerClient(cookies: AstroCookies) {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
        "Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY en el .env"
        );
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
        get(key: string) {
            return cookies.get(key)?.value;
        },
        set(key: string, value: string, options) {
            cookies.set(key, value, { ...options, path: "/" });
        },
        remove(key: string, options) {
            cookies.delete(key, { ...options, path: "/" });
        },
        },
    });
}

let adminClientSingleton: ReturnType<typeof createClient> | null = null;

export function createSupabaseAdminClient() {
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
        "Falta PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env (solo servidor)"
        );
    }
    if (!adminClientSingleton) {
        adminClientSingleton = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return adminClientSingleton;
}