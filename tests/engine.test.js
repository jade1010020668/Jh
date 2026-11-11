const E = require('../pronosticos/engine.js');
const V = require('./fixtures/vectors.json');
const { ok, near, section } = require('./harness.js');

// El ejemplo numérico de la especificación se calculó con sus parámetros originales. El motor ya usa
// otros (calibrados con partidos reales), así que aquí se restauran los originales y al final se devuelven.
const CALIBRATED = { ...E.PARAMS.betplay };
const SPEC = { g0: 2.40, h: 0.595, k0: 100, k1: 14, k2: 12, useSplit: true, wPrev: 0.5, w5: 0.5, rho: -0.08, w1x2: 0.20, wOver: 0.25 };
Object.assign(E.PARAMS.betplay, SPEC);

section('Primitivas contra dos implementaciones independientes (Python y Node)');
for (const v of V) {
  for (const [name, rho] of [['poisson', 0], ['dixon_coles', -0.1]]) {
    const m = E.marketsFromMatrix(E.scoreMatrix(1.4, 1.1, { rho }));
    const t = v[name];
    near(m.home, t.pH, 1e-6, name + ' pH'); near(m.draw, t.pD, 1e-6, name + ' pD'); near(m.away, t.pA, 1e-6, name + ' pA');
    near(m.over25, t.pOver25, 1e-6, name + ' over'); near(m.btts, t.pBTTS, 1e-6, name + ' btts');
    ok(`${m.topScores[0].home}-${m.topScores[0].away}` === t.topScore, name + ' marcador más probable');
  }
  for (const [name, odds] of [['devig_a', [2.18, 3.70, 3.05]], ['devig_b', [1.25, 6, 11]]]) {
    for (const meth of ['mult', 'power', 'shin']) E.devig(odds, meth).probs.forEach((p, i) => near(p, v[name][meth][i], 1e-6, `${name} ${meth}[${i}]`));
    near(E.devig(odds, 'power').param, v[name].power_k, 1e-6, name + ' k');
    near(E.devig(odds, 'shin').param, v[name].shin_z, 1e-6, name + ' z');
  }
  ['home', 'draw', 'away'].forEach((k, i) => near(E.rps([0.5, 0.3, 0.2], i), v.rps[k], 1e-9, 'rps ' + k));
}

section('Propiedades básicas');
{
  const M = E.scoreMatrix(1.7, 0.9, { rho: -0.08 });
  near(E.sum(M.map(r => E.sum(r))), 1, 1e-12, 'la matriz suma 1');
  const m = E.marketsFromMatrix(M);
  near(m.home + m.draw + m.away, 1, 1e-12, '1X2 suma 1');
  // La corrección Dixon-Coles no cambia el total de goles (solo redistribuye marcadores bajos)
  near(E.marketsFromMatrix(E.scoreMatrix(1.7, 0.9)).over25, m.over25, 1e-9, 'rho no altera el más/menos');
  ok(m.draw > E.marketsFromMatrix(E.scoreMatrix(1.7, 0.9)).draw, 'rho negativo aumenta el empate');
  ok(E.devig([2.1, null, 3.4], 'shin') === null, 'devig con cuota faltante → null');
  ok(E.devig([2.1, 1, 3.4], 'shin') === null, 'devig con cuota 1 → null');
  near(E.americanToDecimal('+145'), 2.45, 1e-9, 'americana +145'); near(E.americanToDecimal('-140'), 1 + 100 / 140, 1e-9, 'americana -140');
  ok(E.americanToDecimal('x') === null && E.americanToDecimal(0) === null, 'americana inválida → null');
  const ad = E.devig([1.85, 1.95], 'additive'); near(ad.probs[0] + ad.probs[1], 1, 1e-12, 'aditivo suma 1'); near(ad.probs[0], 0.5139, 5e-5, 'aditivo Over A');
  near(E.scoreMatrix(3, 3, { rho: -5 })[0][0] >= 0 ? 1 : 0, 1, 0, 'rho extremo no genera probabilidades negativas');
}

