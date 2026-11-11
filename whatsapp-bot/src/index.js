// Bot que envía pronósticos a WhatsApp antes de cada partido de la agenda (fixtures.json).
import 'dotenv/config';
import fs from 'fs';
import cron from 'node-cron';
import { generatePrediction } from './predictor.js';
import { makeSender } from './whatsapp.js';

// ===== Configuración =====
const cfg = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'
};
const LEAD = Math.max(5, parseInt(process.env.LEAD_MINUTES || '60', 10) || 60);
const CRON = process.env.CRON_SCHEDULE || '*/5 * * * *';
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
const TZ = process.env.TIMEZONE || 'America/Bogota';
const MAX_ATTEMPTS = 3; // intentos por partido: cada intento cuesta una consulta a la API

// Variables requeridas según el proveedor de envío elegido.
const required = {
  ANTHROPIC_API_KEY: cfg.apiKey,
  WHATSAPP_TO: process.env.WHATSAPP_TO
};
if (PROVIDER === 'twilio') {
  Object.assign(required, {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM
  });
} else {
  Object.assign(required, {
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID
  });
}
for (const [k, v] of Object.entries(required)) {
  if (!v) { console.error(`❌ Falta la variable de entorno ${k}. Copia .env.example a .env y complétalo.`); process.exit(1); }
}

const send = makeSender(process.env);

// ===== Agenda y registro de envíos =====
const FIXTURES_URL = new URL('../fixtures.json', import.meta.url);
const SENT_URL = new URL('../sent.json', import.meta.url);

// Devuelve solo partidos válidos; un fixtures.json roto no debe tumbar el bot.
function loadFixtures() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(FIXTURES_URL, 'utf8')); }
  catch (e) { console.error(`❌ No pude leer fixtures.json: ${e.message}`); return []; }
  if (!Array.isArray(raw)) { console.error('❌ fixtures.json debe ser un array de partidos.'); return []; }
  return raw.filter((m) => {
    const ok = m && m.home && m.away && Number.isFinite(new Date(m.kickoff).getTime());
    if (!ok) console.error('⚠️ Partido ignorado (faltan home/away o kickoff inválido):', JSON.stringify(m));
    return ok;
  });
}
const loadSent = () => { try { return new Set(JSON.parse(fs.readFileSync(SENT_URL, 'utf8'))); } catch { return new Set(); } };
const saveSent = (set) => fs.writeFileSync(SENT_URL, JSON.stringify([...set], null, 2));
const matchId = (m) => `${m.home}-${m.away}-${m.kickoff}`;
const kickoffLabel = (m) => new Date(m.kickoff).toLocaleString('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ===== Procesar un partido =====
async function processMatch(m) {
  console.log(`⏳ Generando pronóstico: ${m.home} vs ${m.away} (${m.kickoff})`);
  const text = await generatePrediction(m, cfg);
  if (!text) throw new Error('El modelo devolvió una respuesta vacía.');
  const header = `⚽ *${m.home} vs ${m.away}*\n${m.league || 'Fútbol'} · ${kickoffLabel(m)}\n\n`;
  const footer = `\n\n⚠️ Estimación estadística, NO una garantía. Apuesta solo si hay valor frente a la cuota y nunca más del 3% de tu banca.`;
  const parts = await send(header + text + footer);
  console.log(`✅ Enviado a WhatsApp (${parts} mensaje/s).`);
}

// ===== Tick del cron =====
let running = false;            // evita que dos ticks se solapen y envíen el mismo partido dos veces
const attempts = new Map();     // id → intentos fallidos

async function tick() {
  if (running) return;
  running = true;
  try {
    const sent = loadSent();
    for (const m of loadFixtures()) {
      const id = matchId(m);
      const minsUntil = (new Date(m.kickoff).getTime() - Date.now()) / 60000;
      if (sent.has(id) || minsUntil <= 0 || minsUntil > LEAD) continue;
      const tries = attempts.get(id) || 0;
      if (tries >= MAX_ATTEMPTS) continue;
      try {
        await processMatch(m);
        sent.add(id);
        saveSent(sent);
      } catch (e) {
        attempts.set(id, tries + 1);
        console.error(`❌ Error con ${m.home} vs ${m.away} (intento ${tries + 1}/${MAX_ATTEMPTS}): ${e.message}`);
      }
    }
  } finally {
    running = false;
  }
}

// ===== Modo manual de prueba: node src/index.js --now "nacional" =====
if (process.argv[2] === '--now') {
  const q = (process.argv[3] || '').toLowerCase();
  const m = loadFixtures().find((x) => !q || x.home.toLowerCase().includes(q) || x.away.toLowerCase().includes(q));
  if (!m) { console.error('No encontré ese partido en fixtures.json (¿está vacío? agrega partidos primero).'); process.exit(1); }
  try { await processMatch(m); process.exit(0); }
  catch (e) { console.error(`❌ ${e.message}`); process.exit(1); }
}

// ===== Arranque normal =====
const upcoming = loadFixtures().filter((m) => new Date(m.kickoff).getTime() > Date.now());
console.log(`🤖 Bot activo (proveedor: ${PROVIDER}). Revisa la agenda con cron "${CRON}" y envía ${LEAD} min antes de cada partido.`);
console.log(`   Partidos futuros en agenda: ${upcoming.length}.`);
if (!upcoming.length) console.log('   ⚠️ No hay partidos futuros en fixtures.json: el bot no enviará nada hasta que agregues alguno (no hace falta reiniciarlo).');
cron.schedule(CRON, tick);
