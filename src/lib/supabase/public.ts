// Cliente para leer datos PÚBLICOS del catálogo (categorías, productos,
// ingredientes, promos activas) desde el frontmatter de páginas .astro,
// que corre en el servidor en cada request.
//
// Es distinto de lib/supabase/client.ts: ese está pensado para el
// bundle del navegador (islas, stores). Este vive solo en servidor,
// pero usa la MISMA publishable key — no hace falta la service role
// acá porque estas tablas ya son de lectura pública según las
// políticas de RLS (products_public_read, categories_public_read, etc).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY en el .env"
  );
}

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});