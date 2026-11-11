// Bot que envía a WhatsApp el pronóstico de cada partido antes del pitazo inicial.
// El calendario se lee solo (misma fuente que la app web): no hay que escribir la agenda a mano.
import 'dotenv/config';
import fs from 'fs';
import cron from 'node-cron';
import { buildForecast, formatMessage, findFixture, Data, LEAGUES, TZ } from './predictor.js';
import { makeSender } from './whatsapp.js';

// ===== Configuración =====
const SLUGS = (process.env.LEAGUES || 'col.1').split(',').map((s) => s.trim()).filter(Boolean);
const LEAD = Math.max(5, parseInt(process.env.LEAD_MINUTES || '60', 10) || 60);
const CRON = process.env.CRON_SCHEDULE || '*/5 * * * *';
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
const STRICT_UNTIL_MIN = 15; // hasta 15 min antes del partido se espera a tener los datos completos
// La IA es opcional: sin ANTHROPIC_API_KEY el bot envía el pronóstico estadístico, que no cuesta nada.
const ai = process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5' } : null;

// Mejor negarse a arrancar que decir "Bot activo" con una configuración que no puede enviar nada
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
for (const s of SLUGS) if (!LEAGUES[s]) fail(`Liga desconocida en LEAGUES: "${s}". Válidas: ${Object.keys(LEAGUES).join(', ')}`);
if (!['meta', 'twilio'].includes(PROVIDER)) fail('WHATSAPP_PROVIDER debe ser "meta" o "twilio".');
const required = { WHATSAPP_TO: process.env.WHATSAPP_TO };
if (PROVIDER === 'twilio') Object.assign(required, { TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM });
else Object.assign(required, { META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN, META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID });
for (const [k, v] of Object.entries(required)) {
  if (!v) fail(`Falta la variable de entorno ${k}. Copia .env.example a .env y complétalo.`);
  if (/\.\.\.$|X{4,}/.test(v) || (k === 'META_PHONE_NUMBER_ID' && v === '123456789012345')) fail(`${k} todavía tiene el valor de ejemplo de .env.example.`);
}
if (!/^\d{10,15}$/.test(String(process.env.WHATSAPP_TO).replace(/^whatsapp:|[+\s-]/g, ''))) fail('WHATSAPP_TO debe ser tu número con código de país, solo dígitos (ej. 573001234567).');
try { new Intl.DateTimeFormat('es-CO', { timeZone: TZ }); } catch { fail(`TIMEZONE="${TZ}" no es una zona horaria válida (ej. America/Bogota).`); }
if (!cron.validate(CRON)) fail(`CRON_SCHEDULE="${CRON}" no es una expresión cron válida.`);
let send;
try { send = makeSender(process.env); } catch (e) { fail(`No se pudo preparar el envío por ${PROVIDER}: ${e.message}`); }

// ===== Registro de envíos (para no repetir) =====
const SENT_URL = new URL('../sent.json', import.meta.url);
const loadSent = () => { try { return new Set(JSON.parse(fs.readFileSync(SENT_URL, 'utf8'))); } catch { return new Set(); } };
const saveSent = (set) => fs.writeFileSync(SENT_URL, JSON.stringify([...set].slice(-500), null, 2));

const ready = new Map(); // id → pronóstico ya armado (si falla el envío, no se vuelve a pagar la consulta de IA)

// strict: si la fuente no entregó todos los datos, no se envía un mensaje a medias; se reintenta después.
async function processMatch(slug, event, strict) {
  const id = `${slug}:${event.id}`;
  console.log(`⏳ ${event.home.name} vs ${event.away.name} (${event.date})`);
  let result = ready.get(id);
  if (!result) { result = await buildForecast(slug, event, ai, { strict }); ready.set(id, result); }
  const parts = await send(formatMessage(result));
  ready.delete(id);
  // El proveedor solo confirma que RECIBIÓ el mensaje. Si usted no le ha escrito al número en las últimas 24 h,
  // WhatsApp puede descartarlo después sin avisar (ver README).
  console.log(`✅ Aceptado por ${PROVIDER} (${parts} mensaje/s; la entrega final no se puede confirmar desde aquí). Calidad de los datos: ${result.fc.quality.level}.`);
}

// ===== Tick del cron =====
let running = false;          // evita que dos ticks se solapen y envíen el mismo partido dos veces
const attempts = new Map();   // id → intentos fallidos
const done = new Set();       // enviados en esta ejecución (por si sent.json no se puede escribir)

async function tick() {
  if (running) return;
  running = true;
  try {
    const sent = loadSent();
    for (const slug of SLUGS) {
      let fixtures;
      try { fixtures = await Data.loadFixtures(slug, 2); }
      catch (e) { console.error(`⚠️ No se pudo leer el calendario de ${slug}: ${e.message}`); continue; }
      for (const ev of fixtures) {
        const id = `${slug}:${ev.id}`;
        const minsUntil = (Date.parse(ev.date) - Date.now()) / 60000;
        if (sent.has(id) || done.has(id) || minsUntil <= 0 || minsUntil > LEAD) continue;
        const tries = attempts.get(id) || 0;
        // Se reintenta en cada revisión hasta el inicio del partido (un fallo pasajero no debe dejarlo sin pronóstico)
        try { await processMatch(slug, ev, minsUntil > STRICT_UNTIL_MIN); }
        catch (e) { attempts.set(id, tries + 1); console.error(`❌ ${ev.home.name} vs ${ev.away.name} (intento ${tries + 1}; se reintenta hasta el inicio): ${e.message}`); continue; }
        done.add(id); attempts.delete(id); sent.add(id);
        try { saveSent(sent); } catch (e) { console.error(`⚠️ Enviado, pero no se pudo guardar sent.json (${e.message}). Si reinicia el bot antes del partido, se repetirá.`); }
      }
    }
  } finally { running = false; }
}

// ===== Prueba manual: node src/index.js --now [nombre de un equipo] =====
if (process.argv[2] === '--now') {
  const q = process.argv.slice(3).join(' ');
  try {
    let pick = null;
    for (const slug of SLUGS) {
      const ev = findFixture(await Data.loadFixtures(slug, 14), q);
      if (ev) { pick = { slug, ev }; break; }
    }
    if (!pick) fail('No encontré un próximo partido' + (q ? ` de "${q}"` : '') + ' en las ligas configuradas.');
    await processMatch(pick.slug, pick.ev, false);
    process.exit(0);
  } catch (e) { fail(e.message); }
}

console.log(`🤖 Bot activo (envío: ${PROVIDER}; ligas: ${SLUGS.join(', ')}; IA: ${ai ? ai.model : 'no'}; zona horaria: ${TZ}). Revisa el calendario con cron "${CRON}" y envía ${LEAD} min antes de cada partido.`);
cron.schedule(CRON, tick, { timezone: TZ });
