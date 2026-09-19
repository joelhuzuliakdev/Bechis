// Validación de lo que llega desde el navegador al crear un pedido.
// Esto NO reemplaza el recálculo de precios en el servidor (eso vive
// en api/orders/create.ts) — esto solo garantiza que la forma de los
// datos sea la esperada antes de tocar la base.

import { z } from "zod";

export const orderItemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
    removedIngredientIds: z.array(z.string().uuid()).default([]),
    addedExtraIds: z.array(z.string().uuid()).default([]),
});

export const createOrderSchema = z
    .object({
        customerName: z.string().trim().min(2, "El nombre es muy corto").max(120),
        customerPhone: z.string().trim().min(6, "Teléfono inválido").max(30),
        deliveryType: z.enum(["retiro", "envio"]),
        address: z.string().trim().max(300).optional(),
        deliveryZoneId: z.string().uuid().optional(),
        notes: z.string().trim().max(500).optional(),
        items: z.array(orderItemSchema).min(1, "El carrito está vacío"),
    })
    .refine(
        (val) => val.deliveryType !== "envio" || (!!val.address && !!val.deliveryZoneId),
        {
        message: "Si el pedido es con envío, la dirección y la zona son obligatorias",
        path: ["address"],
        }
    );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;