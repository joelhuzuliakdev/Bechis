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
  return `<button type="button" disabled class="mt-3 w-full rounded-md bg-gray-100 px-3 py-2 text-xs font-bold text-gray-400">Cobrar (próximamente)</button>`;
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

  return card;
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

export function attachKanbanBoard(initialOrdersJson: string) {
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
      const res = await fetch(`/api/orders/${payload.new.id}`);
      if (!res.ok) return;
      const order: OrderCardData = await res.json();
      moveCard(order, existingEl ?? undefined);
    })
    .subscribe();
}