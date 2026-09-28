// Desglose de ventas por método de pago (sales.payment_method) para un
// rango de fechas — usado en las tarjetas + la barra de distribución
// de /admin/reportes.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentBreakdownItem {
    method: string;
    label: string;
    color: string;
    total: number;
    count: number;
    /** porcentaje (0-100) sobre el monto total del período */
    percent: number;
}

// Si en tu enum de Supabase los valores tienen otro nombre (por ejemplo
// "tarjeta_debito" en vez de "debito"), alcanza con ajustar las claves
// de estos dos mapas — el resto del archivo no cambia.
const METHOD_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    qr: "QR",
    debito: "Débito",
    credito: "Crédito",
};

const METHOD_COLORS: Record<string, string> = {
    efectivo: "#3FBE7A",
    transferencia: "#60A5FA",
    qr: "#C084FC",
    debito: "#FFC629",
    credito: "#FF6B5B",
};

const METHOD_ORDER = ["efectivo", "transferencia", "qr", "debito", "credito"];

function labelFor(method: string): string {
    return (
        METHOD_LABELS[method] ??
        method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, " ")
    );
}

function colorFor(method: string): string {
    return METHOD_COLORS[method] ?? "#9E9E9E";
}

export async function getPaymentBreakdown(
    client: SupabaseClient,
    from: Date,
    to: Date
    ): Promise<PaymentBreakdownItem[]> {
    const { data, error } = await client
        .from("sales")
        .select("total, payment_method")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());

    if (error) {
        console.error("Error cargando ventas por método de pago:", error.message);
    }

    const rows = data ?? [];
    const totals = new Map<string, { total: number; count: number }>();

    rows.forEach((row) => {
        const method = String(row.payment_method ?? "otro");
        const current = totals.get(method) ?? { total: 0, count: 0 };
        current.total += Number(row.total);
        current.count += 1;
        totals.set(method, current);
    });

    const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);

    // Unimos los métodos "base" (para que siempre aparezcan, aunque sea en 0)
    // con cualquier valor real que haya aparecido en la data.
    const allMethods = new Set([...METHOD_ORDER, ...totals.keys()]);

    const items: PaymentBreakdownItem[] = Array.from(allMethods).map((method) => {
        const entry = totals.get(method) ?? { total: 0, count: 0 };
        return {
        method,
        label: labelFor(method),
        color: colorFor(method),
        total: entry.total,
        count: entry.count,
        percent: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
        };
    });

    const withSales = items.filter((i) => i.count > 0);

    // Si hubo ventas, mostramos solo los métodos que se usaron (ordenados
    // de mayor a menor monto). Si no hubo ninguna, mostramos los 5 base en 0.
    return withSales.length > 0
        ? withSales.sort((a, b) => b.total - a.total)
        : items.filter((i) => METHOD_ORDER.includes(i.method));
}