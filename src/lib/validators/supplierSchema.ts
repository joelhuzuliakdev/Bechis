import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  company: optionalTrimmed(120),
  phone: optionalTrimmed(40),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  cuit: optionalTrimmed(20),
  address: optionalTrimmed(200),
  notes: optionalTrimmed(500),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

// Usado para el PATCH: permite mandar solo algunos campos (por ejemplo,
// solo { active: false } al desactivar un proveedor desde el listado).
export const supplierPatchSchema = supplierSchema.partial().extend({
  active: z.boolean().optional(),
});

export type SupplierPatchInput = z.infer<typeof supplierPatchSchema>;