// Normaliza el teléfono guardado en `orders.customer_phone` al formato
// que exige WhatsApp Cloud API: solo dígitos, con código de país,
// SIN "+" y sin espacios/guiones (ej. "543572548014").
//
// Confirmado contra la consola de Meta (API Setup -> curl generado):
// para esta cuenta el formato correcto es "54" + número local de 10
// dígitos, SIN el "9" de celular que llevan otros formatos argentinos.
// Si en el futuro algún número no entrega, revisar primero si realmente
// necesita el "9" — Meta puede variar esto según el número de destino.
export function normalizePhoneAR(raw: string | null | undefined): string | null {
    if (!raw) return null;

    // Deja solo dígitos.
    let digits = raw.replace(/\D/g, "");
    if (!digits) return null;

    // Si ya viene con 54 (con o sin el 9), lo normalizamos a "54" + resto,
    // sacando el 9 si está.
    if (digits.startsWith("549")) {
        return "54" + digits.slice(3);
    }
    if (digits.startsWith("54") && digits.length >= 12) {
        return digits;
    }

    // Número local con 0 de larga distancia (ej. "03415551234").
    if (digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    // Local de 10 dígitos (código de área + número, sin 15): anteponer 54.
    if (digits.length === 10) {
        return "54" + digits;
    }

    // Local con "15" de celular incluido (ej. "341155512345", 11 dígitos
    // sin código de país): quitar el "15" y anteponer 54.
    if (digits.length === 11 && digits.slice(3, 5) === "15") {
        return "54" + digits.slice(0, 3) + digits.slice(5);
    }

    // No pudimos normalizarlo con confianza.
    return null;
}