#!/usr/bin/env node
/* ============================================================================
 *  bot/analyze-match.js  —  Análisis BASE de un partido por línea de comandos
 * ----------------------------------------------------------------------------
 *  Pensado para la RUTINA diaria: la rutina busca en la web los partidos del
 *  día y, para cada uno, llama a este script para la base matemática (Elo ->
 *  Poisson/Dixon-Coles), y luego le añade el multifactor (búsqueda web).
 *
 *  Uso:  node bot/analyze-match.js "México" "Corea del Sur"
 *  Salida: 1X2, marcador más probable, Over 2.5, Ambos marcan y aviso de empate.
 * ==========================================================================*/

"use strict";

const Models = require("../js/models.js");
const { TEAMS, HOST_TEAMS } = require("../js/data.js");
const { drawAlert, favLabel } = require("./lib/insights.js");

const elo = Object.fromEntries(TEAMS.map(t => [t.name, t.elo]));
const f = p => (p * 100).toFixed(0) + "%";

const [home, away] = process.argv.slice(2);
if (!home || !away) {
  console.error('Uso: node bot/analyze-match.js "Local" "Visitante"');
  process.exit(2);
}
for (const n of [home, away]) {
  if (elo[n] == null) {
    const lista = TEAMS.map(t => t.name).join(", ");
    console.error(`Equipo desconocido: "${n}".\nEquipos válidos: ${lista}`);
    process.exit(2);
  }
}

const opts = {};
if (HOST_TEAMS.includes(home) && !HOST_TEAMS.includes(away)) opts.homeAdv = Models.DEFAULTS.homeAdvantageElo;
else if (HOST_TEAMS.includes(away) && !HOST_TEAMS.includes(home)) opts.homeAdv = -Models.DEFAULTS.homeAdvantageElo;

const r = Models.analyzeMatch(elo[home], elo[away], opts);
const t = r.topScores[0];
const others = r.topScores.slice(1, 4).map(s => `${s.h}-${s.a}`).join(", ");

console.log(`⚽ ${home} vs ${away}  (base matemática, ${favLabel(r)})`);
console.log(`🔮 Marcador más probable: ${t.h}-${t.a} (${f(t.p)})`);
console.log(`📊 ${home}: ${f(r.pHome)} · Empate: ${f(r.pDraw)} · ${away}: ${f(r.pAway)}`);
console.log(`⚽ +2.5 goles: ${f(r.over25)} · Ambos marcan: ${f(r.btts)}`);
console.log(`🎲 Otros marcadores: ${others}`);
if (drawAlert(r)) console.log(`⚖️ Empate muy probable (partido parejo)`);