// ---- Ejemplo numérico completo de la especificación ----
function exampleInput(overrides) {
  const rows = [];
  rows.push({ name: 'Local', pj: 18, gf: 37, gc: 17 });
  rows.push({ name: 'Visitante', pj: 18, gf: 20, gc: 22 });
  for (let i = 0; i < 17; i++) rows.push({ name: 'E' + i, pj: 18, gf: 22, gc: 22 });
  rows.push({ name: 'E17', pj: 18, gf: 24, gc: 24 });
  const home = { name: 'Local', pj: 18, gf: 37, gc: 17, homeRec: { pj: 9, gf: 19, gc: 7 }, awayRec: { pj: 9, gf: 18, gc: 10 } };
  const away = { name: 'Visitante', pj: 18, gf: 20, gc: 22, homeRec: { pj: 9, gf: 12, gc: 9 }, awayRec: { pj: 9, gf: 8, gc: 13 } };
  const houses = [
    { name: 'Casa A', src: 'U', odds: { home: 1.37, draw: 5.40, away: 7.60, over25: 1.85, under25: 1.95 } },
    { name: 'Casa B', src: 'U', odds: { home: 1.47, draw: 4.20, away: 7.50, over25: 1.80, under25: 2.00 } }
  ];
  return Object.assign({ group: 'betplay', phase: 'regular', model: { rows, home, away, neutral: false }, houses, dataComplete: true, venueConfirmed: true }, overrides || {});
}

section('Ejemplo de la especificación: liga y fuerzas');
{
  const inp = exampleInput();
  const gm = E.goalModel(Object.assign({ group: 'betplay' }, inp.model));
  ok(gm.ok, 'modelo ok');
  near(gm.league.N, 180, 1e-9, 'N'); near(gm.league.G, 455, 1e-9, 'G');
  near(gm.league.g, 2.4821, 5e-5, 'g'); near(gm.league.muH, 1.4769, 5e-5, 'muH'); near(gm.league.muA, 1.0053, 5e-5, 'muA'); near(gm.league.m, 1.2411, 5e-5, 'm');
  near(gm.home.att, 1.3692, 5e-5, 'att local'); near(gm.home.def, 0.8656, 5e-5, 'def local');
  near(gm.away.att, 0.9411, 5e-5, 'att visitante'); near(gm.away.def, 0.9915, 5e-5, 'def visitante');
  near(gm.home.attH, 1.3950, 5e-5, 'attH'); near(gm.home.defH, 0.8262, 5e-5, 'defH');
  near(gm.away.attA, 0.9167, 5e-5, 'attA'); near(gm.away.defA, 0.9857, 5e-5, 'defA');
  near(gm.lambda, 2.0308, 1e-4, 'lambda'); near(gm.mu, 0.7614, 1e-4, 'mu');
  near(gm.probs[0], 0.663, 6e-4, 'modelo local'); near(gm.probs[1], 0.215, 6e-4, 'modelo empate'); near(gm.probs[2], 0.123, 6e-4, 'modelo visitante');
  near(gm.over25, 0.529, 6e-4, 'modelo over');
}

