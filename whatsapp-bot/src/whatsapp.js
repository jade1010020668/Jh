// Envío de mensajes por WhatsApp. Soporta dos proveedores:
//  - "meta"   → WhatsApp Cloud API de Meta (gratis, oficial). Recomendado.
//  - "twilio" → Twilio (sandbox gratis para pruebas).

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

// Solo dígitos, con código de país. Ej: "57XXXXXXXXXX".
function digits(n) { return String(n).replace(/[^\d]/g, ''); }

// ===== Meta WhatsApp Cloud API =====
export function makeMetaSender({ token, phoneNumberId, to, apiVersion = 'v21.0' }) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const toNum = digits(to);
  // from: número de partes ya entregadas en un intento anterior (para no repetirlas al reintentar)
  return async function send(body, from = 0) {
    const chunks = splitMessage(body, 3500); // Cloud API admite hasta 4096
    for (let i = from; i < chunks.length; i++) {
      const chunk = chunks[i];
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
        // 131047: Meta no deja escribir texto libre si el destinatario no ha escrito en las últimas 24 h
        const hint = /131047|re-?engagement|24 hours/i.test(detail)
          ? ' → WhatsApp solo permite texto libre dentro de las 24 h siguientes a un mensaje TUYO a ese número: escríbele "hola" desde tu WhatsApp y reintenta (o usa una plantilla aprobada).'
          : (resp.status === 401 || /190|expired/i.test(detail) ? ' → El token de Meta venció o es inválido: genera uno nuevo (los de prueba duran 24 h).' : '');
        const err = new Error(`Meta Cloud API ${resp.status}: ${detail}${hint}`);
        err.sentParts = i;
        throw err;
      }
    }
    return chunks.length;
  };
}

// ===== Twilio =====
export function makeTwilioSender({ sid, token, from, to }) {
  let client = null; // se crea en el primer envío
  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:+${digits(to)}`;
  const fromAddr = from.startsWith('whatsapp:') ? from : `whatsapp:+${digits(from)}`;
  return async function send(body, from = 0) {
    const chunks = splitMessage(body, 1500);
    for (let i = from; i < chunks.length; i++) {
      const chunk = chunks[i];
      const failAt = (msg) => { const err = new Error(msg); err.sentParts = i; return err; };
      if (!client) { const { default: twilio } = await import('twilio'); client = twilio(sid, token); }
      let m;
      try { m = await client.messages.create({ from: fromAddr, to: toAddr, body: chunk }); }
      catch (e) { throw failAt(`Twilio ${e.status || ''} (código ${e.code || '?'}): ${e.message}`); }
      // Twilio acepta el mensaje y lo entrega después: se consulta una vez su estado para detectar un rechazo inmediato
      let st = null;
      try { await new Promise((r) => setTimeout(r, 5000)); st = await client.messages(m.sid).fetch(); } catch { /* si no se puede consultar, se da por aceptado */ }
      if (st && (st.status === 'failed' || st.status === 'undelivered')) {
        throw failAt(`Twilio no entregó el mensaje (error ${st.errorCode || '?'}). Si es 63015 o 63016: envíe "join <palabra>" u "hola" desde su WhatsApp al número del sandbox y reintente.`);
      }
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
