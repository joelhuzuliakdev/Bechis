// Da vida al HTML que ya arma producto/[id].astro: toggles de
// ingredientes incluidos, checkboxes de extras, precio en vivo, y
// agregar al carrito. Depende de que la página incluya un
// <script type="application/json" id="{rootId}-data"> con el producto
// (id, price, ingredients[]) — así no hace falta pedirlo de nuevo por
// fetch al navegador.

import type { ProductWithIngredients } from "@/types";
import { calculateProductPrice } from "@/lib/pricing/calculatePrice";
import { addToCart } from "@/stores/cart";
import { showToast } from "@/stores/toast"; // AJUSTAR si tu export real está en otro lado

interface CustomizerState {
  removedIds: Set<string>;
  addedExtraIds: Set<string>;
  quantity: number;
}

export function attachProductCustomizer(rootId: string) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const dataEl = document.getElementById(`${rootId}-data`);
  if (!dataEl || !dataEl.textContent) return;

  const product: ProductWithIngredients = JSON.parse(dataEl.textContent);
  const categorySlug = root.dataset.categorySlug ?? "";

  const state: CustomizerState = {
    removedIds: new Set(),
    addedExtraIds: new Set(),
    quantity: 1,
  };

  const priceLabel = root.querySelector<HTMLElement>("[data-role='add-price']");
  const qtyLabel = root.querySelector<HTMLElement>("[data-role='qty-value']");

  function updatePrice() {
    const breakdown = calculateProductPrice(product, {
      removedIngredientIds: Array.from(state.removedIds),
      addedExtraIds: Array.from(state.addedExtraIds),
      quantity: state.quantity,
    });
    if (priceLabel) {
      priceLabel.textContent = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(breakdown.lineTotal);
    }
  }

  // --- Ingredientes incluidos: toggle "quitar" ---
  root.querySelectorAll<HTMLButtonElement>("[data-role='toggle-remove']").forEach((btn) => {
    const ingredientId = btn.dataset.ingredientId!;
    const nameEl = root.querySelector(`[data-ingredient-name='${ingredientId}']`);

    btn.addEventListener("click", () => {
      const isRemoved = state.removedIds.has(ingredientId);
      if (isRemoved) {
        state.removedIds.delete(ingredientId);
      } else {
        state.removedIds.add(ingredientId);
      }
      btn.classList.toggle("bg-success", isRemoved);
      btn.classList.toggle("bg-surface-line", !isRemoved);
      const knob = btn.querySelector<HTMLElement>("[data-role='knob']");
      if (knob) knob.style.left = isRemoved ? "2px" : "20px";
      nameEl?.classList.toggle("line-through", !isRemoved);
      nameEl?.classList.toggle("text-text-muted", !isRemoved);
      updatePrice();
    });
  });

  // --- Extras: checkbox agregar ---
  root.querySelectorAll<HTMLButtonElement>("[data-role='toggle-extra']").forEach((btn) => {
    const ingredientId = btn.dataset.ingredientId!;
    const box = btn.querySelector<HTMLElement>("[data-role='checkbox']");

    btn.addEventListener("click", () => {
      const isAdded = state.addedExtraIds.has(ingredientId);
      if (isAdded) {
        state.addedExtraIds.delete(ingredientId);
      } else {
        state.addedExtraIds.add(ingredientId);
      }
      box?.classList.toggle("bg-ink", !isAdded);
      box?.classList.toggle("border-ink", !isAdded);
      if (box) box.textContent = isAdded ? "" : "✓";
      updatePrice();
    });
  });

  // --- Cantidad ---
  root.querySelector("[data-role='qty-minus']")?.addEventListener("click", () => {
    if (state.quantity <= 1) return;
    state.quantity--;
    if (qtyLabel) qtyLabel.textContent = String(state.quantity);
    updatePrice();
  });

  root.querySelector("[data-role='qty-plus']")?.addEventListener("click", () => {
    state.quantity++;
    if (qtyLabel) qtyLabel.textContent = String(state.quantity);
    updatePrice();
  });

  // --- Agregar al carrito ---
  root.querySelector("[data-role='add-to-cart']")?.addEventListener("click", () => {
    const breakdown = calculateProductPrice(product, {
      removedIngredientIds: Array.from(state.removedIds),
      addedExtraIds: Array.from(state.addedExtraIds),
      quantity: state.quantity,
    });

    addToCart({
      productId: product.id,
      productName: product.name,
      unitPrice: breakdown.unitPrice,
      quantity: state.quantity,
      removedIncluded: breakdown.removedIncluded.map((r) => ({
        ingredientId: r.ingredientId,
        name: r.name,
      })),
      addedExtras: breakdown.appliedExtras.map((e) => ({
        ingredientId: e.ingredientId,
        name: e.name,
        price: e.price,
      })),
    });

    showToast("✓ Agregado al carrito");
    setTimeout(() => {
      window.location.href = categorySlug ? `/categoria/${categorySlug}` : "/";
    }, 500);
  });

  updatePrice();
}