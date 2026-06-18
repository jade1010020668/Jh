#!/usr/bin/env node
/* ============================================================================
 *  bot/scoreboard.js  —  ¿Acierta el modelo? Calibración sobre resultados reales
 * ----------------------------------------------------------------------------
 *  Lee bot/results.json (predicción guardada + resultado real) y mide la calidad
 *  del modelo, no solo que el código corra:
 *    · Brier y RPS (1X2)            -> menor es mejor; se compara con el azar.
 *    · % de acierto del favorito y del marcador exacto; Over 2.5; Ambos marcan.
 *    · Desglose por jornada.
 *    · Análisis de EMPATES: cuántos esperaba el modelo vs cuántos hubo, y si el
 *      aviso "empate muy probable" acertó.
 *    · BASE vs OPUS: cuando hay predicción de Opus capturada en vivo, compara.
 *  Uso:  node bot/scoreboard.js
 * ==========================================================================*/

"use strict";

const Models = require("../js/models.js");
const { drawAlert } = require("./lib/insights.js");

const all = require("./results.json");
const played = all.filter(m => m.actual);     // solo los que tienen resultado
const f = x => (x * 100).toFixed(0) + "%";
const r3 = x => x.toFixed(3);
const BRIER_AZAR = 2 / 3;                      // Brier de predecir 1/3-1/3-1/3

if (!played.length) {
  console.log("Aún no hay partidos con resultado en results.json.");
  console.log(`(Hay ${all.length} predicción/es guardada/s esperando su 'actual'.)`);
  process.exit(0);
}

const outcomeIndex = a => a.homeGoals > a.awayGoals ? 0 : a.homeGoals === a.awayGoals ? 1 : 2;
const probsOf = p => [p.pHome, p.pDraw, p.pAway];
const roundLabel = m => (m.round != null ? `J${m.round}` : "en vivo");

/** Métricas agregadas de un conjunto de partidos usando un campo de predicción. */
function evaluate(list, field) {
  let brier = 0, rps = 0, hit1X2 = 0, hitScore = 0, hitOver = 0, hitBtts = 0, n = 0;
  for (const m of list) {
    const p = m[field];
    if (!p) continue;
    n++;
    const probs = probsOf(p);
    const idx = outcomeIndex(m.actual);
    brier += Models.brierScore(probs, idx);
    rps += Models.rps(probs, idx);
    if (probs.indexOf(Math.max(...probs)) === idx) hit1X2++;
    const total = m.actual.homeGoals + m.actual.awayGoals;
    if (p.topScore === `${m.actual.homeGoals}-${m.actual.awayGoals}`) hitScore++;
    if ((p.over25 >= 0.5) === (total >= 3)) hitOver++;
    const realBtts = m.actual.homeGoals >= 1 && m.actual.awayGoals >= 1;
    if ((p.btts >= 0.5) === realBtts) hitBtts++;
  }
  return { n, brier: brier / n, rps: rps / n, hit1X2, hitScore, hitOver, hitBtts };
}

function printBlock(title, e) {
  if (!e.n) return;
  console.log(`\n${title}  (${e.n} partidos)`);
  console.log(`  Brier ${r3(e.brier)} (azar ${r3(BRIER_AZAR)} → ${e.brier < BRIER_AZAR ? "mejor ✅" : "peor ❌"}) · RPS ${r3(e.rps)}`);
  console.log(`  Favorito ${e.hit1X2}/${e.n} (${f(e.hit1X2 / e.n)}) · Marcador ${e.hitScore}/${e.n} (${f(e.hitScore / e.n)})`
    + ` · Over2.5 ${e.hitOver}/${e.n} (${f(e.hitOver / e.n)}) · BTTS ${e.hitBtts}/${e.n} (${f(e.hitBtts / e.n)})`);
}

/* ---- Listado partido a partido --------------------------------------- */
console.log(`📊 SCOREBOARD — ${played.length} partido(s) con resultado\n`);
for (const m of played) {
  const probs = probsOf(m.pred);
  const idx = outcomeIndex(m.actual);
  const ok = probs.indexOf(Math.max(...probs)) === idx;
  const real = `${m.actual.homeGoals}-${m.actual.awayGoals}`;
  const flag = drawAlert(m.pred) ? " ⚖️" : "";
  console.log(`  ${ok ? "✅" : "❌"} [${roundLabel(m)}] ${m.home} ${real} ${m.away}${flag}`
    + `  (pred ${f(probs[0])}/${f(probs[1])}/${f(probs[2])}, ${m.pred.topScore}${m.pred.topScore === real ? " ✓" : ""})`);
}

/* ---- Global y por jornada -------------------------------------------- */
printBlock("🌍 GLOBAL (base)", evaluate(played, "pred"));
const rounds = [...new Set(played.map(roundLabel))].sort();
if (rounds.length > 1) for (const rl of rounds) printBlock(`📅 ${rl}`, evaluate(played.filter(m => roundLabel(m) === rl), "pred"));

/* ---- Análisis de empates --------------------------------------------- */
const expDraws = played.reduce((s, m) => s + m.pred.pDraw, 0);
const realDraws = played.filter(m => m.actual.homeGoals === m.actual.awayGoals).length;
const flagged = played.filter(m => drawAlert(m.pred));
const flaggedDraws = flagged.filter(m => m.actual.homeGoals === m.actual.awayGoals).length;
const drawsFlagged = played.filter(m => m.actual.homeGoals === m.actual.awayGoals && drawAlert(m.pred)).length;
console.log(`\n⚖️  EMPATES`);
console.log(`  Esperados por el modelo: ${expDraws.toFixed(1)}  ·  Reales: ${realDraws}`
  + (realDraws > expDraws + 2 ? "  → hubo MUCHOS más empates de lo normal" : ""));
console.log(`  Aviso "empate muy probable": ${flagged.length} marcados`
  + (flagged.length ? `, ${flaggedDraws} acabaron en X (${f(flaggedDraws / flagged.length)} de acierto)` : "")
  + `; cubrió ${drawsFlagged}/${realDraws} de los empates reales.`);

/* ---- Base vs Opus ----------------------------------------------------- */
const withOpus = played.filter(m => m.predOpus);
console.log(`\n🔎 BASE vs OPUS`);
if (!withOpus.length) {
  console.log(`  Aún no hay predicciones de Opus capturadas en vivo. Se irán guardando solas`);
  console.log(`  cada vez que el bot avise un partido (con ANTHROPIC_API_KEY puesta).`);
} else {
  const b = evaluate(withOpus, "pred"), o = evaluate(withOpus, "predOpus");
  console.log(`  Sobre ${withOpus.length} partidos con ajuste:`);
  console.log(`  Brier base ${r3(b.brier)}  vs  Opus ${r3(o.brier)}  → ${o.brier < b.brier ? "Opus MEJORA ✅" : o.brier > b.brier ? "Opus empeora ❌" : "igual"}`);
  console.log(`  Favorito base ${b.hit1X2}/${b.n}  vs  Opus ${o.hit1X2}/${o.n}`);
}

console.log(`\nℹ️  Añade resultados ('actual') a bot/results.json para medir más; el bot guarda las predicciones solo.`);
