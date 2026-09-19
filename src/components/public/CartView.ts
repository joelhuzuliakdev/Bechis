// El carrito vive en localStorage (ver stores/cart.ts), así que esta
// página no puede traerlo en el frontmatter de Astro (eso corre en el
// servidor, que no tiene acceso al localStorage del navegador). Por
// eso el contenido se arma acá, en el cliente, suscribiéndose al store.

import { cartItems, cartSubtotal, removeFromCart, updateQuantity, lineTotal, type CartItem } from "@/stores/cart";

function money(n: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(n);
}

function renderModifiers(item: CartItem): string {
    const parts: string[] = [];
    item.removedIncluded.forEach((r) => parts.push(`<span class="text-danger">Sin ${escapeHtml(r.name)}</span>`));
    item.addedExtras.forEach((e) => parts.push(`<span class="text-success">+ ${escapeHtml(e.name)}</span>`));
    return parts.length > 0 ? parts.join(" · ") : "Sin modificaciones";
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export function attachCartView(listId: string, summaryId: string, emptyStateId: string) {
    const listEl = document.getElementById(listId);
    const summaryEl = document.getElementById(summaryId);
    const emptyEl = document.getElementById(emptyStateId);
    if (!listEl || !summaryEl || !emptyEl) return;

    function render() {
        const items = cartItems.get();

        if (items.length === 0) {
        listEl!.innerHTML = "";
        summaryEl!.classList.add("hidden");
        emptyEl!.classList.remove("hidden");
        return;
        }

        emptyEl!.classList.add("hidden");
        summaryEl!.classList.remove("hidden");

        listEl!.innerHTML = items
        .map(
            (item) => `
        <div class="rounded-sm border border-surface-line bg-surface p-3.5 shadow-subtle" data-cart-id="${item.cartId}">
            <div class="mb-1.5 flex items-start justify-between gap-2">
            <h4 class="text-[15px] font-semibold text-text">${escapeHtml(item.productName)}</h4>
            <span class="font-display text-[15px] text-text">${money(lineTotal(item))}</span>
            </div>
            <p class="mb-3 text-xs text-text-muted">${renderModifiers(item)}</p>
            <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button type="button" data-action="qty-minus" class="flex h-7 w-7 items-center justify-center rounded-sm border border-ink text-sm font-display">–</button>
                <span class="min-w-[16px] text-center text-sm font-semibold text-text">${item.quantity}</span>
                <button type="button" data-action="qty-plus" class="flex h-7 w-7 items-center justify-center rounded-sm border border-ink text-sm font-display">+</button>
            </div>
            <button type="button" data-action="remove" class="text-xs font-semibold text-danger">Quitar</button>
            </div>
        </div>
        `
        )
        .join("");

        // Delegar los clicks de cada card recién renderizada.
        listEl!.querySelectorAll<HTMLElement>("[data-cart-id]").forEach((card) => {
        const cartId = card.dataset.cartId!;
        const item = items.find((i) => i.cartId === cartId);
        if (!item) return;

        card.querySelector("[data-action='qty-minus']")?.addEventListener("click", () => {
            if (item.quantity <= 1) {
            removeFromCart(cartId);
            } else {
            updateQuantity(cartId, item.quantity - 1);
            }
        });
        card.querySelector("[data-action='qty-plus']")?.addEventListener("click", () => {
            updateQuantity(cartId, item.quantity + 1);
        });
        card.querySelector("[data-action='remove']")?.addEventListener("click", () => {
            removeFromCart(cartId);
        });
        });

        const subtotalEl = summaryEl!.querySelector<HTMLElement>("[data-role='subtotal']");
        const totalEl = summaryEl!.querySelector<HTMLElement>("[data-role='total']");
        const subtotal = cartSubtotal.get();
        if (subtotalEl) subtotalEl.textContent = money(subtotal);
        if (totalEl) totalEl.textContent = money(subtotal); // el envío se define recién en el checkout
    }

    cartItems.subscribe(render);
}