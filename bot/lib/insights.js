/* ============================================================================
 *  bot/lib/insights.js  —  Lecturas extra de una predicción (PURAS y testeables)
 * ----------------------------------------------------------------------------
 *  Pequeñas reglas que enriquecen el mensaje sin tocar el modelo:
 *    · drawAlert  -> "empate muy probable" cuando el partido está muy igualado.
 *    · favLabel   -> etiqueta de cuán claro es el favorito.
 *  Son deterministas: misma predicción -> misma lectura.
 * ==========================================================================*/

"use strict";

// Si el empate está a <= DRAW_MARGIN del favorito, el partido es "parejo".
const DRAW_MARGIN = 0.10;

/** Probabilidad del favorito 1X2 (el mayor entre local y visitante). */
function favoriteProb(r) { return Math.max(r.pHome, r.pAway); }

/**
 *  ¿Empate muy probable? True cuando ningún equipo domina: el empate está
 *  cerca del favorito (o es directamente el resultado más probable).
 *  Pensado para avisar de los partidos parejos, donde el modelo —que reporta
 *  el ÚNICO resultado más probable— suele "quedarse corto" con las X.
 */
function drawAlert(r) {
  return r.pDraw >= favoriteProb(r) - DRAW_MARGIN;
}

/** Etiqueta corta de confianza en el favorito (para el mensaje). */
function favLabel(r) {
  const f = favoriteProb(r);
  if (f >= 0.65) return "favorito claro";
  if (f >= 0.50) return "favorito moderado";
  return "muy abierto";
}

module.exports = { DRAW_MARGIN, favoriteProb, drawAlert, favLabel };
