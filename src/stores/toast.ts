// Notificación breve reutilizable (ej: "✓ Agregado al carrito",
// "🔔 Nuevo pedido #12"). No depende de que el layout ya tenga un
// <div id="toast"> puesto: si no lo encuentra, lo crea la primera vez
// que se llama, así funciona igual en cualquier página del sitio
// (público o admin) sin tocar los layouts.

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function ensureToastEl(): HTMLElement {
  if (toastEl && document.body.contains(toastEl)) return toastEl;

  const existing = document.getElementById("toast");
  if (existing) {
    toastEl = existing;
    return toastEl;
  }

  const el = document.createElement("div");
  el.id = "toast";
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.bottom = "24px";
  el.style.transform = "translateX(-50%) translateY(16px)";
  el.style.background = "#141414";
  el.style.color = "#fff";
  el.style.padding = "11px 18px";
  el.style.borderRadius = "999px";
  el.style.fontSize = "13.5px";
  el.style.fontWeight = "600";
  el.style.fontFamily = "system-ui, sans-serif";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "nowrap";
  el.style.zIndex = "9999";
  el.style.boxShadow = "0 8px 24px rgba(0,0,0,.3)";
  el.style.transition = "opacity .2s ease, transform .2s ease";
  document.body.appendChild(el);

  toastEl = el;
  return el;
}

export function showToast(message: string) {
  if (typeof document === "undefined") return; // por si se llama fuera del navegador

  const el = ensureToastEl();
  el.textContent = message;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(16px)";
  }, 1800);
}