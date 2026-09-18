// Notificación breve reutilizable (ej: "✓ Agregado al carrito").
// Depende de que exista el <div id="toast"> que ya está en PublicLayout.astro.

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string) {
    const el = document.getElementById("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.remove("opacity-0", "translate-y-4");
    el.classList.add("opacity-100", "translate-y-0");

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        el.classList.add("opacity-0", "translate-y-4");
        el.classList.remove("opacity-100", "translate-y-0");
    }, 1800);
}