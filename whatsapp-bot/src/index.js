// Bot que envía pronósticos a WhatsApp 1 hora antes de cada partido.
import 'dotenv/config';
import fs from 'fs';
import cron from 'node-cron';
import { generatePrediction } from './predictor.js';
import { makeSender } from './whatsapp.js';

// ===== Configuración =====
const cfg = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
};
const LEAD = parseInt(process.env.LEAD_MINUTES || '60', 10);
const CRON = process.env.CRON_SCHEDULE || '*/5 * * * *';
const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();

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

// ===== Persistencia de "ya enviado" =====
const FIXTURES_URL = new URL('../fixtures.json', import.meta.url);
const SENT_URL = new URL('../sent.json', import.meta.url);
const loadFixtures = () => JSON.parse(fs.readFileSync(FIXTURES_URL, 'utf8'));
const loadSent = () => { try { return new Set(JSON.parse(fs.readFileSync(SENT_URL, 'utf8'))); } catch { return new Set(); } };
const saveSent = (set) => fs.writeFileSync(SENT_URL, JSON.stringify([...set], null, 2));
const matchId = (m) => `${m.home}-${m.away}-${m.kickoff}`;

// ===== Procesar un partido =====
async function processMatch(m) {
  console.log(`⏳ Generando pronóstico: ${m.home} vs ${m.away} (${m.kickoff})`);
  const text = await generatePrediction(m, cfg);
  if (!text) throw new Error('El modelo devolvió una respuesta vacía.');
  const header = `⚽ *${m.home} vs ${m.away}*\n${m.league} · comienza en ~${LEAD} min\n\n`;
  const footer = `\n\n⚠️ Análisis con IA a partir de datos reales. NO es una garantía. Juega con responsabilidad.`;
  const parts = await send(header + text + footer);
  console.log(`✅ Enviado a WhatsApp (${parts} mensaje/s).`);
}

// ===== Tick del cron =====
async function tick() {
  const now = Date.now();
  const sent = loadSent();
  for (const m of loadFixtures()) {
    const id = matchId(m);
    const minsUntil = (new Date(m.kickoff).getTime() - now) / 60000;
    if (!sent.has(id) && minsUntil > 0 && minsUntil <= LEAD) {
      try {
        await processMatch(m);
        sent.add(id);
        saveSent(sent);
      } catch (e) {
        console.error(`❌ Error con ${m.home} vs ${m.away}:`, e.message);
      }
    }
  }
}

// ===== Modo manual de prueba: node src/index.js --now "colombia" =====
const arg = process.argv[2];
if (arg === '--now') {
  const q = (process.argv[3] || '').toLowerCase();
  const m = loadFixtures().find((x) => !q || x.home.toLowerCase().includes(q) || x.away.toLowerCase().includes(q));
  if (!m) { console.error('No encontré ese partido en fixtures.json.'); process.exit(1); }
  await processMatch(m);
  process.exit(0);
}

// ===== Arranque normal =====
console.log(`🤖 Bot activo (proveedor: ${PROVIDER}). Revisa la agenda con cron "${CRON}" y envía ${LEAD} min antes de cada partido.`);
console.log(`   Partidos en agenda: ${loadFixtures().length}. Edita fixtures.json para anadir mas.`);
cron.schedule(CRON, tick);
