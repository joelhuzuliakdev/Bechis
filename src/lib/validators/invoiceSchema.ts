import { z } from "zod";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/format/paymentMethods";

const paymentMethodValues = PAYMENT_METHOD_OPTIONS.map((m) => m.value) as [string, ...string[]];

export const createInvoiceSchema = z.object({
  supplierId: z.string().uuid("Elegí un proveedor"),
  invoiceNumber: z.string().trim().min(1, "Ingresá el número de factura").max(60),
  date: z.string().min(1, "Ingresá la fecha de emisión"),
  dueDate: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  detail: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  imageUrl: z
    .string()
    .trim()
    .url("Tiene que ser un link válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  total: z.coerce.number().positive("El importe tiene que ser mayor a 0"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = createInvoiceSchema;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const payInvoiceSchema = z.object({
  categoryId: z.string().uuid("Elegí una categoría de gasto"),
  paymentMethod: z.enum(paymentMethodValues, {
    errorMap: () => ({ message: "Elegí un método de pago válido" }),
  }),
});

export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;