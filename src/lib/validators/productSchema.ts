import { z } from "zod";

export const productIngredientConfigSchema = z.object({
    ingredientId: z.string().uuid(),
    isIncluded: z.boolean().default(false),
    isRemovable: z.boolean().default(true),
    isAddableExtra: z.boolean().default(false),
    priceOverride: z.number().nonnegative().nullable().optional(),
});

export const productSchema = z.object({
    categoryId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    slug: z
        .string()
        .trim()
        .min(2)
        .max(140)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones, sin espacios"),
    description: z.string().trim().max(500).optional(),
    price: z.number().nonnegative(),
    imageUrl: z.string().url().nullable().optional(),
    stock: z.number().nonnegative().default(0),
    minStock: z.number().nonnegative().default(0),
    active: z.boolean().default(true),
    ingredients: z.array(productIngredientConfigSchema).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

// Update parcial: no todos los campos son obligatorios al editar.
export const productUpdateSchema = productSchema.partial();

export const ingredientSchema = z.object({
    name: z.string().trim().min(2).max(80),
    extraPrice: z.number().nonnegative().default(0),
    stock: z.number().nonnegative().default(0),
    minStock: z.number().nonnegative().default(0),
    active: z.boolean().default(true),
});

export const ingredientUpdateSchema = ingredientSchema.partial();