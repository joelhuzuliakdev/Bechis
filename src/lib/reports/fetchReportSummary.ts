// Resumen de ventas (monto total, cantidad, ticket promedio) para un
// rango de fechas elegido en /admin/reportes.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportSummary {
    totalMonto: number;
    cantidadVentas: number;
    ticketPromedio: number;
}

export async function getReportSummary(
    client: SupabaseClient,
    from: Date,
    to: Date
    ): Promise<ReportSummary> {
    const { data, error } = await client
        .from("sales")
        .select("total")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

    if (error) {
        console.error("Error cargando resumen de ventas:", error.message);
    }

    const rows = data ?? [];
    const totalMonto = rows.reduce((sum, r) => sum + Number(r.total), 0);
    const cantidadVentas = rows.length;
    const ticketPromedio = cantidadVentas > 0 ? totalMonto / cantidadVentas : 0;

    return { totalMonto, cantidadVentas, ticketPromedio };
}