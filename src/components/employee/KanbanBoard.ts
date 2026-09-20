import { supabaseBrowser } from "@/lib/supabase/client";
import { showToast } from "@/stores/toast"; // AJUSTAR si tu export real está en otro lado
import type { OrderCardData } from "@/lib/orders/fetchOrders";

const STATUS_TO_COLUMN: Record<string, string> = {
  pedidos: "column-pedidos",
  en_proceso: "column-en_proceso",
  finalizado: "column-finalizado",
};

function money(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderItemsHtml(order: OrderCardData): string {
  return order.items
    .map((item) => {
      const removedHtml = item.removed.map((n) => `<div class="text-xs text-red-600">✕ ${escapeHtml(n)}</div>`).join("");
      const addedHtml = item.added.map((e) => `<div class="text-xs text-green-600">✓ ${escapeHtml(e.name)}</div>`).join("");
      return `<div class="mb-1.5"><p class="text-sm font-medium text-gray-800">${item.quantity}x ${escapeHtml(item.productName)}</p>${removedHtml}${addedHtml}</div>`;
    })
    .join("");
}

function renderDeliveryHtml(order: OrderCardData): string {
  if (order.deliveryType === "envio") {
    return `<p class="text-xs text-gray-500">🚚 Envío${order.deliveryZoneName ? " — " + escapeHtml(order.deliveryZoneName) : ""}</p>${order.address ? `<p class="text-xs text-gray-500">${escapeHtml(order.address)}</p>` : ""}`;
  }
  return `<p class="text-xs text-gray-500">🏪 Retiro en el local</p>`;
}

function renderActionButton(order: OrderCardData): string {
  if (order.status === "pedidos") {
    return `<button type="button" data-action="advance" data-next="en_proceso" class="mt-3 w-full rounded-md bg-bechis-yellow px-3 py-2 text-xs font-bold text-ink">En Proceso</button>`;
  }
  if (order.status === "en_proceso") {
    return `<button type="button" data-action="advance" data-next="finalizado" class="mt-3 w-full rounded-md bg-gray-900 px-3 py-2 text-xs font-bold text-white">Finalizar</button>`;
  }
  if (order.paymentStatus === "cobrado") {
    return `<div class="mt-3 w-full rounded-md bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-700">✓ Cobrado</div>`;
  }
  return `<button type="button" data-action="cobrar" class="mt-3 w-full rounded-md bg-bechis-yellow px-3 py-2 text-xs font-bold text-ink">Cobrar / Pasar a venta</button>`;
}

function buildCardEl(order: OrderCardData): HTMLElement {
  const card = document.createElement("div");
  card.dataset.orderId = order.id;
  card.className = "mb-3 rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm";
  card.innerHTML = `
    <div class="mb-2 flex items-start justify-between">
      <span class="text-sm font-bold text-gray-900">Pedido #${order.orderNumber}</span>
      <span class="font-display text-sm text-gray-900">${money(order.total)}</span>
    </div>
    <p class="mb-0.5 text-xs text-gray-600">${escapeHtml(order.customerName)}</p>
    <p class="mb-2 text-xs text-gray-400">${escapeHtml(order.customerPhone)}</p>
    <div class="mb-2 border-t border-gray-100 pt-2">${renderItemsHtml(order)}</div>
    <div class="mb-1 border-t border-gray-100 pt-2">${renderDeliveryHtml(order)}</div>
    ${renderActionButton(order)}
  `;

  card.querySelector("[data-action='advance']")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const next = btn.dataset.next as string;
    btn.disabled = true;
    btn.textContent = "Moviendo...";

    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    if (!res.ok) {
      showToast("No se pudo mover el pedido. Probá de nuevo.");
      btn.disabled = false;
      btn.textContent = next === "en_proceso" ? "En Proceso" : "Finalizar";
      return;
    }
    order.status = next as OrderCardData["status"];
    moveCard(order, card);
  });

  card.querySelector("[data-action='cobrar']")?.addEventListener("click", () => {
    openCobrarModal(order, card);
  });

  return card;
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "qr", label: "QR" },
  { value: "debito", label: "Tarjeta de débito" },
  { value: "credito", label: "Tarjeta de crédito" },
];

