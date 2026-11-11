// Guardián: el modelo de goles debe seguir superando a un pronóstico fijo en partidos reales ya jugados.
const { ok, near, section } = require('./harness.js');
const E = require('../pronosticos/engine.js');
const B = require('../tools/backtest/backtest.js');

section('Prueba retrospectiva con 1.494 partidos reales (Liga BetPlay 2023-2026)');
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const all = B.run(B.ORDER), test = B.run(B.TEST);
const sAll = B.score(all), sTest = B.score(test);
ok(sAll.n > 1400 && sTest.n > 700, `partidos evaluados: ${sAll.n} (validación: ${sTest.n})`);
ok(sAll.rps < sAll.rpsBase - 0.010, `RPS del modelo ${sAll.rps.toFixed(4)} mejor que el fijo ${sAll.rpsBase.toFixed(4)}`);
ok(sTest.rps < sTest.rpsBase - 0.012, `también en los torneos de validación 2025-26: ${sTest.rps.toFixed(4)} frente a ${sTest.rpsBase.toFixed(4)}`);
ok(sAll.ll < sAll.llBase - 0.03, `log-loss ${sAll.ll.toFixed(4)} mejor que el fijo ${sAll.llBase.toFixed(4)}`);
const d = E.bootstrapMeanCI(all.map(r => E.rps(r.probs, r.outcome) - E.rps([0.47, 0.30, 0.23], r.outcome)), 0.98, 2000, 2026);
ok(d.hi < 0, `la mejora no es casualidad (intervalo del 98%: ${d.lo.toFixed(4)} a ${d.hi.toFixed(4)})`);
// Calibración media: lo que el modelo pronostica en promedio se parece a lo que ocurre
const real = [0, 1, 2].map(i => mean(all.map(r => (r.outcome === i ? 1 : 0))));
[0, 1, 2].forEach((i) => near(mean(all.map(r => r.probs[i])), real[i], 0.012, ['local', 'empate', 'visitante'][i] + ': pronosticado ≈ ocurrido'));
for (const c of B.calibration(all)) ok(Math.abs(c.pronosticado - c.ocurrido) < 0.06, `favorito ${c.tramo}: pronosticado ${(c.pronosticado * 100).toFixed(0)}%, ocurrió ${(c.ocurrido * 100).toFixed(0)}% (n=${c.n})`);
