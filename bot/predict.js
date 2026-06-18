#!/usr/bin/env node
/* ============================================================================
 *  bot/predict.js  —  Rutina de aviso 1 hora antes de cada partido (WhatsApp)
 * ----------------------------------------------------------------------------
 *  Pensada para correr en GitHub Actions cada ~15 min. En cada ejecución:
 *    1. Lee el calendario (bot/fixtures.json) y el estado (bot/sent.json).
 *    2. Busca partidos que arrancan dentro de la ventana objetivo (~1 h).
 *    3. Calcula el marcador (HÍBRIDO): base matemática de la web (models.js)
 *       + ajuste MULTIFACTOR de Opus 4.8 con búsqueda web (lesiones, forma,
 *       cuotas, contexto físico…).
 *    4. Envía el aviso por WhatsApp con CallMeBot (con reintentos).
 *    5. Marca el partido como avisado para no repetirlo.
 *  Si la rutina falla, intenta avisarte del fallo por WhatsApp.
 *
 *  Variables de entorno:
 *    CALLMEBOT_PHONE   tu número con prefijo de país (p. ej. 521556...)
 *    CALLMEBOT_APIKEY  tu apikey de CallMeBot
 *    ANTHROPIC_API_KEY tu clave de la API de Anthropic (opcional: sin ella, la
 *                      rutina usa solo el modelo matemático determinista)
 *    LEAD_MINUTES      minutos antes del partido para avisar (def. 60)
 *    WINDOW_MINUTES    ancho de la ventana de disparo (def. 20 -> [50,70])
 *    TEST_MODE=1       envía un mensaje de prueba con el próximo partido
 *    DRY_RUN=1         calcula y muestra, pero NO envía (también si faltan creds)
 * ==========================================================================*/

const fs = require("fs");
const path = require("path");
const Models = require("../js/models.js");
const { TEAMS, HOST_TEAMS } = require("../js/data.js");
const { adjustForFactors } = require("./llm-adjust.js");
const { fixtureId, nextUpcoming, pickDueFixtures } = require("./lib/schedule.js");

const FIX = path.join(__dirname, "fixtures.json");
const SENT = path.join(__dirname, "sent.json");

const PHONE = process.env.CALLMEBOT_PHONE;
const APIKEY = process.env.CALLMEBOT_APIKEY;
const LEAD = parseInt(process.env.LEAD_MINUTES || "60", 10);
const WINDOW = parseInt(process.env.WINDOW_MINUTES || "20", 10);
const TEST = process.env.TEST_MODE === "1";
const DRY = process.env.DRY_RUN === "1" || !PHONE || !APIKEY;

const ELO = Object.fromEntries(TEAMS.map(t => [t.name, t.elo]));
const isHost = n => HOST_TEAMS.includes(n);
function eloOf(name) {
  if (ELO[name] == null) throw new Error("Equipo desconocido en fixtures: " + name);
  return ELO[name];
}

/** Ventaja de localía (solo para selecciones anfitrionas en su país). */
function optsFor(home, away) {
  const opts = {};
  if (isHost(home) && !isHost(away)) opts.homeAdv = Models.DEFAULTS.homeAdvantageElo;
  else if (isHost(away) && !isHost(home)) opts.homeAdv = -Models.DEFAULTS.homeAdvantageElo;
  return opts;
}

/**
 *  Análisis HÍBRIDO de un partido:
 *    1) Base matemática: Elo -> goles esperados (λ) -> Poisson/Dixon-Coles.
 *    2) Ajuste de Opus 4.8 (búsqueda web) por LESIONES y SUSPENSIONES, acotado.
 *    3) Se recalcula la matriz con las λ ajustadas.
 *  Si no hay clave de Anthropic o falla, se usa solo el paso (1) (determinista).
 *  Devuelve { r (mercados + λ), adj (info del ajuste) }.
 */
async function analyze(fx) {
  const { home, away } = fx;
  const opts = optsFor(home, away);
  const eg = Models.expectedGoals(eloOf(home), eloOf(away), opts);
  let lambdaHome = eg.lambdaHome, lambdaAway = eg.lambdaAway;

  let adj = { used: false, homeAdjPct: 0, awayAdjPct: 0, note: "" };
  try {
    adj = await adjustForFactors({ home, away, kickoffISO: fx.kickoff, venue: fx.venue });
  } catch (e) {
    console.error("Aviso: el ajuste de Opus 4.8 falló; uso solo el modelo matemático:", e.message);
  }
  if (adj.used) {
    lambdaHome = Models.clamp(lambdaHome * (1 + adj.homeAdjPct / 100), 0.05, 9);
    lambdaAway = Models.clamp(lambdaAway * (1 + adj.awayAdjPct / 100), 0.05, 9);
  }
  const matrix = Models.scoreMatrix(lambdaHome, lambdaAway, opts);
  const markets = Models.marketsFromMatrix(matrix);
  return { r: { ...markets, lambdaHome, lambdaAway }, adj };
}

