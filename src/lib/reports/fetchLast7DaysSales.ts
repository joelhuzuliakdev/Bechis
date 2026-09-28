import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresetRange } from "@/lib/format/dateRanges";

export interface DailySales {
    /** YYYY-MM-DD (hora local) */
    date: string;
    /** Etiqueta corta: Lun, Mar, Mié... */
    label: string;
    total: number;
    count: number;
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function localDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Ventas de los últimos 7 días (incluyendo hoy), un registro por día,
 * con 0 en los días sin ventas — así el gráfico siempre muestra 7
 * barras en vez de "saltear" los días vacíos.
 *
 * supabase-js no tiene GROUP BY, así que traemos las ventas del rango
 * y las agrupamos acá; para el volumen de una hamburguesería (unos
 * cientos de ventas por semana) es totalmente liviano.
 */
export async function getSalesLast7Days(client: SupabaseClient): Promise<DailySales[]> {
    const { from, to } = getPresetRange("ultimos_7");

    const { data, error } = await client
        .from("sales")
        .select("total, created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

    if (error) console.error("Error cargando ventas de los últimos 7 días:", error.message);

    const buckets = new Map<string, DailySales>();
    for (let i = 0; i < 7; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        buckets.set(localDateKey(d), { date: localDateKey(d), label: DAY_LABELS[d.getDay()], total: 0, count: 0 });
    }

    (data ?? []).forEach((sale) => {
        const key = localDateKey(new Date(sale.created_at));
        const bucket = buckets.get(key);
        if (bucket) {
        bucket.total += sale.total;
        bucket.count += 1;
        }
    });

    return Array.from(buckets.values());
}