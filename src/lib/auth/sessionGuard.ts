// Guardián de sesión para las pestañas del panel (admin y empleado).
//
// Problema que resuelve: el navegador tiene UNA sola sesión (cookies
// compartidas por todas las pestañas). Si en otra pestaña entra otro
// usuario (p. ej. un admin), la sesión cambia para todas y una pestaña
// que se abrió como "empleado" empezaría a recibir datos de admin sin
// que nadie lo note.
//
// Qué hace: cada página del panel declara con qué usuario se renderizó
// (data-session-user en <body>). Este módulo vigila la sesión real del
// navegador y, si deja de coincidir (otro usuario, o cerraron sesión),
// tapa la pantalla con un aviso y obliga a recargar. No cambia permisos:
// los permisos los sigue decidiendo el servidor en cada request.
import { supabaseBrowser } from "@/lib/supabase/client";

declare global {
    interface Window {
        __bechisSessionGuard?: boolean;
    }
}

const OVERLAY_ID = "bechis-session-guard";

function showOverlay(kind: "changed" | "signed-out"): void {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
        "padding:16px;background:rgba(0,0,0,.85);font-family:system-ui,sans-serif;";

    const box = document.createElement("div");
    box.style.cssText =
        "max-width:380px;width:100%;background:#fff;color:#111;border-radius:12px;padding:24px;text-align:center;";

    const title = document.createElement("p");
    title.style.cssText = "margin:0 0 8px;font-size:18px;font-weight:800;";
    const text = document.createElement("p");
    text.style.cssText = "margin:0 0 20px;font-size:14px;line-height:1.4;color:#444;";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText =
        "padding:10px 22px;border:0;border-radius:8px;background:#facc15;color:#111;font-weight:700;font-size:14px;cursor:pointer;";

    if (kind === "signed-out") {
        title.textContent = "Sesión cerrada";
        text.textContent = "Se cerró la sesión en otra pestaña. Ingresá de nuevo para continuar.";
        btn.textContent = "Ir a iniciar sesión";
        btn.addEventListener("click", () => {
            window.location.href = "/login";
        });
    } else {
        title.textContent = "La sesión cambió";
        text.textContent =
            "Otro usuario inició sesión en este navegador. Esta pantalla ya no corresponde: recargá para continuar con la sesión actual.";
        btn.textContent = "Recargar";
        btn.addEventListener("click", () => {
            window.location.reload();
        });
    }

    box.append(title, text, btn);
    overlay.append(box);
    document.body.append(overlay);
    btn.focus();
}

export function initSessionGuard(): void {
    if (typeof window === "undefined" || window.__bechisSessionGuard) return;

    const expectedId = document.body.dataset.sessionUser;
    // Sin usuario declarado (página pública / login): no hay nada que vigilar.
    if (!expectedId) return;
    window.__bechisSessionGuard = true;

    // Compara la sesión que hay AHORA en las cookies con la de esta pantalla.
    const verify = async (): Promise<void> => {
        if (document.getElementById(OVERLAY_ID)) return;
        try {
            const {
                data: { session },
            } = await supabaseBrowser.auth.getSession();
            if (!session) showOverlay("signed-out");
            else if (session.user.id !== expectedId) showOverlay("changed");
        } catch {
            // Un fallo al leer la sesión no debe tirar abajo la pantalla.
        }
    };

    // Cambios avisados por Supabase (también llegan desde otras pestañas).
    supabaseBrowser.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            showOverlay("signed-out");
        } else if (session && session.user.id !== expectedId) {
            showOverlay("changed");
        }
    });

    // Red de seguridad: al volver a la pestaña o recuperarla del caché "atrás".
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void verify();
    });
    window.addEventListener("focus", () => void verify());
    window.addEventListener("pageshow", (e) => {
        if (e.persisted) void verify();
    });

    void verify();
}