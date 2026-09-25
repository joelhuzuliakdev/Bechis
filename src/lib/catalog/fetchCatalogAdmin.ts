import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminProductListItem {
    id: string;
    name: string;
    categoryName: string;
    price: number;
    stock: number;
    minStock: number;
    active: boolean;
    imageUrl: string | null;
}

export interface ProductIngredientConfig {
    ingredientId: string;
    ingredientName: string;
    isIncluded: boolean;
    isRemovable: boolean;
    isAddableExtra: boolean;
    priceOverride: number | null;
}

export interface AdminProductDetail {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    stock: number;
    minStock: number;
    active: boolean;
    ingredients: ProductIngredientConfig[];
}

export interface CategoryOption {
    id: string;
    name: string;
}

export interface GlobalIngredient {
    id: string;
    name: string;
    extraPrice: number;
    stock: number;
    minStock: number;
    active: boolean;
}

export async function listProductsAdmin(client: SupabaseClient): Promise<AdminProductListItem[]> {
    const { data, error } = await client
        .from("products")
        .select("id, name, price, stock, min_stock, active, image_url, categories ( name )")
        .order("name", { ascending: true });

    if (error || !data) return [];

    return data.map((p: any) => ({
        id: p.id,
        name: p.name,
        categoryName: p.categories?.name ?? "—",
        price: p.price,
        stock: p.stock,
        minStock: p.min_stock,
        active: p.active,
        imageUrl: p.image_url,
    }));
}

export async function getProductAdminById(client: SupabaseClient, id: string): Promise<AdminProductDetail | null> {
    const { data, error } = await client
        .from("products")
        .select(
        `
        id, category_id, name, slug, description, price, image_url, stock, min_stock, active,
        product_ingredients ( ingredient_id, is_included, is_removable, is_addable_extra, price_override, ingredients ( name ) )
        `
        )
        .eq("id", id)
        .maybeSingle();

    if (error || !data) return null;
    const raw = data as any;

    return {
        id: raw.id,
        categoryId: raw.category_id,
        name: raw.name,
        slug: raw.slug,
        description: raw.description,
        price: raw.price,
        imageUrl: raw.image_url,
        stock: raw.stock,
        minStock: raw.min_stock,
        active: raw.active,
        ingredients: (raw.product_ingredients ?? []).map((pi: any) => ({
        ingredientId: pi.ingredient_id,
        ingredientName: pi.ingredients?.name ?? "",
        isIncluded: pi.is_included,
        isRemovable: pi.is_removable,
        isAddableExtra: pi.is_addable_extra,
        priceOverride: pi.price_override,
        })),
    };
}

export async function listCategories(client: SupabaseClient): Promise<CategoryOption[]> {
    const { data, error } = await client.from("categories").select("id, name").order("sort_order");
    if (error || !data) return [];
    return data;
}

export async function listGlobalIngredients(client: SupabaseClient): Promise<GlobalIngredient[]> {
    const { data, error } = await client
        .from("ingredients")
        .select("id, name, extra_price, stock, min_stock, active")
        .order("name");

    if (error || !data) return [];

    return data.map((i) => ({
        id: i.id,
        name: i.name,
        extraPrice: i.extra_price,
        stock: i.stock,
        minStock: i.min_stock,
        active: i.active,
    }));
}