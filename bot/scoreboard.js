#!/usr/bin/env node
/* ============================================================================
 *  bot/scoreboard.js  —  ¿Acierta el modelo? Calibración sobre resultados reales
 * ----------------------------------------------------------------------------
 *  Lee bot/results.json (predicción guardada + resultado real de cada partido)
 *  y mide la calidad del modelo, no solo que el código corra:
 *    · Brier score y RPS (1X2)  -> menor es mejor; se compara con el azar (1/3).
 *    · % de acierto del favorito (1X2) y del marcador exacto.
 *    · Acierto de Over 2.5 y de "Ambos marcan".
 *  Uso:  node bot/scoreboard.js
 * ==========================================================================*/

"use strict";

const path = require("path");
const Models = require("../js/models.js");

const results = require("./results.json").filter(m => m.actual);
const f = x => (x * 100).toFixed(0) + "%";
const r3 = x => x.toFixed(3);

if (!results.length) {
  console.log("Aún no hay partidos con resultado en results.json.");
  process.exit(0);
}

/** Índice de resultado 1X2: 0 local, 1 empate, 2 visitante. */
function outcomeIndex(a) {
  return a.homeGoals > a.awayGoals ? 0 : a.homeGoals === a.awayGoals ? 1 : 2;
}

let brier = 0, rps = 0;
let hit1X2 = 0, hitScore = 0, hitOver = 0, hitBtts = 0;
const rows = [];

for (const m of results) {
  const probs = [m.pred.pHome, m.pred.pDraw, m.pred.pAway];
  const idx = outcomeIndex(m.actual);
  brier += Models.brierScore(probs, idx);
  rps += Models.rps(probs, idx);

  const favIdx = probs.indexOf(Math.max(...probs));
  const ok1X2 = favIdx === idx;
  if (ok1X2) hit1X2++;

  const realScore = `${m.actual.homeGoals}-${m.actual.awayGoals}`;
  const okScore = m.pred.topScore === realScore;
  if (okScore) hitScore++;

  const total = m.actual.homeGoals + m.actual.awayGoals;
  if ((m.pred.over25 >= 0.5) === (total >= 3)) hitOver++;
  const realBtts = m.actual.homeGoals >= 1 && m.actual.awayGoals >= 1;
  if ((m.pred.btts >= 0.5) === realBtts) hitBtts++;

  const sign = ["🏠", "🤝", "✈️"][idx];
  rows.push(`  ${ok1X2 ? "✅" : "❌"} ${m.home} ${m.actual.homeGoals}-${m.actual.awayGoals} ${m.away}`
    + ` ${sign}  (pred ${f(probs[0])}/${f(probs[1])}/${f(probs[2])}, marcador ${m.pred.topScore}${okScore ? " ✓" : ""})`);
}

const n = results.length;
const brierAzar = 2 / 3;  // Brier de predecir 1/3-1/3-1/3 siempre

console.log(`📊 SCOREBOARD — ${n} partido(s) con resultado\n`);
rows.forEach(r => console.log(r));
console.log(`\nCalibración (menor = mejor):`);
console.log(`  Brier 1X2: ${r3(brier / n)}   (azar 1/3 = ${r3(brierAzar)} → ${brier / n < brierAzar ? "mejor que el azar ✅" : "peor que el azar ❌"})`);
console.log(`  RPS 1X2:   ${r3(rps / n)}`);
console.log(`\nAciertos:`);
console.log(`  Favorito 1X2:    ${hit1X2}/${n}  (${f(hit1X2 / n)})`);
console.log(`  Marcador exacto: ${hitScore}/${n}  (${f(hitScore / n)})`);
console.log(`  Over 2.5:        ${hitOver}/${n}  (${f(hitOver / n)})`);
console.log(`  Ambos marcan:    ${hitBtts}/${n}  (${f(hitBtts / n)})`);
console.log(`\nℹ️  Añade más partidos a bot/results.json (con su 'actual') para una medida más fiable.`);
