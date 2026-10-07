import { z } from "zod";

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

export const categoryCreateSchema = z.object({
    name: z.string().trim().min(2, "El nombre es muy corto").max(40, "El nombre es muy largo"),
    iconEmoji: z.string().trim().min(1, "Elegí un emoji").max(16),
    accentColor: hexColor,
});

export const categoryUpdateSchema = z.object({
    name: z.string().trim().min(2, "El nombre es muy corto").max(40, "El nombre es muy largo").optional(),
    iconEmoji: z.string().trim().min(1).max(16).optional(),
    accentColor: hexColor.optional(),
    active: z.boolean().optional(),
});

export const categoryReorderSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
});

// "Postres Fríos" -> "postres-frios". Sin tildes ni símbolos.
export function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}