section('Ejemplo de la especificación: mercado, mezcla, coherencia y apuesta');
{
  const fc = E.forecast(exampleInput());
  const [A, B] = fc.market.houses;
  near(A.m1x2.overround, 1.0467, 5e-5, 'B de la casa A'); near(B.m1x2.overround, 1.0517, 5e-5, 'B de la casa B');
  [0.7100, 0.1714, 0.1186].forEach((p, i) => near(A.m1x2.probs[i], p, 6e-5, 'de-vig A ' + i));
  [0.6589, 0.2222, 0.1190].forEach((p, i) => near(B.m1x2.probs[i], p, 6e-5, 'de-vig B ' + i));
  [0.6854, 0.1956, 0.1190].forEach((p, i) => near(fc.market.x[i], p, 6e-5, 'consenso ' + i));
  near(fc.market.over, 0.5208, 6e-5, 'consenso over');
  near(fc.D, 0.0227, 5e-4, 'D'); near(fc.w, 0.20, 1e-12, 'w'); near(fc.Dou, 0.008, 6e-4, 'Dou'); near(fc.wOu, 0.25, 1e-12, 'wOu');
  near(fc.final.home, 0.6810, 6e-5, 'final local'); near(fc.final.draw, 0.1993, 6e-5, 'final empate'); near(fc.final.away, 0.1197, 6e-5, 'final visitante');
  near(fc.final.over25, 0.5228, 6e-5, 'final over');
  near(fc.fit.T, 2.7676, 2e-4, 'T'); near(fc.fit.lambda, 2.0445, 3e-4, 'lambda*'); near(fc.fit.mu, 0.7231, 3e-4, 'mu*'); near(fc.fit.rho, -0.0168, 3e-4, 'rho*');
  ok(fc.fit.residual < 1e-4, 'residuo < 0,0001');
  near(fc.btts, 0.450, 6e-4, 'BTTS');
  ok(fc.topScores[0].home === 2 && fc.topScores[0].away === 0, 'marcador 1: 2-0'); near(fc.topScores[0].p, 0.131, 6e-4, 'p(2-0)');
  ok(fc.topScores[1].home === 1 && fc.topScores[1].away === 0, 'marcador 2: 1-0'); near(fc.topScores[1].p, 0.127, 6e-4, 'p(1-0)');
  ok(fc.topScores[2].home === 2 && fc.topScores[2].away === 1, 'marcador 3: 2-1'); near(fc.topScores[2].p, 0.095, 6e-4, 'p(2-1)');
  ok(fc.quality.level === 'Completa', 'calidad Completa (' + fc.quality.level + ': ' + fc.quality.reasons.join(' | ') + ')');

  const bets = E.evaluateBets(fc, { bankroll: 2000000 });
  const draw = bets.rows.find(r => r.house === 'Casa A' && r.key === 'draw');
  near(draw.evPrice, 0.0562, 6e-4, 'EV_precio empate A'); near(draw.evFinal, 0.0762, 6e-4, 'EV_final empate A'); near(draw.ev, draw.evPrice, 1e-12, 'EV = mínimo');
  ok(bets.recommended && bets.recommended.house === 'Casa A' && bets.recommended.key === 'draw', 'se recomienda el empate en la casa A');
  ok(bets.recommended.stake === 6000, 'stake $6.000 (' + (bets.recommended && bets.recommended.stake) + ')');
  ok(bets.rows.filter(r => r.ok).length === 1, 'máximo una apuesta por partido');
  // El EV usa la cuota de ESA casa, no la mejor de todas
  const drawB = bets.rows.find(r => r.house === 'Casa B' && r.key === 'draw');
  near(drawB.evPrice, fc.market.xU[1] * 4.20 - 1, 1e-12, 'EV de B usa la cuota de B'); ok(!drawB.ok, 'empate en B no se recomienda');
}

section('Variantes de la especificación');
{
  const inp = exampleInput();
  inp.model.neutral = true;
  const gm = E.goalModel(Object.assign({ group: 'betplay' }, inp.model));
  near(gm.lambda, 1.685, 6e-4, 'neutral lambda'); near(gm.mu, 1.011, 6e-4, 'neutral mu');
  near(gm.probs[0], 0.522, 6e-4, 'neutral local'); near(gm.probs[1], 0.260, 6e-4, 'neutral empate'); near(gm.probs[2], 0.217, 6e-4, 'neutral visitante');
  const inp2 = exampleInput();
  inp2.model.away.promoted = true; delete inp2.model.away.homeRec; delete inp2.model.away.awayRec;
  const gm2 = E.goalModel(Object.assign({ group: 'betplay' }, inp2.model));
  near(gm2.away.att, 0.8755, 6e-5, 'ascendido att'); near(gm2.away.def, 1.0571, 6e-5, 'ascendido def');
  ok(gm2.level === 'total', 'sin desglose de un equipo → nivel total');
}

