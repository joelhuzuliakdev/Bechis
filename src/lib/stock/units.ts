// Unidades de stock y conversiones.
//
// Regla: en la base de datos TODO se guarda en la unidad base del ingrediente
// ("unidad", "g" o "ml"). Los kilos y litros existen solo al escribir o mostrar
// una cantidad: se convierten acá. Así no hay decimales raros en el stock
// (2,5 kg se guardan como 2500 g).

export type StockUnit = "unidad" | "g" | "ml";

export interface InputUnit {
    label: string;
    /** Cuántas unidades base vale 1 de esta unidad (1 kg = 1000 g). */
    factor: number;
}

export const UNIT_LABEL: Record<StockUnit, string> = { unidad: "u.", g: "g", ml: "ml" };

/** Unidades en las que se puede escribir una cantidad. La primera es la sugerida. */
export function inputUnitsFor(unit: StockUnit): InputUnit[] {
    if (unit === "g") return [{ label: "kg", factor: 1000 }, { label: "g", factor: 1 }];
    if (unit === "ml") return [{ label: "l", factor: 1000 }, { label: "ml", factor: 1 }];
    return [{ label: "u.", factor: 1 }];
}

/** Pasa lo que escribió la persona (ej. 2,5 kg) a la unidad base (2500 g). */
export function toBaseUnit(value: number, factor: number): number {
    // El redondeo evita restos de punto flotante (1.1 * 1000 = 1100.0000000000002).
    return Math.round(value * factor * 1000) / 1000;
}

function fmt(n: number, maxDecimals: number): string {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: maxDecimals }).format(n);
}

/** Texto para mostrar: 12500 g -> "12,5 kg"; 300 g -> "300 g"; 4 unidades -> "4 u.". */
export function formatQty(value: number, unit: StockUnit): string {
    if (unit === "g") return Math.abs(value) >= 1000 ? `${fmt(value / 1000, 3)} kg` : `${fmt(value, 2)} g`;
    if (unit === "ml") return Math.abs(value) >= 1000 ? `${fmt(value / 1000, 3)} l` : `${fmt(value, 2)} ml`;
    return `${fmt(value, 2)} u.`;
}