// Prueba retrospectiva del modelo de goles (sin mercado) con partidos reales ya jugados.
// En cada jornada el modelo pronostica usando SOLO lo ocurrido antes; luego se compara con el resultado.
// Uso: node tools/backtest/backtest.js            → evalúa los parámetros actuales
//      node tools/backtest/backtest.js --buscar   → busca parámetros en 2023-24 y los valida en 2025-26
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'pronosticos', 'engine.js'));
const Lg = require(path.join(__dirname, '..', '..', 'pronosticos', 'leagues.js'));
const DATA = require('./col1-2023-2026.json').partidos;
const ORDER = ['Apertura_2023', 'Finalización_2023', 'Apertura_2024', 'Finalización_2024', 'Apertura_2025', 'Finalización_2025', 'Apertura_2026', 'Finalización_2026'];
const BASE = [0.47, 0.30, 0.23], BASE_OVER = 0.43;

// Jornadas: se corta cuando un equipo se repetiría (los partidos vienen en orden de jornada).
function matchdays(rows) {
  const days = []; let cur = [], seen = new Set();
  for (const r of rows) {
    if (seen.has(r[1]) || seen.has(r[4])) { days.push(cur); cur = []; seen = new Set(); }
    cur.push(r); seen.add(r[1]); seen.add(r[4]);
  }
  if (cur.length) days.push(cur);
  return days;
}
const blank = () => ({ pj: 0, gf: 0, gc: 0 });

// Recorre los torneos en orden y devuelve, por partido, el pronóstico del modelo y el resultado.
function run(tournaments) {
  const out = [];
  let prevTotals = null;
  for (const t of ORDER) {
    const rows = DATA.filter(r => r[0] === t);
    const st = {};
    const team = (n) => (st[n] = st[n] || { tot: blank(), home: blank(), away: blank(), hist: [] });
    for (const r of rows) { team(r[1]); team(r[4]); }
    for (const day of matchdays(rows)) {
      const table = Object.entries(st).map(([name, s]) => ({ name, pj: s.tot.pj, gf: s.tot.gf, gc: s.tot.gc }));
      const side = (n) => {
        const s = st[n];
        const o = { name: n, pj: s.tot.pj, gf: s.tot.gf, gc: s.tot.gc, homeRec: { ...s.home }, awayRec: { ...s.away }, last5: s.hist.slice(-5) };
        if (prevTotals) { if (prevTotals[n]) o.prev = prevTotals[n]; else o.promoted = true; }
        return o;
      };
      for (const [, h, hg, ag, a] of day) {
        if (!tournaments.includes(t)) continue;
        const altitude = { venueM: Lg.clubBaseAltitude(h), awayBaseM: Lg.clubBaseAltitude(a), confirmed: true };
        const gm = E.goalModel({ group: 'betplay', rows: table, home: side(h), away: side(a), neutral: false, maxPjPrev: 60, altitude });
        if (!gm.ok) continue;
        out.push({ t, probs: gm.probs, over: gm.over25, outcome: E.outcomeIndex(hg, ag), isOver: hg + ag >= 3, pj: Math.min(st[h].tot.pj, st[a].tot.pj) });
      }
      for (const [, h, hg, ag, a] of day) {
        const H = st[h], A = st[a];
        H.tot.pj++; H.tot.gf += hg; H.tot.gc += ag; H.home.pj++; H.home.gf += hg; H.home.gc += ag; H.hist.push({ cond: 'L', gf: hg, gc: ag });
        A.tot.pj++; A.tot.gf += ag; A.tot.gc += hg; A.away.pj++; A.away.gf += ag; A.away.gc += hg; A.hist.push({ cond: 'V', gf: ag, gc: hg });
      }
    }
    prevTotals = {};
    for (const [n, s] of Object.entries(st)) if (s.tot.pj >= 5) prevTotals[n] = { ...s.tot };
  }
  return out;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function score(recs) {
  return {
    n: recs.length,
    rps: mean(recs.map(r => E.rps(r.probs, r.outcome))), rpsBase: mean(recs.map(r => E.rps(BASE, r.outcome))),
    ll: mean(recs.map(r => E.logLoss(r.probs, r.outcome))), llBase: mean(recs.map(r => E.logLoss(BASE, r.outcome))),
    brOver: mean(recs.map(r => (r.over - (r.isOver ? 1 : 0)) ** 2)), brOverBase: mean(recs.map(r => (BASE_OVER - (r.isOver ? 1 : 0)) ** 2)),
    favHit: mean(recs.map(r => (r.outcome === r.probs.indexOf(Math.max(...r.probs)) ? 1 : 0)))
  };
}
function calibration(recs) {
  const edges = [0, 0.40, 0.45, 0.50, 0.55, 0.60, 1.01];
  const rows = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const b = recs.filter(r => { const f = Math.max(...r.probs); return f >= edges[i] && f < edges[i + 1]; });
    if (!b.length) continue;
    const hits = b.filter(r => r.outcome === r.probs.indexOf(Math.max(...r.probs))).length;
    rows.push({ tramo: `${Math.round(edges[i] * 100)}–${Math.min(100, Math.round(edges[i + 1] * 100))}%`, n: b.length, pronosticado: mean(b.map(r => Math.max(...r.probs))), ocurrido: hits / b.length });
  }
  return rows;
}
// Significancia de la mejora sobre el pronóstico fijo (bootstrap pareado)
function versusBase(recs) {
  return E.bootstrapMeanCI(recs.map(r => E.rps(r.probs, r.outcome) - E.rps(BASE, r.outcome)), 0.98, 2000, 2026);
}
const fmt = (s) => `n=${s.n} · RPS ${s.rps.toFixed(4)} (fijo ${s.rpsBase.toFixed(4)}) · log-loss ${s.ll.toFixed(4)} (fijo ${s.llBase.toFixed(4)}) · Brier más/menos ${s.brOver.toFixed(4)} (fijo ${s.brOverBase.toFixed(4)}) · acierto del favorito ${(s.favHit * 100).toFixed(1)}%`;

