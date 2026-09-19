// Corre en CADA request. Acá es donde de verdad se decide si alguien
// puede o no entrar a una ruta del panel — no alcanza con "ocultar" el
// link en el sidebar, porque un empleado (o cualquiera) podría escribir
// la URL directamente en el navegador. Esta es la última línea de
// defensa del lado de la app (la RLS en la base es la de más atrás de
// todas, ver supabase/migrations/0001_init.sql).

import { defineMiddleware } from "astro:middleware";
import { getSessionProfile } from "@/lib/auth/session";

// Secciones de /admin a las que un EMPLEADO también puede entrar
// (punto 18 del brief: Productos, Pedidos/Panel Empleado, Stock, Promos).
// Todo lo demás bajo /admin que no empiece con estos prefijos queda
// reservado solo para admin.
const EMPLOYEE_ALLOWED_PREFIXES = ["/admin/productos", "/admin/stock", "/admin/promos", "/empleado"];

function isProtectedPath(pathname: string): boolean {
    return pathname.startsWith("/admin") || pathname.startsWith("/empleado");
}

function employeeCanAccess(pathname: string): boolean {
    return EMPLOYEE_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname } = context.url;

    if (!isProtectedPath(pathname)) {
        return next();
    }

    const profile = await getSessionProfile(context.cookies);

    if (!profile || !profile.active) {
        return context.redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (profile.role === "admin") {
        context.locals.profile = profile;
        return next();
    }

    // A partir de acá, es un empleado.
    if (employeeCanAccess(pathname)) {
        context.locals.profile = profile;
        return next();
    }

    // Empleado intentando entrar a algo que no le corresponde (ej:
    // /admin/reportes escrito a mano): lo mandamos a su panel, no a un
    // error genérico, para no confundirlo.
    return context.redirect("/empleado/pedidos");
});