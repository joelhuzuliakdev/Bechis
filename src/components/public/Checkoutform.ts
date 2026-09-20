import { cartItems, cartSubtotal, clearCart, lineTotal, type CartItem } from "@/stores/cart";
import { showToast } from "@/stores/toast";

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

export function attachCheckoutForm(rootId: string, zones: DeliveryZone[]) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const items = cartItems.get();
  if (items.length === 0) {
    window.location.href = "/";
    return;
  }

  const summaryEl = root.querySelector<HTMLElement>("[data-role='order-summary']");
  const subtotalEl = root.querySelector<HTMLElement>("[data-role='subtotal']");
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

  function renderSummary() {
    if (!summaryEl) return;
    summaryEl.innerHTML = cartItems
      .get()
      .map(
        (item: CartItem) => `
        <div class="flex justify-between py-1.5 text-sm">
          <span class="text-text-muted">${item.quantity}× ${escapeHtml(item.productName)}</span>
          <span class="text-text">${money(lineTotal(item))}</span>
        </div>
      `
      )
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
    const deliveryCost = currentDeliveryCost();
    const isEnvio = currentDeliveryType() === "envio";

    if (addressWrapper) addressWrapper.classList.toggle("hidden", !isEnvio);
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (deliveryLineEl) deliveryLineEl.textContent = isEnvio ? money(deliveryCost) : "Retiro en el local — $0";
    if (totalEl) totalEl.textContent = money(subtotal + deliveryCost);
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