const fmt = p => (p * 100).toFixed(0) + "%";

function buildMessage(fx, r, adj) {
  const top = r.topScores[0];
  const ko = new Date(fx.kickoff);
  const koStr = isNaN(ko) ? "" : `(${ko.toISOString().slice(11, 16)} UTC)`;
  const others = r.topScores.slice(1, 4).map(s => `${s.h}-${s.a}`).join(", ");
  const lines = [
    `⚽ MUNDIAL 2026 — falta ~1 hora ${koStr}`,
    `${fx.home} vs ${fx.away}`,
    ``,
    `🔮 Marcador más probable: ${top.h}-${top.a} (${fmt(top.p)})`,
    `📊 ${fx.home}: ${fmt(r.pHome)} · Empate: ${fmt(r.pDraw)} · ${fx.away}: ${fmt(r.pAway)}`,
    `⚽ +2.5 goles: ${fmt(r.over25)} · Ambos marcan: ${fmt(r.btts)}`,
    `🎲 Otros marcadores: ${others}`,
  ];
  if (adj && adj.used) lines.push(`🔎 Factores: ${adj.note || "sin señales relevantes"}`);
  lines.push(``);
  lines.push(adj && adj.used
    ? `⚠️ Estimación probabilística (base Elo/Poisson + Opus 4.8 multifactor), no una certeza. Apuesta con responsabilidad. +18`
    : `⚠️ Es una ESTIMACIÓN probabilística, no una certeza. Apuesta con responsabilidad. +18`);
  return lines.join("\n");
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Envía por CallMeBot con reintentos (la API limita y a veces da 5xx). */
async function sendWhatsApp(text, tries = 3) {
  const url = "https://api.callmebot.com/whatsapp.php"
    + `?phone=${encodeURIComponent(PHONE)}`
    + `&text=${encodeURIComponent(text)}`
    + `&apikey=${encodeURIComponent(APIKEY)}`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const body = await res.text();
      if (!res.ok) throw new Error(`CallMeBot HTTP ${res.status}: ${body.slice(0, 200)}`);
      return body.slice(0, 200);
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(1000 * 2 ** i);   // 1s, 2s, 4s
    }
  }
  throw lastErr;
}

/** Añade una línea al resumen del job de GitHub Actions (si está disponible). */
function logSummary(line) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) { try { fs.appendFileSync(f, line + "\n"); } catch { /* no-op */ } }
}

async function main() {
  const fixtures = JSON.parse(fs.readFileSync(FIX, "utf8"));
  let sent = [];
  try { sent = JSON.parse(fs.readFileSync(SENT, "utf8")); } catch { /* primera vez */ }
  const sentSet = new Set(sent);
  const now = Date.now();

  if (TEST) {
    const fx = nextUpcoming(fixtures, now) || { home: "Argentina", away: "Brasil",
      kickoff: new Date(now + 3600e3).toISOString() };
    const { r, adj } = await analyze(fx);
    const msg = "🧪 PRUEBA DE LA RUTINA\n" + buildMessage(fx, r, adj);
    console.log(msg);
    if (!DRY) console.log("Respuesta CallMeBot:", await sendWhatsApp(msg));
    else console.log("\n(DRY_RUN: no se envió. Define CALLMEBOT_PHONE/APIKEY para enviar.)");
    return;
  }

  const due = pickDueFixtures(fixtures, sentSet, now, LEAD, WINDOW);
  let count = 0;
  for (const { fx, id, mins } of due) {
    const { r, adj } = await analyze(fx);
    const msg = buildMessage(fx, r, adj);
    console.log(`→ ${id}  (${mins.toFixed(0)} min)\n${msg}\n`);
    if (!DRY) await sendWhatsApp(msg);
    sentSet.add(id);
    count++;
    logSummary(`- ✅ **${fx.home} vs ${fx.away}** — ${top1X2(r)} · en ${mins.toFixed(0)} min`
      + `${adj.used ? " · 🔎 Opus" : ""}${DRY ? " · (DRY_RUN)" : ""}`);
  }
  fs.writeFileSync(SENT, JSON.stringify([...sentSet], null, 2) + "\n");
  const summary = `Avisos enviados en esta ejecución: ${count}${DRY ? " (DRY_RUN)" : ""}`;
  console.log(summary);
  logSummary(`\n**${summary}** · ${due.length} en ventana.`);
}

/** Resumen 1X2 corto para el log. */
function top1X2(r) {
  return `${fmt(r.pHome)}/${fmt(r.pDraw)}/${fmt(r.pAway)}`;
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  logSummary(`- ❌ **La rutina falló:** ${e.message}`);
  // Intentar avisar del fallo (sin romper si el aviso también falla).
  if (!DRY) {
    try { await sendWhatsApp(`⚠️ La rutina del Mundial 2026 falló: ${e.message}`.slice(0, 300)); }
    catch (e2) { console.error("Tampoco se pudo avisar del fallo:", e2.message); }
  }
  process.exit(1);
});
