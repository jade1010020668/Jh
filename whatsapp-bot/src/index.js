// Bot que envía a WhatsApp el pronóstico de cada partido antes del pitazo inicial.
// El calendario se lee solo (misma fuente que la app web): no hay que escribir la agenda a mano.
import 'dotenv/config';
import fs from 'fs';
import cron from 'node-cron';
import { buildForecast, formatMessage, Data, LEAGUES } from './predictor.js';
import { makeSender } from './whatsapp.js';

// ===== Configuración =====
const SLUGS = (process.env.LEAGUES || 'col.1').split(',').map((s) => s.trim()).filter(Boolean);
const LEAD = Math.max(5, parseInt(process.env.LEAD_MINUTES || '60', 10) || 60);
const CRON = process.env.CRON_SCHEDULE || '*/5 * * * *';
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
const MAX_ATTEMPTS = 3;
// La IA es opcional: sin ANTHROPIC_API_KEY el bot envía el pronóstico estadístico, que no cuesta nada.
const ai = process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5' } : null;

for (const s of SLUGS) if (!LEAGUES[s]) { console.error(`❌ Liga desconocida en LEAGUES: "${s}". Válidas: ${Object.keys(LEAGUES).join(', ')}`); process.exit(1); }
const required = { WHATSAPP_TO: process.env.WHATSAPP_TO };
if (PROVIDER === 'twilio') Object.assign(required, { TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM });
else Object.assign(required, { META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN, META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID });
for (const [k, v] of Object.entries(required)) {
  if (!v) { console.error(`❌ Falta la variable de entorno ${k}. Copia .env.example a .env y complétalo.`); process.exit(1); }
}
const send = makeSender(process.env);

// ===== Registro de envíos (para no repetir) =====
const SENT_URL = new URL('../sent.json', import.meta.url);
const loadSent = () => { try { return new Set(JSON.parse(fs.readFileSync(SENT_URL, 'utf8'))); } catch { return new Set(); } };
const saveSent = (set) => fs.writeFileSync(SENT_URL, JSON.stringify([...set].slice(-500), null, 2));

async function processMatch(slug, event) {
  console.log(`⏳ ${event.home.name} vs ${event.away.name} (${event.date})`);
  const result = await buildForecast(slug, event, ai);
  const parts = await send(formatMessage(result));
  console.log(`✅ Enviado a WhatsApp (${parts} mensaje/s). Calidad de los datos: ${result.fc.quality.level}.`);
}

// ===== Tick del cron =====
let running = false;          // evita que dos ticks se solapen y envíen el mismo partido dos veces
const attempts = new Map();   // id → intentos fallidos

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
        if (sent.has(id) || minsUntil <= 0 || minsUntil > LEAD) continue;
        const tries = attempts.get(id) || 0;
        if (tries >= MAX_ATTEMPTS) continue;
        try { await processMatch(slug, ev); sent.add(id); saveSent(sent); }
        catch (e) { attempts.set(id, tries + 1); console.error(`❌ ${ev.home.name} vs ${ev.away.name} (intento ${tries + 1}/${MAX_ATTEMPTS}): ${e.message}`); }
      }
    }
  } finally { running = false; }
}

// ===== Prueba manual: node src/index.js --now [parte del nombre de un equipo] =====
if (process.argv[2] === '--now') {
  const q = (process.argv[3] || '').toLowerCase();
  try {
    let pick = null;
    for (const slug of SLUGS) {
      const fixtures = await Data.loadFixtures(slug, 14);
      const ev = fixtures.find((x) => !q || x.home.name.toLowerCase().includes(q) || x.away.name.toLowerCase().includes(q));
      if (ev) { pick = { slug, ev }; break; }
    }
    if (!pick) { console.error('No encontré un próximo partido' + (q ? ` de "${q}"` : '') + ' en las ligas configuradas.'); process.exit(1); }
    await processMatch(pick.slug, pick.ev);
    process.exit(0);
  } catch (e) { console.error(`❌ ${e.message}`); process.exit(1); }
}

console.log(`🤖 Bot activo (envío: ${PROVIDER}; ligas: ${SLUGS.join(', ')}; IA: ${ai ? ai.model : 'no'}). Revisa el calendario con cron "${CRON}" y envía ${LEAD} min antes de cada partido.`);
cron.schedule(CRON, tick);
