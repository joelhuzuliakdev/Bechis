import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivePromotion } from "./calculatePromotionDiscount";

export async function getActivePromotionsToday(client: SupabaseClient): Promise<ActivePromotion[]> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const dayOfWeek = now.getDay(); // 0 = domingo, igual que la base

  const { data, error } = await client
    .from("promotions")
    .select("id, type, discount_value, day_of_week, start_date, end_date, promotion_products ( product_id )")
    .eq("active", true);

  if (error || !data) {
    if (error) console.error("Error cargando promociones activas:", error.message);
    return [];
  }

  return data
    .filter((p: any) => {
      if (p.day_of_week !== null && p.day_of_week !== dayOfWeek) return false;
      if (p.start_date && p.start_date > todayStr) return false;
      if (p.end_date && p.end_date < todayStr) return false;
      return true;
    })
    .map((p: any) => ({
      id: p.id,
      type: p.type,
      discountValue: p.discount_value,
      productIds: (p.promotion_products ?? []).map((pp: any) => pp.product_id),
    }));
}