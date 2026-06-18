"use strict";
/* Tests del motor matemático (js/models.js) — invariantes que NO deben romperse. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/models.js");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const sumMatrix = m => m.reduce((s, row) => s + row.reduce((x, p) => x + p, 0), 0);

test("eloExpected: 0.5 con ratings iguales y crece con la fuerza", () => {
  assert.ok(near(M.eloExpected(1500, 1500), 0.5));
  assert.ok(M.eloExpected(1700, 1500) > 0.5);
  assert.ok(M.eloExpected(1300, 1500) < 0.5);
  // Simetría: E(A vs B) + E(B vs A) = 1
  assert.ok(near(M.eloExpected(1700, 1500) + M.eloExpected(1500, 1700), 1));
});

test("expectedGoals: λ siempre > 0 y el más fuerte mete más", () => {
  const eg = M.expectedGoals(1800, 1500);
  assert.ok(eg.lambdaHome > 0 && eg.lambdaAway > 0);
  assert.ok(eg.lambdaHome > eg.lambdaAway);
  assert.ok(eg.supremacy > 0);
  // Equipos iguales -> λ iguales y supremacía ~0
  const eq = M.expectedGoals(1600, 1600);
  assert.ok(near(eq.lambdaHome, eq.lambdaAway, 1e-9));
});

test("expectedGoals: respeta los topes (clamp) ante diferencias enormes", () => {
  const eg = M.expectedGoals(3000, 1000);
  assert.ok(eg.lambdaHome <= 9 && eg.lambdaAway >= 0.05);
});

test("scoreMatrix: es una distribución de probabilidad (suma 1, no negativos)", () => {
  const m = M.scoreMatrix(1.6, 1.1);
  assert.ok(near(sumMatrix(m), 1, 1e-9));
  for (const row of m) for (const p of row) assert.ok(p >= 0);
});

test("marketsFromMatrix: 1X2 y Over/Under suman 1; probabilidades en [0,1]", () => {
  const m = M.scoreMatrix(1.5, 1.2);
  const r = M.marketsFromMatrix(m);
  assert.ok(near(r.pHome + r.pDraw + r.pAway, 1, 1e-9));
  assert.ok(near(r.over25 + r.under25, 1, 1e-9));
  for (const p of [r.pHome, r.pDraw, r.pAway, r.over25, r.btts]) {
    assert.ok(p >= 0 && p <= 1);
  }
});

test("topScores: 6 elementos ordenados de mayor a menor probabilidad", () => {
  const r = M.marketsFromMatrix(M.scoreMatrix(1.4, 1.4));
  assert.equal(r.topScores.length, 6);
  for (let i = 1; i < r.topScores.length; i++) {
    assert.ok(r.topScores[i - 1].p >= r.topScores[i].p);
  }
});

test("analyzeMatch: equipos iguales sin localía -> pHome ≈ pAway (simetría)", () => {
  const r = M.analyzeMatch(1600, 1600);
  assert.ok(near(r.pHome, r.pAway, 1e-9));
});

test("monotonía: subir el Elo local nunca baja la prob de victoria local", () => {
  let prev = 0;
  for (const elo of [1400, 1500, 1600, 1700, 1800, 1900]) {
    const r = M.analyzeMatch(elo, 1600);
    assert.ok(r.pHome >= prev - 1e-12, `pHome cayó en Elo ${elo}`);
    prev = r.pHome;
  }
});

test("localía: la ventaja de local sube la prob del local", () => {
  const sin = M.analyzeMatch(1600, 1600);
  const con = M.analyzeMatch(1600, 1600, { homeAdv: M.DEFAULTS.homeAdvantageElo });
  assert.ok(con.pHome > sin.pHome);
});

test("Dixon-Coles: rho cambia los marcadores bajos pero la matriz sigue sumando 1", () => {
  const a = M.scoreMatrix(1.3, 1.3, { rho: 0 });
  const b = M.scoreMatrix(1.3, 1.3, { rho: -0.06 });
  assert.ok(near(sumMatrix(a), 1) && near(sumMatrix(b), 1));
  // El ajuste toca 0-0 / 1-1 (no son idénticos a sin ajuste)
  assert.ok(Math.abs(a[0][0] - b[0][0]) > 1e-6);
  assert.ok(Math.abs(a[1][1] - b[1][1]) > 1e-6);
});

test("removeMargin: las probabilidades justas suman 1 y quitan el margen", () => {
  const odds = [1.80, 3.50, 4.20];
  const implied = odds.map(M.impliedProb).reduce((a, b) => a + b, 0);
  assert.ok(implied > 1, "debe haber margen (overround > 1)");
  for (const method of ["shin", "proporcional"]) {
    const { fair } = M.removeMargin(odds, method);
    assert.ok(near(fair.reduce((a, b) => a + b, 0), 1, 1e-6));
  }
});

test("valueBet: detecta valor (+EV) y no da Kelly negativo", () => {
  const v = M.valueBet(0.6, 2.0);          // 0.6*2 = 1.2 > 1 -> hay valor
  assert.ok(v.isValue && v.edgePct > 0 && v.kellyStakeFraction > 0);
  const nv = M.valueBet(0.3, 2.0);         // 0.3*2 = 0.6 < 1 -> sin valor
  assert.ok(!nv.isValue && nv.kellyStakeFraction === 0);
});

test("métricas de calibración: casos extremos conocidos", () => {
  assert.ok(near(M.brierScore([1, 0, 0], 0), 0));      // perfecto
  assert.ok(near(M.brierScore([0, 0, 1], 0), 2));      // máximo error
  assert.ok(M.logLossBinary(0.99, true) < M.logLossBinary(0.5, true));
  assert.ok(near(M.rps([1, 0, 0], 0), 0));
});