function openCobrarModal(order: OrderCardData, cardEl: HTMLElement) {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
  overlay.innerHTML = `
    <div class="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
      <h3 class="mb-1 text-base font-bold text-gray-900">Cobrar pedido #${order.orderNumber}</h3>
      <p class="mb-4 text-sm text-gray-500">Total: <span class="font-bold text-gray-900">${money(order.total)}</span></p>

      <label class="mb-1 block text-xs font-medium text-gray-500">Método de pago</label>
      <select data-role="method" class="mb-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
        ${PAYMENT_METHODS.map((m) => `<option value="${m.value}">${m.label}</option>`).join("")}
      </select>

      <div data-role="cash-fields" class="mb-3">
        <label class="mb-1 block text-xs font-medium text-gray-500">Monto recibido</label>
        <input data-role="received" type="number" min="0" step="1" class="mb-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="${order.total}" />
        <p class="text-xs text-gray-500">Vuelto: <span data-role="change">$0</span></p>
      </div>

      <p data-role="modal-error" class="mb-2 text-xs text-red-600"></p>

      <div class="flex gap-2">
        <button data-role="cancel" type="button" class="flex-1 rounded-md border border-gray-200 py-2.5 text-sm font-semibold text-gray-600">Cancelar</button>
        <button data-role="confirm" type="button" class="flex-1 rounded-md bg-bechis-yellow py-2.5 text-sm font-bold text-ink">Confirmar cobro</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const methodSelect = overlay.querySelector<HTMLSelectElement>("[data-role='method']")!;
  const cashFields = overlay.querySelector<HTMLElement>("[data-role='cash-fields']")!;
  const receivedInput = overlay.querySelector<HTMLInputElement>("[data-role='received']")!;
  const changeEl = overlay.querySelector<HTMLElement>("[data-role='change']")!;
  const errorEl = overlay.querySelector<HTMLElement>("[data-role='modal-error']")!;
  const confirmBtn = overlay.querySelector<HTMLButtonElement>("[data-role='confirm']")!;

  function toggleCashFields() {
    cashFields.classList.toggle("hidden", methodSelect.value !== "efectivo");
  }
  function updateChange() {
    const received = Number(receivedInput.value || 0);
    changeEl.textContent = money(Math.max(0, received - order.total));
  }

  methodSelect.addEventListener("change", toggleCashFields);
  receivedInput.addEventListener("input", updateChange);
  toggleCashFields();
  updateChange();

  overlay.querySelector("[data-role='cancel']")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  confirmBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Cobrando...";

    const paymentMethod = methodSelect.value;
    const receivedAmount = paymentMethod === "efectivo" ? Number(receivedInput.value || 0) : undefined;

    if (paymentMethod === "efectivo" && (!receivedAmount || receivedAmount < order.total)) {
      errorEl.textContent = "El monto recibido debe ser al menos el total.";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirmar cobro";
      return;
    }

    const res = await fetch(`/api/orders/${order.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod, receivedAmount, discount: 0 }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      errorEl.textContent = result.error ?? "No se pudo cobrar el pedido.";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirmar cobro";
      return;
    }

    order.paymentStatus = "cobrado";
    cardEl.remove();
    updateColumnCounts();
    showToast(`✓ Venta registrada — Pedido #${order.orderNumber}`);
    overlay.remove();
  });
}

function moveCard(order: OrderCardData, existingEl?: HTMLElement) {
  const column = document.getElementById(STATUS_TO_COLUMN[order.status]);
  if (!column) return;
  const fresh = buildCardEl(order);
  if (existingEl) existingEl.replaceWith(fresh);
  column.prepend(fresh);
  updateColumnCounts();
}

function updateColumnCounts() {
  Object.values(STATUS_TO_COLUMN).forEach((columnId) => {
    const column = document.getElementById(columnId);
    const countEl = document.querySelector(`[data-count-for='${columnId}']`);
    if (column && countEl) countEl.textContent = String(column.children.length);
  });
}

export async function attachKanbanBoard(initialOrdersJson: string) {
  let initialOrders: OrderCardData[] = [];
  try {
    initialOrders = JSON.parse(initialOrdersJson);
  } catch {
    initialOrders = [];
  }

  initialOrders.forEach((order) => {
    document.getElementById(STATUS_TO_COLUMN[order.status])?.appendChild(buildCardEl(order));
  });
  updateColumnCounts();

  // Clave: sin esto, la conexión de Realtime puede quedar "anónima"
  // a los ojos de la RLS (orders_staff_select exige current_user_is_staff()),
  // y entonces no llega NINGÚN evento, sin ningún error visible.
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  if (session) {
    supabaseBrowser.realtime.setAuth(session.access_token);
  }

  supabaseBrowser
    .channel("orders-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
      const res = await fetch(`/api/orders/${payload.new.id}`);
      if (!res.ok) return;
      const order: OrderCardData = await res.json();
      moveCard(order);
      showToast(`🔔 Nuevo pedido #${order.orderNumber}`);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async (payload) => {
      const existingEl = document.querySelector<HTMLElement>(`[data-order-id='${payload.new.id}']`);

      if (payload.new.payment_status === "cobrado") {
        existingEl?.remove();
        updateColumnCounts();
        return;
      }

      const res = await fetch(`/api/orders/${payload.new.id}`);
      if (!res.ok) return;
      const order: OrderCardData = await res.json();
      moveCard(order, existingEl ?? undefined);
    })
    .subscribe();
}