section('Reglas de seguridad de la apuesta');
{
  // Una sola casa del usuario: nunca se recomienda
  const one = exampleInput(); one.houses = [one.houses[0]];
  const fc1 = E.forecast(one); const b1 = E.evaluateBets(fc1, { bankroll: 2000000 });
  ok(!b1.recommended, 'con una sola casa no hay recomendación'); ok(fc1.quality.level !== 'Completa', 'una sola casa no es calidad Completa');
  // BetPlay y Rushbet comparten proveedor: cuentan como una
  const kambi = exampleInput(); kambi.houses[0].name = 'BetPlay'; kambi.houses[1].name = 'Rushbet';
  const fck = E.forecast(kambi); ok(fck.market.nU1x2 === 1, 'BetPlay + Rushbet = una casa'); ok(!E.evaluateBets(fck, { bankroll: 2000000 }).recommended, 'sin recomendación con casas no independientes');
  // Error de tecleo: una cuota disparatada no produce "valor"
  const typo = exampleInput(); typo.houses[0].odds.draw = 15;
  const bt = E.evaluateBets(E.forecast(typo), { bankroll: 2000000 });
  ok(!bt.recommended || bt.recommended.key !== 'draw' || bt.recommended.house !== 'Casa A', 'una cuota mal escrita no se recomienda');
  // Margen imposible → casa descartada
  const bad = E.evalHouse({ name: 'X', src: 'U', odds: { home: 3, draw: 4, away: 5 } }); ok(bad.m1x2 === null && bad.notes.length === 1, 'margen negativo → descartada');
  // Cuota hallada lejos de las del usuario → descartada
  const stale = exampleInput(); stale.houses.push({ name: 'DraftKings', src: 'H', odds: { home: 2.4, draw: 3.2, away: 3.1 } });
  const fcs = E.forecast(stale); ok(fcs.market.n1x2 === 2, 'la casa hallada lejana no entra al consenso'); near(fcs.market.x[0], 0.6854, 6e-5, 'el consenso no cambia');
  // Cuotas viejas (> 6 h)
  const old = exampleInput(); const t0 = 1e12; old.houses.forEach(h => { h.at = t0; });
  ok(!E.evaluateBets(E.forecast(old), { bankroll: 2000000, now: t0 + 7 * 3600e3 }).recommended, 'cuotas de hace 7 h no se recomiendan');
  ok(!!E.evaluateBets(E.forecast(old), { bankroll: 2000000, now: t0 + 3600e3 }).recommended, 'cuotas de hace 1 h sí');
  ok(!E.evaluateBets(E.forecast(old), { bankroll: 2000000, now: t0 + 3600e3, kickoff: t0 }).recommended, 'partido ya empezado: no');
  // Banca pequeña → stake 0 → no apostar
  const small = E.evaluateBets(E.forecast(exampleInput()), { bankroll: 100000 });
  ok(small.recommended && small.recommended.stake === 0, 'banca pequeña: stake redondeado a 0');
  // Discrepancia grande: el modelo no pesa y la calidad es pobre
  const far = exampleInput(); far.houses = [{ name: 'A', src: 'U', odds: { home: 2.6, draw: 3.2, away: 2.8 } }, { name: 'B', src: 'U', odds: { home: 2.55, draw: 3.25, away: 2.85 } }];
  const fcf = E.forecast(far); ok(fcf.D > 0.10 && fcf.w === 0, 'D > 0,10 → w = 0'); ok(fcf.quality.level === 'Pobre', 'D > 0,10 → calidad Pobre');
  near(fcf.final.home, fcf.market.x[0], 1e-12, 'con w = 0 el final es el mercado'); ok(!E.evaluateBets(fcf, { bankroll: 2e6 }).recommended, 'calidad Pobre: sin apuesta');
}

