// Estado del carrito, compartido entre componentes de la parte pública
// (ProductCard, CartDrawer, checkout) sin necesidad de React/Vue.
//
// nanostores pesa ~1kb y se puede usar desde cualquier <script> de
// Astro o desde un archivo .ts de una isla puntual — por eso lo
// elegimos en vez de traer un framework de UI completo solo para el
// carrito.

import { persistentAtom } from "@nanostores/persistent";
import { computed } from "nanostores";

export interface CartItemIngredientRef {
    ingredientId: string;
    name: string;
}

export interface CartItemExtraRef extends CartItemIngredientRef {
    price: number;
}

export interface CartItem {
    cartId: string; // id local, único por línea del carrito (no es el id de producto)
    productId: string;
    productName: string;
    /** precio unitario YA calculado (base + extras) al momento de agregar */
    unitPrice: number;
    quantity: number;
    removedIncluded: CartItemIngredientRef[];
    addedExtras: CartItemExtraRef[];
}

function encode(items: CartItem[]): string {
    return JSON.stringify(items);
}

function decode(raw: string): CartItem[] {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// persistentAtom guarda automáticamente en localStorage y sincroniza
// entre pestañas abiertas del mismo navegador.
export const cartItems = persistentAtom<CartItem[]>("bechis_cart", [], {
    encode,
    decode,
});

function generateCartId(): string {
    return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function addToCart(item: Omit<CartItem, "cartId">) {
    const current = cartItems.get();
    cartItems.set([...current, { ...item, cartId: generateCartId() }]);
}

export function removeFromCart(cartId: string) {
    cartItems.set(cartItems.get().filter((i) => i.cartId !== cartId));
}

export function updateQuantity(cartId: string, quantity: number) {
    const safeQty = Math.max(1, Math.floor(quantity));
    cartItems.set(
        cartItems.get().map((i) => (i.cartId === cartId ? { ...i, quantity: safeQty } : i))
    );
}

export function clearCart() {
    cartItems.set([]);
}

export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity;
}

// Stores derivados: se recalculan solos cada vez que cambia cartItems,
// y cualquier componente que los "escuche" se actualiza automático.
export const cartCount = computed(cartItems, (items) =>
    items.reduce((sum, i) => sum + i.quantity, 0)
);

export const cartSubtotal = computed(cartItems, (items) =>
    items.reduce((sum, i) => sum + lineTotal(i), 0)
);