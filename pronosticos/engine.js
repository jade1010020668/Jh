// Motor de pronóstico: funciones puras, sin DOM ni red. Corre igual en el navegador
// (window.Engine) y en Node (require) para poder probarlo con `node tests/engine.test.js`.
(function (root) {
  'use strict';

  // ---------- Utilidades numéricas ----------
  const LOG_FACT = [0];
  for (let i = 1; i <= 40; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  function poissonPmf(k, lambda) {
    if (!(lambda > 0)) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - LOG_FACT[k]);
  }

  // Bisección genérica: f debe cambiar de signo en [lo, hi].
  function bisect(f, lo, hi, iters) {
    let flo = f(lo), fhi = f(hi);
    if (!isNum(flo) || !isNum(fhi)) return null;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return null;
    for (let i = 0; i < (iters || 80); i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (fm === 0) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  // ---------- Matriz de marcadores (Poisson + corrección Dixon-Coles) ----------
  // M[x][y] = P(local anota x, visitante anota y), normalizada a 1.
  function scoreMatrix(lambdaHome, lambdaAway, opts) {
    const rho = (opts && isNum(opts.rho)) ? opts.rho : 0;
    const max = (opts && opts.maxGoals) || 10;
    const M = [];
    let total = 0;
    for (let x = 0; x <= max; x++) {
      M[x] = [];
      for (let y = 0; y <= max; y++) {
        let tau = 1;
        if (rho !== 0) {
          if (x === 0 && y === 0) tau = 1 - lambdaHome * lambdaAway * rho;
          else if (x === 0 && y === 1) tau = 1 + lambdaHome * rho;
          else if (x === 1 && y === 0) tau = 1 + lambdaAway * rho;
          else if (x === 1 && y === 1) tau = 1 - rho;
        }
        const p = poissonPmf(x, lambdaHome) * poissonPmf(y, lambdaAway) * Math.max(0, tau);
        M[x][y] = p;
        total += p;
      }
    }
    for (let x = 0; x <= max; x++) for (let y = 0; y <= max; y++) M[x][y] /= total;
    return M;
  }

  // Todos los mercados salen de la MISMA matriz: así 1X2, goles, BTTS y marcador exacto son coherentes.
  function marketsFromMatrix(M) {
    let home = 0, draw = 0, away = 0, over25 = 0, btts = 0;
    const scores = [];
    for (let x = 0; x < M.length; x++) {
      for (let y = 0; y < M[x].length; y++) {
        const p = M[x][y];
        if (x > y) home += p; else if (x === y) draw += p; else away += p;
        if (x + y >= 3) over25 += p;
        if (x >= 1 && y >= 1) btts += p;
        scores.push({ home: x, away: y, p });
      }
    }
    scores.sort((a, b) => b.p - a.p);
    return { home, draw, away, over25, under25: 1 - over25, btts, bttsNo: 1 - btts, topScores: scores.slice(0, 6) };
  }

  // ---------- Quitar el margen de la casa ----------
  // odds: cuotas decimales de TODOS los resultados del mercado. Devuelve null si falta alguna.
  // Métodos: 'mult' (normalizar inversas), 'power' (q_i^k), 'shin' (modelo de Shin).
  function devig(odds, method) {
    if (!Array.isArray(odds) || odds.length < 2 || odds.some(o => !isNum(o) || o <= 1)) return null;
    const q = odds.map(o => 1 / o);
    const Q = sum(q);
    const mult = q.map(x => x / Q);
    const base = { overround: Q, method: 'mult', probs: mult, param: null };
    if (Q <= 1.0000001 || method === 'mult' || !method) return base; // sin margen no hay nada que corregir

    if (method === 'power') {
      const k = bisect((kk) => sum(q.map(x => Math.pow(x, kk))) - 1, 1, 12);
      if (k == null) return base;
      const p = q.map(x => Math.pow(x, k));
      const s = sum(p);
      return { overround: Q, method: 'power', probs: p.map(x => x / s), param: k };
    }
    if (method === 'shin') {
      const shinP = (z) => q.map(x => (Math.sqrt(z * z + 4 * (1 - z) * x * x / Q) - z) / (2 * (1 - z)));
      const z = bisect((zz) => sum(shinP(zz)) - 1, 0, 0.5);
      if (z == null) return base;
      const p = shinP(z);
      const s = sum(p);
      return { overround: Q, method: 'shin', probs: p.map(x => x / s), param: z };
    }
    return base;
  }

  // ---------- Métricas de evaluación ----------
  // outcome: índice del resultado real (0 local, 1 empate, 2 visitante).
  function rps(probs, outcome) {
    let cumP = 0, cumO = 0, acc = 0;
    for (let i = 0; i < probs.length - 1; i++) {
      cumP += probs[i];
      cumO += (i === outcome ? 1 : 0);
      acc += (cumP - cumO) * (cumP - cumO);
    }
    return acc / (probs.length - 1);
  }
  function brier(probs, outcome) {
    return sum(probs.map((p, i) => (p - (i === outcome ? 1 : 0)) ** 2));
  }
  function logLoss(probs, outcome) {
    return -Math.log(clamp(probs[outcome], 1e-6, 1));
  }
  function brierBinary(p, happened) { return (p - (happened ? 1 : 0)) ** 2; }

  const api = {
    isNum, clamp, sum, bisect, poissonPmf,
    scoreMatrix, marketsFromMatrix, devig,
    rps, brier, logLoss, brierBinary
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
