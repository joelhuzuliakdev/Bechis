/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        // Poblado por src/middleware.ts en toda ruta bajo /admin o /empleado.
        // Fuera de esas rutas puede ser undefined.
        profile?: {
        id: string;
        fullName: string;
        role: "admin" | "empleado";
        active: boolean;
        email: string | null;
        };
    }
}

interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string;
    readonly PUBLIC_SUPABASE_ANON_KEY: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}