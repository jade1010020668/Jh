/* ============================================================================
 *  models.js  —  Motor matemático de predicción
 * ----------------------------------------------------------------------------
 *  Implementa los modelos de referencia mundial para análisis de fútbol:
 *
 *   1. Elo (World Football Elo)            -> fuerza relativa de cada selección.
 *   2. Elo -> goles esperados (λ)          -> modelo LOG-LINEAL (Maher 1982),
 *                                             el estándar del Poisson de fútbol.
 *   3. Poisson + Dixon-Coles (1997)        -> matriz de marcadores.
 *   4. 1X2 / Over-Under / Ambos Marcan     -> derivados de la matriz.
 *   5. Cuotas <-> probabilidad y quita de margen (Shin 1992 + proporcional).
 *   6. Valor (+EV) y Criterio de Kelly     -> tamaño de apuesta.
 *   7. Brier, log-loss y RPS               -> calibración del modelo.
 *
 *  Código puro (sin DOM) para reutilizarlo en la simulación y en los tests.
 * ==========================================================================*/

const Models = (() => {

  /* ----------------------- Parámetros por defecto ------------------------ */
  const DEFAULTS = {
    eloToStrength: 0.0017, // convierte puntos Elo a "fuerza" en escala log-gol
    baseTotalGoals: 2.65,  // goles totales de referencia (media mundialista)
    homeAdvantageElo: 45,  // ventaja de localía (puntos Elo) para selecciones sede
    rho: -0.06,            // dependencia de Dixon-Coles en marcadores bajos
    maxGoals: 12,          // tope de goles para construir la matriz de marcadores
  };

  /* =======================================================================
   *  Elo
   * =====================================================================*/

  /** Resultado esperado de A frente a B (incluye empates como 0.5). */
  function eloExpected(ratingA, ratingB, homeAdvA = 0) {
    const dr = (ratingA + homeAdvA) - ratingB;
    return 1 / (1 + Math.pow(10, -dr / 400));
  }

  /* =======================================================================
   *  Elo -> goles esperados (λ)  — MODELO LOG-LINEAL (multiplicativo).
   *
   *    μ = ln(goles_base_por_equipo)
   *    d = (R_local + localía − R_visita) · sensibilidad
   *    λ_local = exp(μ + d)   ·   λ_visita = exp(μ − d)
   *
   *  Ventajas frente al modelo aditivo:
   *   · λ siempre > 0 (sin recortes artificiales).
   *   · El producto λ_local·λ_visita es constante, así que la SUMA de goles
   *     crece cuando hay desajuste -> las goleadas tienen más goles totales,
   *     que es lo que ocurre en la realidad.
   * =====================================================================*/
  function expectedGoals(ratingHome, ratingAway, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const mu = Math.log(Math.max(0.4, o.baseTotalGoals) / 2);
    const homeAdv = o.homeAdv || 0;
    const d = clamp((ratingHome + homeAdv - ratingAway) * o.eloToStrength, -2.5, 2.5);
    const lambdaHome = clamp(Math.exp(mu + d), 0.05, 9);
    const lambdaAway = clamp(Math.exp(mu - d), 0.05, 9);
    return { lambdaHome, lambdaAway, supremacy: lambdaHome - lambdaAway };
  }

  /* =======================================================================
   *  Poisson
   * =====================================================================*/
  function poissonPmf(k, lambda) {
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  }

  /** Muestreo de una Poisson (algoritmo de Knuth), para Montecarlo. */
  function samplePoisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  /* =======================================================================
   *  Dixon-Coles: corrección de dependencia en marcadores bajos.
   * =====================================================================*/
  function dcTau(x, y, lh, la, rho) {
    if (x === 0 && y === 0) return 1 - lh * la * rho;
    if (x === 0 && y === 1) return 1 + lh * rho;
    if (x === 1 && y === 0) return 1 + la * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
  }

  /* =======================================================================
   *  Matriz de marcadores P(i,j) con Poisson + Dixon-Coles (normalizada).
   * =====================================================================*/
  function scoreMatrix(lambdaHome, lambdaAway, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const n = o.maxGoals + 1;
    const m = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      m[i] = [];
      const pi = poissonPmf(i, lambdaHome);
      for (let j = 0; j < n; j++) {
        const pj = poissonPmf(j, lambdaAway);
        let p = pi * pj * dcTau(i, j, lambdaHome, lambdaAway, o.rho);
        if (p < 0) p = 0; // por seguridad ante rho extremos
        m[i][j] = p;
        sum += p;
      }
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) m[i][j] /= sum; // normalizar
    return m;
  }

  /* =======================================================================
   *  Mercados derivados de la matriz de marcadores.
   * =====================================================================*/
  function marketsFromMatrix(m) {
    const n = m.length;
    let pHome = 0, pDraw = 0, pAway = 0;
    let over25 = 0, under25 = 0, btts = 0;
    const scoreList = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const p = m[i][j];
        if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
        if (i + j >= 3) over25 += p; else under25 += p;
        if (i >= 1 && j >= 1) btts += p;
        scoreList.push({ h: i, a: j, p });
      }
    }
    scoreList.sort((a, b) => b.p - a.p);
    return { pHome, pDraw, pAway, over25, under25, btts, topScores: scoreList.slice(0, 6) };
  }

  /** Pipeline completo: ratings -> probabilidades de un partido. */
  function analyzeMatch(ratingHome, ratingAway, opts = {}) {
    const eg = expectedGoals(ratingHome, ratingAway, opts);
    const matrix = scoreMatrix(eg.lambdaHome, eg.lambdaAway, opts);
    const markets = marketsFromMatrix(matrix);
    return { ...eg, ...markets, matrix };
  }

  /* =======================================================================
   *  Cuotas <-> probabilidad y quita del margen del corredor de apuestas.
   * =====================================================================*/
  function impliedProb(decimalOdds) { return 1 / decimalOdds; }

  /** Reparto proporcional simple (rápido, pero sesga hacia los favoritos). */
  function _proportional(decimalOdds) {
    const raw = decimalOdds.map(impliedProb);
    const overround = raw.reduce((a, b) => a + b, 0);
    return {
      fair: raw.map(p => p / overround),
      overround, marginPct: (overround - 1) * 100, method: "proporcional", z: 0,
    };
  }

  /**
   *  Método de Shin (1992): corrige el sesgo favorito-perdedor estimando la
   *  proporción z de apostadores informados. Más preciso que el proporcional.
   *  Devuelve null si no procede (sin margen o fallo numérico) -> se usa el
   *  proporcional como respaldo.
   */
  function _shin(decimalOdds) {
    const pi = decimalOdds.map(impliedProb);
    const B = pi.reduce((a, b) => a + b, 0);   // "booksum" (>1 si hay margen)
    if (B <= 1.0000001 || pi.some(p => p <= 0)) return null;

    const sumP = (z) => pi.reduce((s, p) =>
      s + (Math.sqrt(z * z + 4 * (1 - z) * p * p / B) - z) / (2 * (1 - z)), 0);

    // f(z) = Σ p_i(z) − 1.  f(0) = √B − 1 > 0 ; decrece con z. Bisección.
    let lo = 0, hi = 0.5;
    if (sumP(hi) - 1 > 0) hi = 0.95;            // ampliar si hiciera falta
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      const f = sumP(mid) - 1;
      if (f > 0) lo = mid; else hi = mid;
    }
    const z = (lo + hi) / 2;
    const fair = pi.map(p =>
      (Math.sqrt(z * z + 4 * (1 - z) * p * p / B) - z) / (2 * (1 - z)));
    const total = fair.reduce((a, b) => a + b, 0);
    if (!isFinite(total) || total <= 0) return null;
    return {
      fair: fair.map(p => p / total),           // re-normalización de seguridad
      overround: B, marginPct: (B - 1) * 100, method: "shin", z,
    };
  }

  /** Quita el margen. method = "shin" (por defecto) | "proporcional". */
  function removeMargin(decimalOdds, method = "shin") {
    if (method === "proporcional") return _proportional(decimalOdds);
    return _shin(decimalOdds) || _proportional(decimalOdds);
  }

  /* =======================================================================
   *  Valor esperado (+EV) y Criterio de Kelly.
   * =====================================================================*/
  function valueBet(p, decimalOdds, kellyFraction = 0.25) {
    const ev = p * decimalOdds - 1;
    const edgePct = ev * 100;
    const fullKelly = (decimalOdds - 1) === 0 ? 0
      : (p * decimalOdds - 1) / (decimalOdds - 1);
    const kelly = Math.max(0, fullKelly) * kellyFraction;
    return {
      ev, edgePct, isValue: ev > 0,
      fullKelly: Math.max(0, fullKelly),
      kellyStakeFraction: kelly,
    };
  }

  /** Ensamblar tu modelo con el mercado. w = confianza en el mercado [0,1]. */
  function blend(modelProbs, marketFairProbs, w) {
    return modelProbs.map((pm, i) => (1 - w) * pm + w * marketFairProbs[i]);
  }

  /* =======================================================================
   *  Métricas de calibración.
   * =====================================================================*/

  /** Brier multiclase: menor es mejor (0 = perfecto). */
  function brierScore(probs, outcomeIndex) {
    let s = 0;
    for (let i = 0; i < probs.length; i++) {
      const y = i === outcomeIndex ? 1 : 0;
      s += (probs[i] - y) ** 2;
    }
    return s;
  }

  /** Brier binario para una selección (acertó/no acertó). */
  function brierBinary(p, won) { return (p - (won ? 1 : 0)) ** 2; }

  /** Log-loss binario (penaliza más la confianza equivocada). */
  function logLossBinary(p, won) {
    const c = clamp(p, 1e-6, 1 - 1e-6);
    return won ? -Math.log(c) : -Math.log(1 - c);
  }

  /** Ranked Probability Score: estándar para 1X2 (resultados ordenados). */
  function rps(probs, outcomeIndex) {
    const n = probs.length;
    let cum = 0, cumOutcome = 0, s = 0;
    for (let i = 0; i < n - 1; i++) {
      cum += probs[i];
      cumOutcome += (i === outcomeIndex ? 1 : 0);
      s += (cum - cumOutcome) ** 2;
    }
    return s / (n - 1);
  }

  /* ----------------------------- utilidades ------------------------------ */
  function factorial(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  return {
    DEFAULTS,
    eloExpected, expectedGoals,
    poissonPmf, samplePoisson,
    scoreMatrix, marketsFromMatrix, analyzeMatch,
    impliedProb, removeMargin,
    valueBet, blend,
    brierScore, brierBinary, logLossBinary, rps,
    clamp,
  };
})();

if (typeof window !== "undefined") window.Models = Models;
if (typeof module !== "undefined" && module.exports) module.exports = Models;
