// Mientras no todos los productos tengan una foto real subida a
// Supabase Storage, mostramos un bloque de color + emoji como
// placeholder. Apenas el producto tenga `image_url`, se usa la foto
// real (ver ProductCard.astro y producto/[id].astro) — esto es
// solo el fallback.

const EMOJI_BY_CATEGORY: Record<string, string> = {
    hamburguesas: "🍔",
    papas: "🍟",
    combos: "🧾",
    gaseosas: "🥤",
    otros: "🍽️",
};

const COLOR_BY_CATEGORY: Record<string, string> = {
    hamburguesas: "#F5E3C8",
    papas: "#FFEAB0",
    combos: "#FFE3A6",
    gaseosas: "#F6CFC9",
    otros: "#F3E0B8",
};

export function getPlaceholderEmoji(categorySlug: string): string {
    return EMOJI_BY_CATEGORY[categorySlug] ?? "🍽️";
}

export function getPlaceholderColor(categorySlug: string): string {
    return COLOR_BY_CATEGORY[categorySlug] ?? "#F5F3EF";
}