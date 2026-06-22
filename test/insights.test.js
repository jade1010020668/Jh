"use strict";
/* Tests de las lecturas extra (bot/lib/insights.js): aviso de empate y etiqueta. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { drawAlert, favLabel, favoriteProb, DRAW_MARGIN } = require("../bot/lib/insights.js");

test("drawAlert: NO avisa cuando hay un favorito claro", () => {
  assert.equal(drawAlert({ pHome: 0.73, pDraw: 0.18, pAway: 0.10 }), false);
  assert.equal(drawAlert({ pHome: 0.56, pDraw: 0.24, pAway: 0.20 }), false);
});

test("drawAlert: SÍ avisa en partidos parejos (empate cerca del favorito)", () => {
  // Favorito 0.37, empate 0.28 -> diferencia 0.09 <= 0.10 -> parejo
  assert.equal(drawAlert({ pHome: 0.37, pDraw: 0.28, pAway: 0.35 }), true);
  // Empate como resultado más probable
  assert.equal(drawAlert({ pHome: 0.30, pDraw: 0.40, pAway: 0.30 }), true);
});

test("drawAlert: respeta el umbral DRAW_MARGIN exacto", () => {
  const fav = 0.40;
  assert.equal(drawAlert({ pHome: fav, pDraw: fav - DRAW_MARGIN, pAway: 0.10 }), true);   // justo en el borde
  assert.equal(drawAlert({ pHome: fav, pDraw: fav - DRAW_MARGIN - 0.01, pAway: 0.10 }), false);
});

test("favoriteProb: es el mayor entre local y visitante", () => {
  assert.equal(favoriteProb({ pHome: 0.2, pDraw: 0.3, pAway: 0.5 }), 0.5);
});

test("favLabel: clasifica la claridad del favorito", () => {
  assert.equal(favLabel({ pHome: 0.70, pDraw: 0.2, pAway: 0.1 }), "favorito claro");
  assert.equal(favLabel({ pHome: 0.55, pDraw: 0.25, pAway: 0.2 }), "favorito moderado");
  assert.equal(favLabel({ pHome: 0.40, pDraw: 0.3, pAway: 0.3 }), "muy abierto");
});