section('Degradación sin datos');
{
  const onlyModel = exampleInput({ houses: [] }); const f1 = E.forecast(onlyModel);
  ok(f1.quality.level === 'Parcial' && f1.w === 0, 'solo modelo en liga con modelo probado → Parcial');
  { const eu = E.forecast(Object.assign({}, onlyModel, { group: 'europa' })); ok(eu.quality.level === 'Pobre', 'solo modelo en liga sin prueba propia → Pobre'); } near(f1.final.home, f1.model.probs[0], 1e-12, 'solo modelo: final = modelo');
  const onlyMkt = exampleInput({ model: null }); const f2 = E.forecast(onlyMkt);
  ok(f2.quality.level === 'Pobre', 'solo mercado → Pobre'); near(f2.final.draw, f2.market.x[1], 1e-12, 'solo mercado: final = mercado');
  const none = E.forecast({ group: 'betplay', phase: 'regular', model: null, houses: [] });
  ok(none.quality.level === 'Sin pronóstico' && !none.final, 'sin nada → Sin pronóstico');
  const few = exampleInput(); few.model.home.pj = 3; few.model.home.gf = 5; few.model.home.gc = 2; delete few.model.home.homeRec; delete few.model.home.awayRec;
  ok(!E.goalModel(Object.assign({ group: 'betplay' }, few.model)).ok, 'menos de 5 partidos y sin torneo anterior → sin modelo');
  few.model.home.prev = { pj: 19, gf: 30, gc: 20 };
  ok(E.goalModel(Object.assign({ group: 'betplay' }, few.model)).ok, 'con torneo anterior válido → hay modelo');
  const cup = exampleInput({ phase: 'copa' }); ok(E.forecast(cup).quality.level === 'Pobre', 'copa → Pobre');
  const quad = exampleInput({ phase: 'cuadrangular' }); ok(E.forecast(quad).quality.level === 'Parcial', 'cuadrangular → máximo Parcial');
}

section('Contexto y límites');
{
  const cf = E.contextFactors([{ team: 'home', type: 'baja', role: 'goleador' }, { team: 'home', type: 'baja', role: 'creador' }, { team: 'home', type: 'baja', role: 'goleador' }, { team: 'home', type: 'rotacion' }]);
  near(cf.lambda, 0.90, 1e-12, 'el ajuste por contexto nunca baja de 0,90'); near(cf.mu, 1, 1e-12, 'bajas ofensivas del local no cambian al visitante');
  const cf2 = E.contextFactors([{ team: 'away', type: 'baja', role: 'arquero' }]); near(cf2.lambda, 1.04, 1e-12, 'baja del arquero visitante sube los goles del local');
  near(E.contextFactors([]).lambda, 1, 0, 'sin contexto → 1');
  const fit = E.fitMatrix([0.6810, 0.1993, 0.1197], 0.5228); ok(fit.residual < 1e-4, 'fitMatrix reproduce el 1X2 y el over');
  const odd = E.fitMatrix([0.05, 0.05, 0.90], 0.95); ok(Number.isFinite(odd.btts) && odd.residual >= 0, 'fitMatrix no falla con extremos');
}

section('Métricas de seguimiento');
{
  near(E.rps([1, 0, 0], 0), 0, 0, 'RPS perfecto = 0'); near(E.rps([1, 0, 0], 2), 1, 0, 'RPS peor caso = 1');
  ok(E.outcomeIndex(2, 1) === 0 && E.outcomeIndex(1, 1) === 1 && E.outcomeIndex(0, 3) === 2, 'outcomeIndex');
  const w = E.wilson(5, 10); ok(w.lo < 0.5 && w.hi > 0.5 && w.lo > 0.2 && w.hi < 0.8, 'Wilson 5/10');
  const ci1 = E.bootstrapMeanCI([0.1, -0.2, 0.05, 0.3, -0.1], 0.98, 500, 7), ci2 = E.bootstrapMeanCI([0.1, -0.2, 0.05, 0.3, -0.1], 0.98, 500, 7);
  ok(ci1.lo === ci2.lo && ci1.hi === ci2.hi && ci1.lo <= ci1.mean && ci1.mean <= ci1.hi, 'bootstrap reproducible y coherente');
  const recs = []; for (let i = 0; i < 12; i++) recs.push({ final: [0.5, 0.3, 0.2], market: [0.45, 0.3, 0.25], outcome: i % 3 });
  const ts = E.trackSummary(recs); ok(ts.n === 12 && ts.stage === 'ruido' && ts.favHit === 4, 'trackSummary básico'); ok(ts.diff && Number.isFinite(ts.diff.mean), 'diferencia frente al mercado');
  ok(E.trackSummary([]).n === 0, 'trackSummary vacío');
}

