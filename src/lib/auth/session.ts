// Se usa en el middleware y en cualquier página del panel que necesite
// saber quién está logueado y con qué rol, sin repetir la consulta a
// `profiles` en cada lugar.

import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export interface SessionProfile {
    id: string;
    fullName: string;
    role: UserRole;
    active: boolean;
    email: string | null;
}

export async function getSessionProfile(cookies: AstroCookies): Promise<SessionProfile | null> {
    const supabase = createSupabaseServerClient(cookies);

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", user.id)
        .maybeSingle();

    if (error || !profile) return null;

    return {
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        active: profile.active,
        email: user.email ?? null,
    };
}