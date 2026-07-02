// Envío de mensajes por WhatsApp usando Twilio.
import twilio from 'twilio';

// WhatsApp/Twilio limita el cuerpo a ~1600 caracteres; partimos en trozos si hace falta.
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

export function makeSender({ sid, token, from, to }) {
  const client = twilio(sid, token);
  return async function send(body) {
    const chunks = splitMessage(body);
    for (const chunk of chunks) {
      await client.messages.create({ from, to, body: chunk });
    }
    return chunks.length;
  };
}