Object.assign(E.PARAMS.betplay, CALIBRATED);

section('Parámetros calibrados (los que usa la app)');
{
  const P = E.PARAMS.betplay;
  ok(P.useSplit === false && P.wPrev === 1 && P.h === 0.615 && P.wOver === 0, 'parámetros de la Liga BetPlay calibrados');
  const fc = E.forecast(exampleInput());
  ok(fc.model.level === 'total', 'el desglose local/visitante no se usa');
  near(fc.final.over25, fc.market.over, 1e-12, 'con cuotas de goles, el más/menos final es el del mercado');
  const noOU = exampleInput(); noOU.houses.forEach(h => { delete h.odds.over25; delete h.odds.under25; });
  const f2 = E.forecast(noOU); const g = f2.model.league.g;
  near(f2.final.over25, 0.5 * f2.model.over25 + 0.5 * (1 - Math.exp(-g) * (1 + g + g * g / 2)), 1e-12, 'sin cuotas de goles: mitad modelo, mitad promedio de la liga');
  ok(/poco fiable/.test(f2.overSource), 'y se avisa que es poco fiable');
  ok(E.evaluateBets(fc, { bankroll: 2000000 }).rows.length === 10, 'se siguen evaluando las diez cuotas escritas');
}

section('Reglas añadidas tras la auditoría');
{
  const t0 = 1e12, H = 3600e3;
  const base = E.evaluateBets(E.forecast(exampleInput()), { bankroll: 2000000 });
  ok(!!base.recommended, 'caso base: hay una recomendación (para que las pruebas siguientes signifiquen algo)');
  // 1. Basta UNA casa con cuotas viejas para no recomendar: la comparación ya no es entre precios del mismo momento
  const mix = exampleInput(); mix.houses[0].at = t0 - 7 * H; mix.houses[1].at = t0; // A vieja, B recién escrita
  const bm = E.evaluateBets(E.forecast(mix), { bankroll: 2000000, now: t0 + 60e3 });
  ok(!bm.recommended && bm.rows.every(r => r.why.some(w => /más de 6 horas/.test(w))), 'una casa con cuotas de hace 7 h bloquea todo el partido, también la apuesta en la otra casa');
  const mix2 = exampleInput(); mix2.houses[0].at = t0; mix2.houses[1].at = t0 - 7 * H;
  ok(!E.evaluateBets(E.forecast(mix2), { bankroll: 2000000, now: t0 + 60e3 }).recommended, 'y al revés también');
  // 2. La casa de referencia contradice al usuario: probablemente cuotas de otro partido o en otro orden
  const ref = exampleInput(); ref.houses.push({ name: 'DraftKings', src: 'H', odds: { home: 2.4, draw: 3.2, away: 3.1 } });
  const fr = E.forecast(ref);
  ok(fr.market.refDisagree1x2 === true && fr.quality.level !== 'Completa', 'referencia lejana: queda registrado y la calidad baja de Completa');
  ok(fr.quality.reasons.some(r => /no coinciden con las de referencia/.test(r)), 'el motivo se explica');
  const br = E.evaluateBets(fr, { bankroll: 2000000 });
  ok(!br.rows.some(r => r.ok && (r.key === 'home' || r.key === 'draw' || r.key === 'away')), 'sin recomendación en el 1X2 mientras las cuotas no coincidan con el mercado');
  const refOk = exampleInput(); refOk.houses.push({ name: 'DraftKings', src: 'H', odds: { home: 1.42, draw: 4.8, away: 7.4 } });
  ok(E.forecast(refOk).market.refDisagree1x2 === false, 'referencia parecida: no hay aviso');
  // 3. Un dígito mal copiado (5.60 por 4.60) ya no produce "valor": el margen de esa casa delata el error
  const typo = { group: 'betplay', phase: 'regular', model: null, dataComplete: true, venueConfirmed: true, houses: [
    { name: 'Wplay', src: 'U', odds: { home: 1.42, draw: 5.60, away: 7.60 } },
    { name: 'Codere', src: 'U', odds: { home: 1.43, draw: 4.55, away: 7.50 } }] };
  const ft = E.forecast(typo); const bt = E.evaluateBets(ft, { bankroll: 2000000 });
  ok(ft.market.houses[0].m1x2.overround < 1.03, 'la casa con la cuota mal copiada queda con un margen de menos del 3%');
  ok(!bt.recommended && bt.rows.some(r => r.why.some(w => /margen de una de sus casas/.test(w))), 'no se recomienda y se pide revisar las dos casas');
  const fine = JSON.parse(JSON.stringify(typo)); fine.houses[0].odds.draw = 4.60;
  ok(!E.evaluateBets(E.forecast(fine), { bankroll: 2000000 }).rows.some(r => r.why.some(w => /margen de una de sus casas/.test(w))), 'con la cuota bien copiada el aviso de margen no aparece');
  // 4. Los motivos no se contradicen
  const far = exampleInput(); far.houses = [{ name: 'A', src: 'U', odds: { home: 2.6, draw: 3.2, away: 2.8 } }, { name: 'B', src: 'U', odds: { home: 2.55, draw: 3.25, away: 2.85 } }];
  const rf = E.forecast(far).quality.reasons;
  ok(rf.some(r => /más de 10 puntos/.test(r)) && !rf.some(r => /entre 5 y 10 puntos/.test(r)), 'con más de 10 puntos de discrepancia no se dice además "entre 5 y 10"');
  // 5. Línea de goles convertida por la capa de datos
  const conv = E.evalHouse({ name: 'DK', src: 'H', odds: { home: 2.0, draw: 3.4, away: 3.9, over25: null, under25: null, fairOver: 0.66, overLine: 3.5 } });
  ok(conv.mOU && Math.abs(conv.mOU.probs[0] - 0.66) < 1e-12 && conv.mOU.overround === null, 'una casa con "más de 2,5" ya convertido entra al mercado de goles');
}

