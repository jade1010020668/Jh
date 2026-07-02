// Envío de mensajes por WhatsApp. Soporta dos proveedores:
//  - "meta"   → WhatsApp Cloud API de Meta (gratis, oficial). Recomendado.
//  - "twilio" → Twilio (sandbox gratis para pruebas).
import twilio from 'twilio';

// WhatsApp limita el cuerpo del texto; partimos en trozos si hace falta.
function splitMessage(text, max = 1500) {
  if (text.length <= max) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max; // si no hay salto cercano, cortamos duro
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// Solo dígitos, con código de país. Ej: "573183938822".
function digits(n) { return String(n).replace(/[^\d]/g, ''); }

// ===== Meta WhatsApp Cloud API =====
export function makeMetaSender({ token, phoneNumberId, to, apiVersion = 'v21.0' }) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const toNum = digits(to);
  return async function send(body) {
    const chunks = splitMessage(body, 3500); // Cloud API admite hasta 4096
    for (const chunk of chunks) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toNum,
          type: 'text',
          text: { preview_url: false, body: chunk }
        })
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(`Meta Cloud API ${resp.status}: ${detail}`);
      }
    }
    return chunks.length;
  };
}

// ===== Twilio =====
export function makeTwilioSender({ sid, token, from, to }) {
  const client = twilio(sid, token);
  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:+${digits(to)}`;
  const fromAddr = from.startsWith('whatsapp:') ? from : `whatsapp:+${digits(from)}`;
  return async function send(body) {
    const chunks = splitMessage(body, 1500);
    for (const chunk of chunks) {
      await client.messages.create({ from: fromAddr, to: toAddr, body: chunk });
    }
    return chunks.length;
  };
}

// Fábrica según el proveedor elegido en .env
export function makeSender(env) {
  const provider = (env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
  if (provider === 'twilio') {
    return makeTwilioSender({
      sid: env.TWILIO_ACCOUNT_SID,
      token: env.TWILIO_AUTH_TOKEN,
      from: env.TWILIO_WHATSAPP_FROM,
      to: env.WHATSAPP_TO
    });
  }
  return makeMetaSender({
    token: env.META_ACCESS_TOKEN,
    phoneNumberId: env.META_PHONE_NUMBER_ID,
    to: env.WHATSAPP_TO
  });
}
