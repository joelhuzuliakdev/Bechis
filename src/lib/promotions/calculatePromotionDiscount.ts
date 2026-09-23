// Función pura (sin Supabase) para poder usarla TANTO en el servidor
// (api/orders/create.ts, que es quien manda) COMO en el cliente
// (CheckoutForm.ts, solo para mostrar el descuento antes de confirmar).
// Que el cliente calcule lo mismo no es un problema de seguridad: el
// servidor siempre lo recalcula de cero antes de guardar el pedido.

export interface ActivePromotion {
  id: string;
  type: "2x1" | "descuento_porcentual" | "combo";
  discountValue: number;
  productIds: string[];
}

/**
 * Descuento de UNA línea del carrito (un producto x cantidad).
 * Si varias promos activas aplican al mismo producto, se usa la que
 * dé mayor descuento — no se acumulan, para que el resultado sea
 * siempre predecible.
 */
export function computeItemDiscount(
  productId: string,
  quantity: number,
  unitPrice: number,
  activePromotions: ActivePromotion[]
): number {
  const applicable = activePromotions.filter((p) => p.type !== "combo" && p.productIds.includes(productId));
  if (applicable.length === 0) return 0;

  let best = 0;
  for (const promo of applicable) {
    let discount = 0;
    if (promo.type === "descuento_porcentual") {
      discount = Math.round(unitPrice * quantity * (promo.discountValue / 100));
    } else if (promo.type === "2x1") {
      // Cada 2 unidades, 1 sale gratis.
      const freeUnits = Math.floor(quantity / 2);
      discount = freeUnits * unitPrice;
    }
    if (discount > best) best = discount;
  }
  return best;
}

export function computeTotalDiscount(
  items: { productId: string; quantity: number; unitPrice: number }[],
  activePromotions: ActivePromotion[]
): number {
  return items.reduce((sum, item) => sum + computeItemDiscount(item.productId, item.quantity, item.unitPrice, activePromotions), 0);
}