section('Reglas añadidas tras la revisión independiente');
{
  // Solo cuotas de más/menos (sin 1X2): no hay con qué comprobar que estén bien copiadas → no se recomienda
  const ouOnly = exampleInput(); ouOnly.houses = [{ name: 'A', src: 'U', odds: { over25: 2.18, under25: 1.76 } }, { name: 'B', src: 'U', odds: { over25: 1.90, under25: 1.90 } }];
  const fo = E.forecast(ouOnly); const bo = E.evaluateBets(fo, { bankroll: 2000000 });
  ok(!fo.market.x && bo.rows.length > 0 && !bo.recommended, 'con solo cuotas de más/menos no hay recomendación');
  ok(bo.rows.every(r => r.why.some(w => /tres cuotas del 1X2/.test(w))), 'y se pide escribir también el 1X2');
  ok(fo.quality.reasons.some(r => /No hay cuotas del 1X2 para contrastar/.test(r)), 'el motivo dice que falta el 1X2 (no que "no hay cuotas")');
  // Hora desconocida (0) no es "recién escrita"
  const unk = exampleInput(); unk.houses.forEach(h => { h.at = 0; });
  ok(!E.evaluateBets(E.forecast(unk), { bankroll: 2000000, now: 1e12 }).recommended, 'cuotas con hora desconocida cuentan como viejas');
  ok(!!E.evaluateBets(E.forecast(exampleInput()), { bankroll: 2000000, now: 1e12 }).recommended, 'sin campo de hora (quien llama no la lleva) el motor no la exige');
}
