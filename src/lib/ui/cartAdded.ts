// Deja un "recado" entre la página del producto y el catálogo:
// "recién se agregó este producto al carrito". El catálogo lo lee una sola vez
// al cargar y, según corresponda, muestra la ventana con el resumen del carrito.
//
// Se guarda en sessionStorage (dura solo mientras la pestaña está abierta) y
// vence a los 60 segundos, así nunca aparece una ventana vieja por error.

const KEY = "bechis_just_added";

export interface JustAdded {
    productId: string;
    name: string;
    /** unidades que se agregaron en esta acción */
    qty: number;
    /** unidades que ya tenía el carrito antes de agregar */
    countBefore: number;
    at: number;
}

export function markJustAdded(info: Omit<JustAdded, "at">) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...info, at: Date.now() }));
    } catch {
        // Sin sessionStorage (modo privado, etc.): el carrito igual se agrega, solo no sale la ventana.
    }
}

/** Devuelve el recado una sola vez y lo borra. null si no hay o ya venció. */
export function consumeJustAdded(maxAgeMs = 60_000): JustAdded | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return null;
        sessionStorage.removeItem(KEY);
        const parsed = JSON.parse(raw) as JustAdded;
        if (!parsed || typeof parsed.at !== "number" || Date.now() - parsed.at > maxAgeMs) return null;
        return parsed;
    } catch {
        return null;
    }
}