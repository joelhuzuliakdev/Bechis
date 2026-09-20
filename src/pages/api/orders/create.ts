// POST /api/orders/create
//
// Asume que ya existen (si no, avisame y los recreo):
//   src/lib/pricing/calculatePrice.ts        (calculateProductPrice, calculateOrderTotal)
//   src/lib/pricing/fetchProductWithIngredients.ts
//   src/lib/validators/orderSchema.ts        (zod schema)
//   src/lib/supabase/public.ts               (supabasePublic)

import type { APIRoute } from "astro";
import { supabasePublic } from "@/lib/supabase/public";
import { fetchProductWithIngredients } from "@/lib/pricing/fetchProductWithIngredients";
import { calculateProductPrice, calculateOrderTotal } from "@/lib/pricing/calculatePrice";
import { createOrderSchema } from "@/lib/validators/orderSchema";

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Datos inválidos", details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const resolvedItems: {
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    removedIncluded: { ingredientId: string }[];
    appliedExtras: { ingredientId: string; price: number }[];
  }[] = [];

  for (const item of input.items) {
    const product = await fetchProductWithIngredients(supabasePublic, item.productId);
    if (!product) return json({ error: `Producto no disponible: ${item.productId}` }, 400);

    const breakdown = calculateProductPrice(product, {
      removedIngredientIds: item.removedIngredientIds,
      addedExtraIds: item.addedExtraIds,
      quantity: item.quantity,
    });

    resolvedItems.push({
      productId: product.id,
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitPrice: breakdown.unitPrice,
      lineTotal: breakdown.lineTotal,
      removedIncluded: breakdown.removedIncluded.map((r) => ({ ingredientId: r.ingredientId })),
      appliedExtras: breakdown.appliedExtras.map((e) => ({ ingredientId: e.ingredientId, price: e.price })),
    });
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);

  let deliveryCost = 0;
  if (input.deliveryType === "envio") {
    const { data: zone, error: zoneError } = await supabasePublic
      .from("delivery_zones")
      .select("id, price, active")
      .eq("id", input.deliveryZoneId)
      .eq("active", true)
      .maybeSingle();
    if (zoneError || !zone) return json({ error: "Zona de envío inválida" }, 400);
    deliveryCost = zone.price;
  }

  const discount = 0;
  const total = calculateOrderTotal({ subtotal, discount, deliveryCost });

  const { data: order, error: orderError } = await supabasePublic
    .from("orders")
    .insert({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      delivery_type: input.deliveryType,
      address: input.deliveryType === "envio" ? input.address : null,
      delivery_zone_id: input.deliveryType === "envio" ? input.deliveryZoneId : null,
      notes: input.notes ?? null,
      subtotal,
      discount,
      delivery_cost: deliveryCost,
      total,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("Error creando pedido:", orderError?.message);
    return json({ error: "No se pudo crear el pedido" }, 500);
  }

  for (const item of resolvedItems) {
    const { data: orderItem, error: itemError } = await supabasePublic
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.lineTotal,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      console.error("Error creando order_item:", itemError?.message);
      continue;
    }

    const ingredientRows = [
      ...item.removedIncluded.map((r) => ({
        order_item_id: orderItem.id,
        ingredient_id: r.ingredientId,
        action: "quitado" as const,
        price: 0,
      })),
      ...item.appliedExtras.map((e) => ({
        order_item_id: orderItem.id,
        ingredient_id: e.ingredientId,
        action: "agregado" as const,
        price: e.price,
      })),
    ];

    if (ingredientRows.length > 0) {
      const { error: ingError } = await supabasePublic.from("order_item_ingredients").insert(ingredientRows);
      if (ingError) console.error("Error creando order_item_ingredients:", ingError.message);
    }
  }

  return json({ orderId: order.id, orderNumber: order.order_number, subtotal, deliveryCost, discount, total });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}