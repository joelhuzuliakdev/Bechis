// Textos fijos del ticket. Se editan acá, en un solo lugar.
export const TICKET = {
    businessName: "BECHIS",
    // Líneas debajo del nombre, por ejemplo la dirección o el teléfono del local.
    // Ej.: ["Av. Siempre Viva 123", "Tel. 351 000 0000"]
    headerLines: [] as string[],
    footerLines: ["¡Gracias por tu compra!"],
    legalLine: "Comprobante no válido como factura",
    timeZone: "America/Argentina/Buenos_Aires",
};

export const PAYMENT_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    qr: "QR",
    debito: "Tarjeta de débito",
    credito: "Tarjeta de crédito",
};