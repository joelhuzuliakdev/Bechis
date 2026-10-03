// Estados del pedido y transiciones válidas entre ellos. Centralizado
// acá para que el endpoint de cambio de estado y el tablero Kanban usen
// siempre la misma regla — evita que uno permita algo que el otro no.

export type OrderStatus =
  | "pedidos"
  | "confirmado"
  | "en_proceso"
  | "listo_para_retirar"
  | "finalizado"
  | "cancelado";

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pedidos",
  "confirmado",
  "en_proceso",
  "listo_para_retirar",
  "finalizado",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pedidos: "Pedidos",
  confirmado: "Confirmado",
  en_proceso: "En Proceso",
  listo_para_retirar: "Listo para retirar",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// Columnas que se muestran en el tablero Kanban, en orden. "cancelado"
// NO es una columna — es una acción disponible desde cualquier tarjeta
// (ver CANCELABLE_FROM), y los pedidos cancelados se consultan aparte
// en el historial, no se mezclan con los activos.
export const KANBAN_COLUMNS: OrderStatus[] = [
  "pedidos",
  "confirmado",
  "en_proceso",
  "listo_para_retirar",
  "finalizado",
];

// Transiciones "de avance" permitidas (botón normal de mover de columna).
const FORWARD_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pedidos: ["confirmado"],
  confirmado: ["en_proceso"],
  en_proceso: ["listo_para_retirar"],
  listo_para_retirar: ["finalizado"],
  finalizado: [],
  cancelado: [],
};

// Desde qué estados se puede cancelar un pedido. Una vez finalizado o
// ya cancelado, no se puede cancelar.
const CANCELABLE_FROM: OrderStatus[] = ["pedidos", "confirmado", "en_proceso", "listo_para_retirar"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "cancelado") {
    return CANCELABLE_FROM.includes(from);
  }
  return FORWARD_TRANSITIONS[from]?.includes(to) ?? false;
}

// Qué columna de timestamp corresponde actualizar al entrar a cada estado.
export function timestampColumnFor(status: OrderStatus): string | null {
  switch (status) {
    case "confirmado":
      return "accepted_at";
    case "listo_para_retirar":
      return "ready_at";
    case "finalizado":
      return "delivered_at";
    case "cancelado":
      return "cancelled_at";
    default:
      return null;
  }
}