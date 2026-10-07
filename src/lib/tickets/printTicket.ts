// Manda el ticket de una venta a imprimir, sin salir de la pantalla actual.
//
// Carga la página del ticket en un iframe invisible; esa página llama sola a
// window.print() y avisa cuando terminó para que se quite el iframe.
//
// Esto NUNCA puede afectar al cobro: se llama después de que la venta ya
// quedó registrada, y cualquier error se traga acá adentro.
export function printTicket(saleId: string): void {
    try {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;
        // No usar display:none: algunos navegadores imprimen en blanco un iframe oculto así.
        iframe.style.cssText =
            "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
        iframe.src = `/empleado/ticket/${encodeURIComponent(saleId)}?auto=1`;

        let timer = 0;
        const cleanup = () => {
            window.removeEventListener("message", onMessage);
            window.clearTimeout(timer);
            iframe.remove();
        };
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return;
            if (e.source !== iframe.contentWindow) return;
            if (e.data?.type === "bechis-ticket-done") cleanup();
        };

        window.addEventListener("message", onMessage);
        // Por si el aviso nunca llega (error de carga, etc.), se limpia igual.
        timer = window.setTimeout(cleanup, 120_000);
        document.body.appendChild(iframe);
    } catch (err) {
        console.error("No se pudo imprimir el ticket:", err);
    }
}