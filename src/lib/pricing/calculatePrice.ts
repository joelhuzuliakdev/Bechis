// Regla de negocio (del brief de Bechis):
//
//   - Un ingrediente que viene INCLUIDO se puede sacar sin que cambie
//     el precio. Ejemplo: hamburguesa $10.000, sacar cebolla y tomate
//     -> sigue costando $10.000.
//   - Un ingrediente EXTRA que se agrega SIEMPRE suma su precio.
//     Ejemplo: hamburguesa $10.000 + cheddar $1.000 + bacon $1.500
//     -> $12.500.
//
// Esta función se usa en dos lugares distintos y ESO ES A PROPÓSITO:
//
//   1. En el navegador (ProductCustomizer.ts), para mostrar el precio
//      en vivo mientras el cliente arma su hamburguesa.
//   2. En el servidor (api/orders/create.ts), para recalcular el precio
//      real ANTES de guardar el pedido — nunca confiamos en un precio
//      que venga del cliente, porque alguien podría manipular el
//      request y mandar un total más bajo del que corresponde.

import type { ProductSelection, ProductWithIngredients } from "@/types";

export interface PriceBreakdown {
    /** Precio de una unidad, ya con los extras aplicados. */
    unitPrice: number;
    /** Precio total de la línea (unitPrice * quantity). */
    lineTotal: number;
    /** Extras efectivamente aplicados (ya validados contra el producto). */
    appliedExtras: { ingredientId: string; name: string; price: number }[];
    /** Ingredientes incluidos que se sacaron (informativo, precio 0). */
    removedIncluded: { ingredientId: string; name: string }[];
}

/**
 * Calcula el precio de un producto ya personalizado, validando la
 * selección contra la configuración real del producto (no confía en
 * que el llamador haya mandado solo ids válidos).
 */
export function calculateProductPrice(
    product: ProductWithIngredients,
    selection: Pick<ProductSelection, "removedIngredientIds" | "addedExtraIds" | "quantity">
    ): PriceBreakdown {
    const byId = new Map(product.ingredients.map((i) => [i.ingredient_id, i]));

    const removedIncluded = selection.removedIngredientIds
        .map((id) => byId.get(id))
        .filter((ing): ing is NonNullable<typeof ing> => {
        // Solo es válido sacar algo que: existe, viene incluido, y es removible.
        return !!ing && ing.is_included && ing.is_removable;
        })
        .map((ing) => ({ ingredientId: ing.ingredient_id, name: ing.ingredient_name }));

    const appliedExtras = selection.addedExtraIds
        .map((id) => byId.get(id))
        .filter((ing): ing is NonNullable<typeof ing> => {
        // Solo es válido agregar algo marcado explícitamente como extra addable.
        return !!ing && ing.is_addable_extra;
        })
        .map((ing) => ({
        ingredientId: ing.ingredient_id,
        name: ing.ingredient_name,
        price: ing.extra_price,
        }));

    const extrasTotal = appliedExtras.reduce((sum, ex) => sum + ex.price, 0);
    const unitPrice = product.price + extrasTotal;
    const quantity = Math.max(1, Math.floor(selection.quantity || 1));

    return {
        unitPrice,
        lineTotal: unitPrice * quantity,
        appliedExtras,
        removedIncluded,
    };
}

/**
 * Aplica una promoción simple de descuento porcentual sobre un subtotal.
 * (2x1 y combos se resuelven a nivel de qué productos entran al carrito,
 * no acá; esto cubre el caso más común: "20% OFF".)
 */
export function applyPercentageDiscount(subtotal: number, percentage: number): number {
    if (percentage <= 0) return 0;
    return Math.round(subtotal * (percentage / 100));
}

export function calculateOrderTotal(params: {
    subtotal: number;
    discount: number;
    deliveryCost: number;
    }): number {
    const total = params.subtotal - params.discount + params.deliveryCost;
    return Math.max(0, Math.round(total));
}