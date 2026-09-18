// Cliente de Supabase para usar EN EL NAVEGADOR (islas de cliente,
// componentes con <script>, stores, etc).
//
// Usa la publishable key: es de bajo privilegio a propósito, todo lo
// que haga pasa por las políticas de RLS definidas en la migración.
// Nunca importar este archivo desde código que corre solo en servidor
// si lo que necesitás es saltar RLS — para eso está admin.ts.

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY en el .env"
    );
}

// Singleton: evita crear un cliente nuevo en cada import.
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey);