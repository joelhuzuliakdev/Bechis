import type { SupabaseClient } from "@supabase/supabase-js";

export interface PromotionListItem {
    id: string;
    name: string;
    type: string;
    discountValue: number;
    dayOfWeek: number | null;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
    productNames: string[];
}

export interface PromotionDetail {
    id: string;
    name: string;
    description: string | null;
    type: string;
    discountValue: number;
    dayOfWeek: number | null;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
    productIds: string[];
}

export interface SelectableProduct {
    id: string;
    name: string;
}

export async function listPromotions(client: SupabaseClient): Promise<PromotionListItem[]> {
    const { data, error } = await client
        .from("promotions")
        .select(
        `
        id, name, type, discount_value, day_of_week, start_date, end_date, active,
        promotion_products ( products ( name ) )
        `
        )
        .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        discountValue: p.discount_value,
        dayOfWeek: p.day_of_week,
        startDate: p.start_date,
        endDate: p.end_date,
        active: p.active,
        productNames: (p.promotion_products ?? []).map((pp: any) => pp.products?.name).filter(Boolean),
    }));
}

export async function getPromotionById(client: SupabaseClient, id: string): Promise<PromotionDetail | null> {
    const { data, error } = await client
        .from("promotions")
        .select(
        `
        id, name, description, type, discount_value, day_of_week, start_date, end_date, active,
        promotion_products ( product_id )
        `
        )
        .eq("id", id)
        .maybeSingle();

    if (error || !data) return null;
    const raw = data as any;

    return {
        id: raw.id,
        name: raw.name,
        description: raw.description,
        type: raw.type,
        discountValue: raw.discount_value,
        dayOfWeek: raw.day_of_week,
        startDate: raw.start_date,
        endDate: raw.end_date,
        active: raw.active,
        productIds: (raw.promotion_products ?? []).map((pp: any) => pp.product_id),
    };
}

export async function getSelectableProducts(client: SupabaseClient): Promise<SelectableProduct[]> {
    const { data, error } = await client.from("products").select("id, name").eq("active", true).order("name");
    if (error || !data) return [];
    return data;
}