const TRAIN = ORDER.slice(0, 4), TEST = ORDER.slice(4);
function report(label) {
  console.log(`\n${label}`);
  for (const [name, set] of [['2023-24', TRAIN], ['2025-26', TEST], ['todo', ORDER]]) {
    const recs = run(set); const s = score(recs); const d = versusBase(recs);
    console.log(`  ${name.padEnd(8)} ${fmt(s)}`);
    console.log(`           diferencia de RPS frente al fijo: ${d.mean.toFixed(4)} (IC 98%: ${d.lo.toFixed(4)} a ${d.hi.toFixed(4)})`);
  }
}

if (require.main === module) {
  const P = E.PARAMS.betplay;
  console.log('Parámetros actuales:', JSON.stringify({ g0: P.g0, h: P.h, k1: P.k1, k2: P.k2, wPrev: P.wPrev, w5: P.w5, rho: P.rho }));
  report('MODELO DE GOLES (sin mercado) frente a un pronóstico fijo 47/30/23:');
  console.log('\nCalibración del favorito en 2025-26 (lo pronosticado debería parecerse a lo ocurrido):');
  for (const c of calibration(run(TEST))) console.log(`  ${c.tramo.padEnd(8)} n=${String(c.n).padStart(3)} · pronosticado ${(c.pronosticado * 100).toFixed(1)}% · ocurrido ${(c.ocurrido * 100).toFixed(1)}%`);

  if (process.argv.includes('--buscar')) {
    const grid = { useSplit: [true, false], k1: [10, 14, 20, 26, 32, 40, 50], k2: [6, 12, 24, 48], wPrev: [0, 0.25, 0.5, 0.75, 1, 1.25], w5: [0, 0.25, 0.5, 0.75, 1], rho: [0, -0.04, -0.06, -0.08, -0.10, -0.12, -0.16], h: [0.57, 0.585, 0.595, 0.605, 0.615, 0.63], g0: [2.0, 2.1, 2.2, 2.3, 2.4, 2.5], altC: [0, 0.02, 0.04, 0.06, 0.08, 0.12] };
    const show = () => JSON.stringify(Object.fromEntries(Object.keys(grid).map(k => [k, P[k]])));
    const search = (set) => {
      const obj = () => score(run(set)).ll; // se optimiza el log-loss del 1X2
      let best = obj();
      for (let pass = 0; pass < 3; pass++) for (const [k, vals] of Object.entries(grid)) {
        let bv = P[k];
        for (const v of vals) { P[k] = v; const o = obj(); if (o < best - 1e-7) { best = o; bv = v; } }
        P[k] = bv;
      }
    };
    const start = { ...P };
    search(TRAIN);
    console.log('\nMejores parámetros buscando SOLO en 2023-24:', show());
    report('Con esos parámetros (2025-26 es la validación fuera de muestra):');
    Object.assign(P, start); search(ORDER);
    console.log('\nMejores parámetros buscando en TODO 2023-26:', show());
    report('Con esos parámetros (ya no hay validación independiente):');
  }
}
module.exports = { run, score, calibration, ORDER, TRAIN, TEST };
