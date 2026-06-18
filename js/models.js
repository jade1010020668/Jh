/* ============================================================================
 *  models.js  —  Motor matemático de predicción
 * ----------------------------------------------------------------------------
 *  Implementa los modelos de referencia mundial para análisis de fútbol:
 *
 *   1. Elo (World Football Elo)  -> fuerza relativa de cada selección.
 *   2. Mapeo Elo -> goles esperados (λ, "expected goals" del partido).
 *   3. Poisson + corrección de Dixon-Coles (1997) -> matriz de marcadores.
 *   4. Probabilidades 1X2, Over/Under, Ambos Marcan a partir de la matriz.
 *   5. Conversión de cuotas decimales <-> probabilidad y quita del margen.
 *   6. Detección de valor (+EV) y Criterio de Kelly para el stake.
 *   7. Métricas de calibración: Brier y Ranked Probability Score (RPS).
 *
 *  Todo es código puro (sin DOM) para poder reutilizarlo en la simulación.
 * ==========================================================================*/

const Models = (() => {

  /* ----------------------- Parámetros por defecto ------------------------ */
  const DEFAULTS = {
    goalsPerElo: 0.0036,   // goles de "supremacía" por punto Elo de diferencia
    baseTotalGoals: 2.65,  // goles totales esperados de referencia (media Mundial)
    homeAdvantageElo: 45,  // ventaja de localía (puntos Elo) para selecciones sede
    rho: -0.05,            // parámetro de dependencia de Dixon-Coles (marcadores bajos)
    maxGoals: 10,          // tope de goles para construir la matriz de marcadores
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
   *  Elo -> goles esperados (λ)
   *  La diferencia de Elo se traduce en "supremacía" de goles; el total se
   *  reparte entre ambos equipos. Es el puente entre el rating y el modelo
   *  de Poisson.
   * =====================================================================*/
  function expectedGoals(ratingHome, ratingAway, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const dr = (ratingHome + (opts.homeAdv || 0)) - ratingAway;
    const supremacy = clamp(dr * o.goalsPerElo, -3.0, 3.0);
    const total = o.baseTotalGoals;
    const lambdaHome = Math.max(0.12, (total + supremacy) / 2);
    const lambdaAway = Math.max(0.12, (total - supremacy) / 2);
    return { lambdaHome, lambdaAway, supremacy };
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
    // Normalizar (tau y el truncamiento alteran ligeramente la masa total).
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) m[i][j] /= sum;
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
    return {
      pHome, pDraw, pAway,
      over25, under25, btts,
      topScores: scoreList.slice(0, 6),
    };
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

  /** Quita el "overround" (margen) repartiendo proporcionalmente. */
  function removeMargin(decimalOddsArray) {
    const raw = decimalOddsArray.map(impliedProb);
    const overround = raw.reduce((a, b) => a + b, 0);
    return {
      fair: raw.map(p => p / overround),
      overround,
      marginPct: (overround - 1) * 100,
    };
  }

  /* =======================================================================
   *  Valor esperado (+EV) y Criterio de Kelly.
   *    p   = probabilidad estimada (tu mejor estimación)
   *    odds= cuota decimal ofrecida por la casa
   *    EV por unidad apostada = p * odds - 1
   *    Kelly f* = (p*odds - 1) / (odds - 1)
   * =====================================================================*/
  function valueBet(p, decimalOdds, kellyFraction = 0.25) {
    const ev = p * decimalOdds - 1;                 // valor esperado por unidad
    const edgePct = ev * 100;                        // ventaja en %
    const fullKelly = (decimalOdds - 1) === 0 ? 0
      : (p * decimalOdds - 1) / (decimalOdds - 1);
    const kelly = Math.max(0, fullKelly) * kellyFraction;
    return {
      ev,
      edgePct,
      isValue: ev > 0,
      fullKelly: Math.max(0, fullKelly),
      kellyStakeFraction: kelly,        // fracción del bankroll a apostar
    };
  }

  /* =======================================================================
   *  Combinar (ensamblar) tu modelo con el mercado.
   *  El mercado de apuestas es muy informativo; mezclarlo mejora la
   *  calibración. w = confianza en el mercado (0 = solo modelo, 1 = solo mercado).
   * =====================================================================*/
  function blend(modelProbs, marketFairProbs, w) {
    return modelProbs.map((pm, i) => (1 - w) * pm + w * marketFairProbs[i]);
  }

  /* =======================================================================
   *  Métricas de calibración (para evaluar el modelo con resultados reales).
   * =====================================================================*/

  /** Brier score multiclase: menor es mejor (0 = perfecto). */
  function brierScore(probs, outcomeIndex) {
    let s = 0;
    for (let i = 0; i < probs.length; i++) {
      const y = i === outcomeIndex ? 1 : 0;
      s += (probs[i] - y) ** 2;
    }
    return s;
  }

  /** Ranked Probability Score: el estándar para 1X2 (resultados ordenados). */
  function rps(probs, outcomeIndex) {
    const n = probs.length;
    let cum = 0, s = 0;
    let cumOutcome = 0;
    for (let i = 0; i < n - 1; i++) {
      cum += probs[i];
      cumOutcome += (i === outcomeIndex ? 1 : 0);
      s += (cum - cumOutcome) ** 2;
    }
    return s / (n - 1);
  }

  /* ----------------------------- utilidades ------------------------------ */
  function factorial(k) {
    let r = 1;
    for (let i = 2; i <= k; i++) r *= i;
    return r;
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  return {
    DEFAULTS,
    eloExpected, expectedGoals,
    poissonPmf, samplePoisson,
    scoreMatrix, marketsFromMatrix, analyzeMatch,
    impliedProb, removeMargin,
    valueBet, blend,
    brierScore, rps,
    clamp,
  };
})();

if (typeof window !== "undefined") window.Models = Models;
