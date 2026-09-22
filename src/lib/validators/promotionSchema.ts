import { z } from "zod";

export const promotionSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(300).optional(),
    type: z.enum(["2x1", "descuento_porcentual", "combo"]),
    discountValue: z.number().nonnegative().default(0),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    active: z.boolean().default(false),
    productIds: z.array(z.string().uuid()).default([]),
});

export type PromotionInput = z.infer<typeof promotionSchema>;