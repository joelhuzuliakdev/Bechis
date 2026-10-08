// Corre en CADA request. Acá es donde de verdad se decide si alguien
// puede o no entrar a una ruta del panel — no alcanza con "ocultar" el
// link en el sidebar, porque un empleado (o cualquiera) podría escribir
// la URL directamente en el navegador. Esta es la última línea de
// defensa del lado de la app (la RLS en la base es la de más atrás de
// todas, ver supabase/migrations/0001_init.sql).

import { defineMiddleware } from "astro:middleware";
import { getSessionProfile } from "@/lib/auth/session";

// Secciones de /admin a las que un EMPLEADO también puede entrar
// (punto 18 del brief: Productos, Pedidos/Panel Empleado, Stock, Promos;
// Ingredientes también figura para empleado en el Sidebar).
// Todo lo demás bajo /admin que no empiece con estos prefijos queda
// reservado solo para admin.
const EMPLOYEE_ALLOWED_PREFIXES = [
    "/admin/productos",
    "/admin/stock",
    "/admin/promos",
    "/admin/ingredientes",
    "/empleado",
];

// Coincide por segmento completo: "/admin/stock" y "/admin/stock/x" sí,
// pero "/admin/stockeo" no.
function matchesPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(prefix + "/");
}

function isProtectedPath(pathname: string): boolean {
    return matchesPrefix(pathname, "/admin") || matchesPrefix(pathname, "/empleado");
}

function employeeCanAccess(pathname: string): boolean {
    return EMPLOYEE_ALLOWED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

// Las páginas del panel dependen de quién está logueado: que el navegador
// no las guarde (botón "atrás", caché), para no mostrar datos de otro
// usuario después de cerrar sesión o cambiar de cuenta.
async function noStore(next: () => Promise<Response>): Promise<Response> {
    const response = await next();
    try {
        response.headers.set("Cache-Control", "no-store");
    } catch {
        // Si los headers no se pueden modificar, se deja la respuesta tal cual.
    }
    return response;
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
        return noStore(next);
    }

    // A partir de acá, es un empleado.
    if (employeeCanAccess(pathname)) {
        context.locals.profile = profile;
        return noStore(next);
    }

    // Empleado intentando entrar a algo que no le corresponde (ej:
    // /admin/reportes escrito a mano): lo mandamos a su panel, no a un
    // error genérico, para no confundirlo.
    return context.redirect("/empleado/pedidos");
});