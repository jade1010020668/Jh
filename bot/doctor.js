#!/usr/bin/env node
/* ============================================================================
 *  bot/doctor.js  —  Auto-chequeo: "¿está todo bien conectado?"
 * ----------------------------------------------------------------------------
 *  Un panel rápido del estado del bot, SIN gastar dinero ni enviar nada:
 *    · ¿están los secrets? (solo ✓/✗, nunca imprime su valor)
 *    · ¿está el SDK de Anthropic instalado?
 *    · ¿es válido el calendario? (usa el validador)
 *    · ¿cuál es el próximo partido y dentro de cuánto?
 *    · ¿se calcula su predicción base correctamente?
 *  Uso:  node bot/doctor.js   (sale con código 1 si algo está roto).
 * ==========================================================================*/

"use strict";

const path = require("path");
const Models = require("../js/models.js");
const { TEAMS, HOST_TEAMS } = require("../js/data.js");
const { validateFixtures } = require("./validate.js");
const { nextUpcoming } = require("./lib/schedule.js");

const fixtures = require("./fixtures.json");
const ok = b => (b ? "✅" : "❌");
const elo = Object.fromEntries(TEAMS.map(t => [t.name, t.elo]));
let hardFail = false;

console.log("🩺 Doctor del bot del Mundial 2026\n");

/* 1) Secrets (sin revelar valores) -------------------------------------- */
const hasPhone = !!process.env.CALLMEBOT_PHONE;
const hasKey   = !!process.env.CALLMEBOT_APIKEY;
const hasAnth  = !!process.env.ANTHROPIC_API_KEY;
console.log("Credenciales (de entorno):");
console.log(`  ${ok(hasPhone)} CALLMEBOT_PHONE   ${hasPhone ? "(presente)" : "(falta → no enviará)"}`);
console.log(`  ${ok(hasKey)} CALLMEBOT_APIKEY  ${hasKey ? "(presente)" : "(falta → no enviará)"}`);
console.log(`  ${hasAnth ? "✅" : "⚠️ "} ANTHROPIC_API_KEY ${hasAnth ? "(presente → ajuste multifactor activo)" : "(falta → solo modelo matemático)"}`);
if (!hasPhone || !hasKey) console.log("  → Sin las dos de CallMeBot, la rutina corre en modo DRY_RUN (no envía).");

/* 2) SDK de Anthropic ---------------------------------------------------- */
let sdkOk = false;
try { require("@anthropic-ai/sdk"); sdkOk = true; } catch { /* no instalado */ }
console.log(`\nSDK:\n  ${ok(sdkOk)} @anthropic-ai/sdk ${sdkOk ? "instalado" : "no instalado (npm install)"}`);

/* 3) Calendario ---------------------------------------------------------- */
const { errors, warnings, stats } = validateFixtures(fixtures, TEAMS, HOST_TEAMS);
console.log(`\nCalendario (fixtures.json):`);
console.log(`  ${ok(errors.length === 0)} ${stats.total} partidos · ${stats.withTime} con hora · ${stats.withoutTime} sin hora`);
if (errors.length) { hardFail = true; errors.slice(0, 5).forEach(e => console.log(`     ❌ ${e}`)); }
if (warnings.length) console.log(`     ⚠️  ${warnings.length} aviso(s) (corre 'npm run validate' para verlos)`);

/* 4) Próximo partido + predicción base ----------------------------------- */
console.log(`\nPróximo partido:`);
const next = nextUpcoming(fixtures, Date.now());
if (!next) {
  console.log(`  ⚠️  Ninguno con hora futura. Pon horas en fixtures.json (campo 'kickoff' ISO).`);
} else {
  const mins = (new Date(next.kickoff).getTime() - Date.now()) / 60000;
  console.log(`  📅 ${next.home} vs ${next.away} — en ${(mins / 60).toFixed(1)} h (${next.kickoff})`);
  try {
    const opts = {};
    if (HOST_TEAMS.includes(next.home) && !HOST_TEAMS.includes(next.away)) opts.homeAdv = Models.DEFAULTS.homeAdvantageElo;
    else if (HOST_TEAMS.includes(next.away) && !HOST_TEAMS.includes(next.home)) opts.homeAdv = -Models.DEFAULTS.homeAdvantageElo;
    const r = Models.analyzeMatch(elo[next.home], elo[next.away], opts);
    const f = p => (p * 100).toFixed(0) + "%";
    const t = r.topScores[0];
    console.log(`  ${ok(true)} Predicción base: ${next.home} ${f(r.pHome)} · X ${f(r.pDraw)} · ${next.away} ${f(r.pAway)} · marcador ${t.h}-${t.a}`);
  } catch (e) { hardFail = true; console.log(`  ❌ No se pudo calcular la predicción: ${e.message}`); }
}

/* Veredicto -------------------------------------------------------------- */
console.log(`\n${hardFail ? "❌ Hay problemas que arreglar." : "✅ Todo lo esencial funciona."}`);
if (!hasPhone || !hasKey) console.log("ℹ️  Recuerda añadir los secrets en GitHub para que envíe de verdad.");
process.exit(hardFail ? 1 : 0);
