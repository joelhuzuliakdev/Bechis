import { cartItems, cartSubtotal, clearCart, lineTotal, type CartItem } from "@/stores/cart";
import { showToast } from "@/stores/toast";
import { computeItemDiscount, type ActivePromotion } from "@/lib/promotions/calculatePromotionDiscount";

function money(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

interface DeliveryZone {
  id: string;
  name: string;
  price: number;
}

function promoLabel(promo: ActivePromotion): string {
  if (promo.type === "descuento_porcentual") return `Descuento promo ${promo.discountValue}%`;
  if (promo.type === "2x1") return "Promo 2x1";
  return "Promo";
}

/** La promo que efectivamente se aplicó a este item (la de mayor ahorro), o null si ninguna. */
function bestPromoForItem(item: CartItem, activePromotions: ActivePromotion[]): ActivePromotion | null {
  const applicable = activePromotions.filter((p) => p.type !== "combo" && p.productIds.includes(item.productId));
  if (applicable.length === 0) return null;

  let best: ActivePromotion | null = null;
  let bestDiscount = 0;
  for (const promo of applicable) {
    const discount = computeItemDiscount(item.productId, item.quantity, item.unitPrice, [promo]);
    if (discount > bestDiscount) {
      bestDiscount = discount;
      best = promo;
    }
  }
  return bestDiscount > 0 ? best : null;
}

export function attachCheckoutForm(rootId: string, zones: DeliveryZone[], activePromotions: ActivePromotion[] = []) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const items = cartItems.get();
  if (items.length === 0) {
    window.location.href = "/";
    return;
  }

  const summaryEl = root.querySelector<HTMLElement>("[data-role='order-summary']");
  const subtotalEl = root.querySelector<HTMLElement>("[data-role='subtotal']");
  const discountRowEl = root.querySelector<HTMLElement>("[data-role='discount-row']");
  const discountLabelEl = root.querySelector<HTMLElement>("[data-role='discount-label']");
  const discountAmountEl = root.querySelector<HTMLElement>("[data-role='discount-amount']");
  const deliveryLineEl = root.querySelector<HTMLElement>("[data-role='delivery-line']");
  const totalEl = root.querySelector<HTMLElement>("[data-role='total']");
  const addressWrapper = root.querySelector<HTMLElement>("[data-role='address-wrapper']");
  const submitBtn = root.querySelector<HTMLButtonElement>("[data-role='submit']");
  const errorEl = root.querySelector<HTMLElement>("[data-role='form-error']");

  const nameInput = root.querySelector<HTMLInputElement>("[name='customerName']");
  const phoneInput = root.querySelector<HTMLInputElement>("[name='customerPhone']");
  const addressInput = root.querySelector<HTMLInputElement>("[name='address']");
  const zoneSelect = root.querySelector<HTMLSelectElement>("[name='deliveryZoneId']");
  const notesInput = root.querySelector<HTMLTextAreaElement>("[name='notes']");
  const deliveryRadios = root.querySelectorAll<HTMLInputElement>("[name='deliveryType']");

  function totalDiscount(): number {
    return cartItems
      .get()
      .reduce((sum, item) => sum + computeItemDiscount(item.productId, item.quantity, item.unitPrice, activePromotions), 0);
  }

  function renderSummary() {
    if (!summaryEl) return;
    summaryEl.innerHTML = cartItems
      .get()
      .map((item: CartItem) => {
        const originalPrice = lineTotal(item);
        const promo = bestPromoForItem(item, activePromotions);
        const discount = promo ? computeItemDiscount(item.productId, item.quantity, item.unitPrice, [promo]) : 0;

        if (!promo || discount <= 0) {
          return `
            <div class="flex justify-between py-1.5 text-sm">
              <span class="text-text-muted">${item.quantity}× ${escapeHtml(item.productName)}</span>
              <span class="text-text">${money(originalPrice)}</span>
            </div>
          `;
        }

        // Con descuento: precio original, la promo aplicada, y el
        // precio final de esta línea — igual al formato pedido:
        // Hamburguesa Bechis  $15.000
        // Descuento promo 20% -$3.000
        // Precio              $12.000
        return `
          <div class="border-b border-surface-line py-1.5 last:border-b-0">
            <div class="flex justify-between text-sm">
              <span class="text-text-muted">${item.quantity}× ${escapeHtml(item.productName)}</span>
              <span class="text-text-muted line-through">${money(originalPrice)}</span>
            </div>
            <div class="flex justify-between text-xs text-success">
              <span>${escapeHtml(promoLabel(promo))}</span>
              <span>-${money(discount)}</span>
            </div>
            <div class="flex justify-between text-sm font-semibold">
              <span class="text-text">Precio</span>
              <span class="text-text">${money(originalPrice - discount)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function currentDeliveryType(): "retiro" | "envio" {
    const checked = Array.from(deliveryRadios).find((r) => r.checked);
    return (checked?.value as "retiro" | "envio") ?? "retiro";
  }

  function currentDeliveryCost(): number {
    if (currentDeliveryType() !== "envio") return 0;
    const zone = zones.find((z) => z.id === zoneSelect?.value);
    return zone?.price ?? 0;
  }

  function updateTotals() {
    const subtotal = cartSubtotal.get();
    const discount = totalDiscount();
    const deliveryCost = currentDeliveryCost();
    const isEnvio = currentDeliveryType() === "envio";

    if (addressWrapper) addressWrapper.classList.toggle("hidden", !isEnvio);
    if (subtotalEl) subtotalEl.textContent = money(subtotal);

    if (discountRowEl) {
      discountRowEl.style.display = discount > 0 ? "flex" : "none";
    }
    if (discount > 0 && discountAmountEl) discountAmountEl.textContent = `-${money(discount)}`;

    if (deliveryLineEl) deliveryLineEl.textContent = isEnvio ? money(deliveryCost) : "Retiro en el local — $0";
    if (totalEl) totalEl.textContent = money(Math.max(0, subtotal - discount) + deliveryCost);
  }

  deliveryRadios.forEach((radio) => radio.addEventListener("change", updateTotals));
  zoneSelect?.addEventListener("change", updateTotals);

  submitBtn?.addEventListener("click", async () => {
    if (errorEl) errorEl.textContent = "";

    const deliveryType = currentDeliveryType();
    const customerName = nameInput?.value.trim() ?? "";
    const customerPhone = phoneInput?.value.trim() ?? "";
    const address = addressInput?.value.trim() ?? "";
    const deliveryZoneId = zoneSelect?.value ?? "";
    const notes = notesInput?.value.trim() ?? "";

    if (customerName.length < 2 || customerPhone.length < 6) {
      showFormError("Completá tu nombre y teléfono.");
      return;
    }
    if (deliveryType === "envio" && (!address || !deliveryZoneId)) {
      showFormError("Completá la dirección y elegí una zona de envío.");
      return;
    }

    const payload = {
      customerName,
      customerPhone,
      deliveryType,
      address: deliveryType === "envio" ? address : undefined,
      deliveryZoneId: deliveryType === "envio" ? deliveryZoneId : undefined,
      notes: notes || undefined,
      items: cartItems.get().map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        removedIngredientIds: item.removedIncluded.map((r) => r.ingredientId),
        addedExtraIds: item.addedExtras.map((e) => e.ingredientId),
      })),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando pedido...";

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        showFormError(result.error ?? "No pudimos crear tu pedido. Probá de nuevo.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar pedido";
        return;
      }

      sessionStorage.setItem(
        "bechis_last_order",
        JSON.stringify({ ...result, customerName, deliveryType, items: cartItems.get() })
      );

      clearCart();
      window.location.href = `/pedido/${result.orderId}/confirmacion`;
    } catch {
      showFormError("Error de conexión. Probá de nuevo.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirmar pedido";
    }
  });

  function showFormError(message: string) {
    if (errorEl) errorEl.textContent = message;
    showToast(message);
  }

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  renderSummary();
  updateTotals();
}