// Cliente de bajo nivel para la WhatsApp Cloud API (Meta).
// Solo sabe mandar mensajes de PLANTILLA (requerido para mensajes que
// inicia el negocio, como avisos de estado de pedido). No maneja
// mensajes de texto libre ni webhooks de entrada.

const WHATSAPP_API_VERSION = import.meta.env.WHATSAPP_API_VERSION || "v21.0";
const WHATSAPP_PHONE_NUMBER_ID = import.meta.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = import.meta.env.WHATSAPP_TOKEN;

export interface TemplateParam {
    type: "text";
    text: string;
}

export interface SendTemplateResult {
    ok: boolean;
    error?: string;
}

export async function sendTemplateMessage(
    toPhoneE164: string,
    templateName: string,
    languageCode: string,
    bodyParams: TemplateParam[]
): Promise<SendTemplateResult> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
        return { ok: false, error: "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TOKEN en el .env" };
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const body = {
        messaging_product: "whatsapp",
        to: toPhoneE164,
        type: "template",
        template: {
        name: templateName,
        language: { code: languageCode },
        components: [
            {
            type: "body",
            parameters: bodyParams,
            },
        ],
        },
    };

    try {
        const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        });

        if (!res.ok) {
        const errorBody = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${errorBody}` };
        }

        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Error de red desconocido" };
    }
}