import { z } from "zod";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/format/paymentMethods";

const paymentMethodValues = PAYMENT_METHOD_OPTIONS.map((m) => m.value) as [string, ...string[]];

export const createExpenseCategorySchema = z.object({
    name: z.string().trim().min(2, "El nombre es muy corto").max(60, "El nombre es muy largo"),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const createExpenseSchema = z.object({
    categoryId: z.string().uuid("Elegí una categoría"),
    description: z.string().trim().min(2, "La descripción es muy corta").max(200, "La descripción es muy larga"),
    amount: z.coerce.number().positive("El monto tiene que ser mayor a 0"),
    paymentMethod: z.enum(paymentMethodValues, {
        errorMap: () => ({ message: "Elegí un método de pago válido" }),
    }),
    receiptUrl: z
        .string()
        .trim()
        .url("Tiene que ser un link válido")
        .optional()
        .or(z.literal("").transform(() => undefined)),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;