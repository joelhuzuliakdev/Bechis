// Reutilizable en Ventas, y más adelante en Reportes y Gastos (todos
// necesitan el mismo tipo de filtro: hoy / ayer / semana / mes /
// personalizado). Los rangos son inclusivos: [from, to].

export type DateRangePreset = "hoy" | "ayer" | "semana" | "mes" | "personalizado";

export interface DateRange {
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getPresetRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  switch (preset) {
    case "hoy":
      return { from: startOfDay(now), to: endOfDay(now) };

    case "ayer": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }

    case "semana": {
      // Lunes de esta semana hasta hoy.
      const start = new Date(now);
      const day = start.getDay(); // 0 = domingo
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      return { from: startOfDay(start), to: endOfDay(now) };
    }

    case "mes": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(now) };
    }

    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

/** Parsea "YYYY-MM-DD" (lo que manda un <input type="date">) a un rango [00:00, 23:59:59]. */
export function parseCustomRange(fromStr: string, toStr: string): DateRange {
  const from = fromStr ? startOfDay(new Date(fromStr + "T00:00:00")) : startOfDay(new Date());
  const to = toStr ? endOfDay(new Date(toStr + "T00:00:00")) : endOfDay(new Date());
  return { from, to };
}

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}