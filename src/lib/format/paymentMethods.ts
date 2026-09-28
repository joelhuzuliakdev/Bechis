// Opciones de método de pago compartidas por Ventas/Caja/Reportes/Gastos.
// Si en tu enum de Supabase los valores tienen otro nombre, ajustá el
// "value" de cada entrada acá — es el único lugar que hace falta tocar.

export const PAYMENT_METHOD_OPTIONS = [
    { value: "efectivo", label: "Efectivo" },
    { value: "transferencia", label: "Transferencia" },
    { value: "qr", label: "QR" },
    { value: "debito", label: "Débito" },
    { value: "credito", label: "Crédito" },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

export function formatPaymentMethod(method: string): string {
    const found = PAYMENT_METHOD_OPTIONS.find((m) => m.value === method);
    if (found) return found.label;
    return method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, " ");
}