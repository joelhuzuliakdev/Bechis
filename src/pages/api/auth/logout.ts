import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const POST: APIRoute = async ({ cookies, redirect }) => {
    const supabase = createSupabaseServerClient(cookies);
    // "local": cierra solo la sesión de ESTE navegador. Sin esto, Supabase
    // cierra la sesión de la cuenta en todos los dispositivos.
    await supabase.auth.signOut({ scope: "local" });
    return redirect("/login");
};