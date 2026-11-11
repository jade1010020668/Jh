// Motor de pronóstico: funciones puras, sin DOM ni red. Corre igual en el navegador
// (window.Engine) y en Node (require), para poder probarlo con `node tests/run.js`.
//
// Idea central: las cuotas de las casas (sin su margen) son el mejor pronóstico público que
// existe. El modelo de goles propio (Poisson + Dixon-Coles con fuerzas de ataque/defensa
// encogidas hacia la media) solo las ajusta un poco, y nunca cuando discrepa demasiado.
// Los parámetros marcados [M] son valores razonables SIN calibrar con datos propios.
(function (root) {
  'use strict';

  // ---------- Parámetros por grupo de liga ----------
  const PARAMS = {
    betplay: {
      g0: 2.40, h: 0.595,            // [M] goles por partido y fracción que anota el local (2023-26: 2,32 y 59,5%)
      k0: 100, k1: 14, k2: 12,       // pseudo-partidos de encogimiento: liga, equipo, desglose local/visitante
      wPrev: 0.5, w5: 0.5,           // peso del torneo anterior y sobrepeso de los últimos 5
      rho: -0.08,                    // [M] corrección Dixon-Coles (más empates y marcadores bajos)
      w1x2: 0.20, wOver: 0.25,       // [M] peso máximo del modelo frente al mercado
      base: { home: 0.47, draw: 0.30, away: 0.23, over25: 0.43 },
      altC: 0.04, altMean: 0.57      // [M] efecto de la altura por km y diferencia media de la liga
    },
    europa: {
      g0: 2.75, h: 0.555, k0: 100, k1: 8, k2: 12, wPrev: 0.3, w5: 0.5, rho: -0.05,
      w1x2: 0.15, wOver: 0.20,
      base: { home: 0.45, draw: 0.25, away: 0.30, over25: 0.52 },
      altC: 0, altMean: 0
    }
  };
  const PROMOTED_PRIOR = { a0: 0.85, d0: 1.15 }; // [M] recién ascendido: ataca menos y recibe más
  const LIMITS = {
    lambdaMin: 0.3, lambdaMax: 3.2,
    oddsMin: 1.01, oddsMax: 51,
    b1x2: [1.01, 1.15], bOU: [1.01, 1.12],  // rango creíble de la suma de inversas (1 + margen)
    staleGap: 0.06,                          // una casa a más de 6 puntos de las del usuario se descarta
    dLow: 0.05, dHigh: 0.10,                 // umbrales de discrepancia modelo-mercado
    minEV: 0.03, maxEVPrice: 0.10, maxOddsBet: 6,
    fitResidualWarn: 0.02, fitResidualBet: 0.005,
    stakeCap: 0.01, kellyFraction: 0.25, stakeRound: 1000,
    userOddsMaxAgeH: 6
  };
  // Casas que comparten proveedor de cuotas: no son opiniones independientes.
  const HOUSE_GROUPS = { betplay: 'kambi', rushbet: 'kambi' };

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

  // Bisección: devuelve la raíz de f en [lo, hi], o null si f no cambia de signo.
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
  // Como bisect, pero si no hay raíz devuelve el extremo que más se acerca a 0.
  function bisectOrEdge(f, lo, hi) {
    const r = bisect(f, lo, hi);
    if (r != null) return r;
    return Math.abs(f(lo)) <= Math.abs(f(hi)) ? lo : hi;
  }

  // ---------- Matriz de marcadores (Poisson + corrección Dixon-Coles) ----------
  function rhoBounds(lh, la) {
    return [Math.max(-1 / lh, -1 / la), Math.min(1 / (lh * la), 1)];
  }
  // M[x][y] = P(local anota x, visitante anota y), normalizada a 1.
  function scoreMatrix(lambdaHome, lambdaAway, opts) {
    let rho = (opts && isNum(opts.rho)) ? opts.rho : 0;
    const max = (opts && opts.maxGoals) || 10;
    if (rho !== 0) { const b = rhoBounds(lambdaHome, lambdaAway); rho = clamp(rho, b[0], b[1]); }
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

  // Todos los mercados salen de la MISMA matriz: 1X2, goles, BTTS y marcador exacto son coherentes.
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

  // ---------- Cuotas ----------
  // Cuota americana (+145, -110) → decimal.
  function americanToDecimal(a) {
    const n = typeof a === 'string' ? parseFloat(a.replace('+', '')) : a;
    if (!isNum(n) || n === 0) return null;
    return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  }

  // Quita el margen. odds: cuotas decimales de TODOS los resultados del mercado (null si falta alguna).
  // 'shin' para 1X2 (corrige el sesgo favorito-outsider), 'additive' para mercados de 2 resultados.
  function devig(odds, method) {
    if (!Array.isArray(odds) || odds.length < 2 || odds.some(o => !isNum(o) || o <= 1)) return null;
    const q = odds.map(o => 1 / o);
    const Q = sum(q);
    const mult = q.map(x => x / Q);
    const base = { overround: Q, method: 'mult', probs: mult, param: null };
    if (Q <= 1.0000001 || method === 'mult' || !method) return base; // sin margen no hay nada que corregir

    const power = () => {
      const k = bisect((kk) => sum(q.map(x => Math.pow(x, kk))) - 1, 1, 50);
      if (k == null) return base;
      const p = q.map(x => Math.pow(x, k));
      const s = sum(p);
      return { overround: Q, method: 'power', probs: p.map(x => x / s), param: k };
    };
    if (method === 'power') return power();
    if (method === 'additive') {
      const p = q.map(x => x - (Q - 1) / q.length);
      if (p.some(x => x <= 0)) return power();
      return { overround: Q, method: 'additive', probs: p, param: null };
    }
    if (method === 'shin') {
      const shinP = (z) => q.map(x => (Math.sqrt(z * z + 4 * (1 - z) * x * x / Q) - z) / (2 * (1 - z)));
      const z = bisect((zz) => sum(shinP(zz)) - 1, 0, 0.9);
      if (z == null) return base;
      const p = shinP(z);
      const s = sum(p);
      return { overround: Q, method: 'shin', probs: p.map(x => x / s), param: z };
    }
    return base;
  }

  const houseKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const houseGroup = (name) => HOUSE_GROUPS[houseKey(name)] || houseKey(name);
  const inRange = (o) => isNum(o) && o >= LIMITS.oddsMin && o <= LIMITS.oddsMax;

  // Evalúa una casa: valida rangos y margen, y calcula sus probabilidades sin margen.
  // house: { name, src: 'U' (escrita por el usuario) | 'H' (hallada), odds: {home,draw,away,over25,under25}, at }
  function evalHouse(house) {
    const o = house.odds || {};
    const out = { name: house.name, src: house.src, group: houseGroup(house.name), at: house.at || null, odds: o, m1x2: null, mOU: null, notes: [] };
    const t = [o.home, o.draw, o.away];
    if (t.some(v => v != null)) {
      if (!t.every(inRange)) out.notes.push('1X2 incompleto o fuera de rango (se necesitan las tres cuotas)');
      else {
        const d = devig(t, 'shin');
        if (d.overround < LIMITS.b1x2[0] || d.overround > LIMITS.b1x2[1]) out.notes.push(`1X2 descartado: margen de ${((d.overround - 1) * 100).toFixed(1)}% no creíble (revise las cuotas)`);
        else out.m1x2 = { probs: d.probs, overround: d.overround };
      }
    }
    const u = [o.over25, o.under25];
    if (u.some(v => v != null)) {
      if (!u.every(inRange)) out.notes.push('Más/menos de 2,5 incompleto o fuera de rango (se necesitan las dos cuotas)');
      else {
        const d = devig(u, 'additive');
        if (d.overround < LIMITS.bOU[0] || d.overround > LIMITS.bOU[1]) out.notes.push(`Más/menos descartado: margen de ${((d.overround - 1) * 100).toFixed(1)}% no creíble`);
        else out.mOU = { probs: d.probs, overround: d.overround };
      }
    }
    return out;
  }

  // Media geométrica (media de logaritmos) de varias distribuciones, renormalizada.
  function logPool(list) {
    if (!list.length) return null;
    const n = list[0].length;
    const g = [];
    for (let i = 0; i < n; i++) g[i] = Math.exp(sum(list.map(p => Math.log(Math.max(p[i], 1e-9)))) / list.length);
    const s = sum(g);
    return g.map(x => x / s);
  }
  const maxAbsDiff = (a, b) => Math.max.apply(null, a.map((x, i) => Math.abs(x - b[i])));

  // Consenso de mercado. Las casas del mismo grupo cuentan una vez (manda la del usuario).
  // Una casa hallada (H) que se aleja de las del usuario se descarta por cuota vieja.
  function marketConsensus(houses) {
    const evals = (houses || []).map(evalHouse);
    const res = { houses: evals, x: null, xU: null, over: null, overU: null, n1x2: 0, nU1x2: 0, nOU: 0, nUOU: 0, userDisagree1x2: false, userDisagreeOU: false, notes: [] };

    const pick = (field) => {
      const seen = {};
      const sorted = evals.filter(e => e[field]).sort((a, b) => (a.src === 'U' ? 0 : 1) - (b.src === 'U' ? 0 : 1));
      const out = [];
      for (const e of sorted) {
        if (seen[e.group]) { e.notes.push(`comparte cuotas con ${seen[e.group]}: no cuenta como casa independiente`); continue; }
        seen[e.group] = e.name;
        out.push(e);
      }
      return out;
    };
    const build = (field, label) => {
      let list = pick(field);
      const U = list.filter(e => e.src === 'U');
      const xU = U.length ? logPool(U.map(e => e[field].probs)) : null;
      let disagree = false;
      if (U.length >= 2) {
        for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) {
          if (maxAbsDiff(U[i][field].probs, U[j][field].probs) > LIMITS.staleGap) disagree = true;
        }
      }
      if (xU) {
        list = list.filter(e => {
          if (e.src !== 'H') return true;
          if (maxAbsDiff(e[field].probs, xU) > LIMITS.staleGap) { e.notes.push(`${label}: se aleja de sus cuotas; posible cuota vieja, no se usa`); e[field + 'Dropped'] = true; return false; }
          return true;
        });
      }
      return { all: list.length ? logPool(list.map(e => e[field].probs)) : null, xU, n: list.length, nU: U.length, disagree };
    };
    const a = build('m1x2', '1X2');
    res.x = a.all; res.xU = a.xU; res.n1x2 = a.n; res.nU1x2 = a.nU; res.userDisagree1x2 = a.disagree;
    const b = build('mOU', 'Más/menos');
    res.over = b.all ? b.all[0] : null; res.overU = b.xU ? b.xU[0] : null; res.nOU = b.n; res.nUOU = b.nU; res.userDisagreeOU = b.disagree;
    if (a.disagree) res.notes.push('Sus dos casas difieren mucho en el 1X2: revise que las cuotas estén bien escritas.');
    if (b.disagree) res.notes.push('Sus dos casas difieren mucho en el más/menos: revise las cuotas.');
    return res;
  }

  // ---------- Modelo de goles ----------
  // rows: tabla de la fase regular [{pj, gf, gc}]. Media de goles de la liga encogida hacia el prior.
  function leagueStats(rows, P) {
    const N = sum(rows.map(r => r.pj || 0)) / 2;
    const G = sum(rows.map(r => r.gf || 0));
    const g = (G + P.k0 * P.g0) / (N + P.k0);
    return { N, G, g, muH: g * P.h, muA: g * (1 - P.h), m: g / 2 };
  }

  function validSplit(rec, total) {
    if (!rec || !total || !isNum(rec.pj) || !isNum(rec.gf) || !isNum(rec.gc)) return false;
    return rec.pj >= 3 && rec.pj <= total.pj && rec.gf <= total.gf && rec.gc <= total.gc && Math.abs(rec.pj - total.pj / 2) <= 3;
  }
  function validPrev(prev, maxPj) {
    return !!prev && isNum(prev.pj) && prev.pj >= 5 && prev.pj <= (maxPj || 60) && isNum(prev.gf) && isNum(prev.gc) && prev.gf <= 4 * prev.pj && prev.gc <= 4 * prev.pj;
  }

  // Fuerza de ataque y defensa (1 = promedio de la liga; defensa < 1 = recibe menos goles).
  // team: { pj, gf, gc, homeRec, awayRec, prev, last5: [{cond:'L'|'V', gf, gc}], promoted }
  function teamStrength(team, lg, P, maxPjPrev) {
    const n = team.pj;
    const splitOk = validSplit(team.homeRec, team) && validSplit(team.awayRec, team) && (team.homeRec.pj + team.awayRec.pj === n);
    const nH = splitOk ? team.homeRec.pj : n / 2;
    const nA = splitOk ? team.awayRec.pj : n / 2;
    const prev = validPrev(team.prev, maxPjPrev) && !team.promoted ? team.prev : null;
    const l5 = (team.last5 || []).slice(0, Math.min(5, n));
    const gf5 = sum(l5.map(e => e.gf)), gc5 = sum(l5.map(e => e.gc));
    const e5a = sum(l5.map(e => (e.cond === 'L' ? lg.muH : lg.muA)));
    const e5d = sum(l5.map(e => (e.cond === 'L' ? lg.muA : lg.muH)));
    const GF = team.gf + (prev ? P.wPrev * prev.gf : 0) + P.w5 * gf5;
    const GC = team.gc + (prev ? P.wPrev * prev.gc : 0) + P.w5 * gc5;
    const Ea = nH * lg.muH + nA * lg.muA + (prev ? P.wPrev * prev.pj * lg.m : 0) + P.w5 * e5a;
    const Ed = nH * lg.muA + nA * lg.muH + (prev ? P.wPrev * prev.pj * lg.m : 0) + P.w5 * e5d;
    const a0 = team.promoted ? PROMOTED_PRIOR.a0 : 1, d0 = team.promoted ? PROMOTED_PRIOR.d0 : 1;
    const km = P.k1 * lg.m;
    const att = (GF + km * a0) / (Ea + km);
    const def = (GC + km * d0) / (Ed + km);
    const out = { att, def, splitOk, usedPrev: !!prev, usedLast5: l5.length };
    if (splitOk) {
      out.attH = (team.homeRec.gf / lg.muH + P.k2 * att) / (team.homeRec.pj + P.k2);
      out.defH = (team.homeRec.gc / lg.muA + P.k2 * def) / (team.homeRec.pj + P.k2);
      out.attA = (team.awayRec.gf / lg.muA + P.k2 * att) / (team.awayRec.pj + P.k2);
      out.defA = (team.awayRec.gc / lg.muH + P.k2 * def) / (team.awayRec.pj + P.k2);
    }
    return out;
  }

  // Ajuste acotado por contexto verificado (bajas, rotación, sin público). items: [{team:'home'|'away', type, role}]
  function contextFactors(items) {
    const c = { home: { a: 0, d: 0, r: 0 }, away: { a: 0, d: 0, r: 0 }, noCrowd: false };
    for (const it of (items || [])) {
      if (it.type === 'sin_publico') { c.noCrowd = true; continue; }
      const t = c[it.team];
      if (!t) continue;
      if (it.type === 'rotacion') t.r = 1;
      else if (it.type === 'baja') {
        if (it.role === 'goleador' || it.role === 'creador') t.a = Math.min(2, t.a + 1);
        else if (it.role === 'arquero' || it.role === 'defensa_titular') t.d = Math.min(2, t.d + 1);
      }
    }
    const Fp = (t) => Math.pow(0.96, t.a) * Math.pow(0.95, t.r); // el equipo produce menos
    const Fr = (t) => Math.pow(1.04, t.d);                        // el equipo recibe más
    return {
      lambda: clamp(Fp(c.home) * Fr(c.away) * (c.noCrowd ? 0.97 : 1), 0.90, 1.10),
      mu: clamp(Fp(c.away) * Fr(c.home) * (c.noCrowd ? 1.03 : 1), 0.90, 1.10)
    };
  }

  // Modelo completo de un partido.
  // md: { group, rows, home, away, neutral, altitude: {venueM, awayBaseM, confirmed}, context, maxPjPrev }
  function goalModel(md) {
    const P = PARAMS[md.group];
    const notes = [];
    if (!P) return { ok: false, notes: ['Liga sin parámetros propios: no hay modelo de goles.'] };
    if (!md.rows || md.rows.length < 4 || !md.home || !md.away) return { ok: false, notes: ['Sin tabla de la liga: no hay modelo de goles.'] };
    for (const t of [md.home, md.away]) {
      if (!isNum(t.pj) || !isNum(t.gf) || !isNum(t.gc)) return { ok: false, notes: ['Faltan datos de un equipo en la tabla.'] };
      if (t.pj < 5 && !validPrev(t.prev, md.maxPjPrev) && !t.promoted) return { ok: false, notes: [`${t.name || 'Un equipo'} lleva menos de 5 partidos y no hay torneo anterior: muestra insuficiente.`] };
    }
    const lg = leagueStats(md.rows, P);
    const sh = teamStrength(md.home, lg, P, md.maxPjPrev);
    const sa = teamStrength(md.away, lg, P, md.maxPjPrev);
    let lambda, mu, level;
    if (md.neutral) {
      lambda = lg.m * sh.att * sa.def; mu = lg.m * sa.att * sh.def; level = 'neutral';
      notes.push('Cancha neutral: sin ventaja de localía.');
    } else if (sh.splitOk && sa.splitOk) {
      lambda = lg.muH * sh.attH * sa.defA; mu = lg.muA * sa.attA * sh.defH; level = 'split';
    } else {
      lambda = lg.muH * sh.att * sa.def; mu = lg.muA * sa.att * sh.def; level = 'total';
      // La altura solo se aplica si no hay desglose local/visitante (que ya la refleja).
      const al = md.altitude;
      if (P.altC && al && isNum(al.venueM) && isNum(al.awayBaseM)) {
        const delta = Math.max(0, al.venueM - al.awayBaseM) / 1000;
        let f = clamp(P.altC * (delta - P.altMean), -0.08, 0.08);
        if (al.confirmed === false) f /= 2;
        lambda *= 1 + f; mu *= 1 - f;
        if (Math.abs(f) >= 0.005) notes.push(`Ajuste por altura: ${(f * 100).toFixed(1)}%.`);
      }
    }
    const cf = contextFactors(md.context);
    lambda *= cf.lambda; mu *= cf.mu;
    if (cf.lambda !== 1 || cf.mu !== 1) notes.push(`Ajuste por contexto verificado: local ×${cf.lambda.toFixed(2)}, visitante ×${cf.mu.toFixed(2)}.`);
    const rawL = lambda, rawM = mu;
    lambda = clamp(lambda, LIMITS.lambdaMin, LIMITS.lambdaMax); mu = clamp(mu, LIMITS.lambdaMin, LIMITS.lambdaMax);
    if (rawL !== lambda || rawM !== mu) notes.push('Goles esperados fuera de rango razonable: se recortaron.');
    const mk = marketsFromMatrix(scoreMatrix(lambda, mu, { rho: P.rho }));
    return { ok: true, league: lg, home: sh, away: sa, lambda, mu, level, contextFactors: cf, probs: [mk.home, mk.draw, mk.away], over25: mk.over25, btts: mk.btts, notes };
  }

  // ---------- Mezcla mercado + modelo ----------
  function modelWeight(w0, D) { return D < LIMITS.dLow ? w0 : (D <= LIMITS.dHigh ? w0 / 2 : 0); }
  function blend(x, m, w) {
    const g = x.map((xi, i) => Math.pow(Math.max(xi, 1e-9), 1 - w) * Math.pow(Math.max(m[i], 1e-9), w));
    const s = sum(g);
    return g.map(v => v / s);
  }

  // Ajusta una matriz de marcadores al 1X2 y al más/menos finales, para leer de ella BTTS y marcadores.
  function fitMatrix(final1x2, over) {
    const overTarget = clamp(over, 0.05, 0.95);
    const T = bisectOrEdge((t) => 1 - Math.exp(-t) * (1 + t + t * t / 2) - overTarget, 0.3, 7);
    let s = 0.5, rho = -0.08;
    const mk = (ss, rr) => marketsFromMatrix(scoreMatrix(T * ss, T * (1 - ss), { rho: rr }));
    const diffTarget = final1x2[0] - final1x2[2];
    for (let i = 0; i < 8; i++) {
      s = bisectOrEdge((ss) => { const k = mk(ss, rho); return (k.home - k.away) - diffTarget; }, 0.05, 0.95);
      rho = bisectOrEdge((rr) => mk(s, rr).draw - final1x2[1], -0.20, 0.05);
    }
    const k = mk(s, rho);
    const residual = Math.max(Math.abs(k.home - final1x2[0]), Math.abs(k.draw - final1x2[1]), Math.abs(k.away - final1x2[2]), Math.abs(k.over25 - over));
    return { T, lambda: T * s, mu: T * (1 - s), rho, residual, btts: k.btts, topScores: k.topScores };
  }

  // Pronóstico completo.
  // input: { group, phase: 'regular'|'cuadrangular'|'final'|'copa', model: datos para goalModel o null,
  //          houses: [...], dataNotes: [], dataComplete: bool, venueConfirmed: bool }
  function forecast(input) {
    const P = PARAMS[input.group] || null;
    const base = (P || PARAMS.europa).base;
    const gm = input.model ? goalModel(Object.assign({ group: input.group }, input.model)) : { ok: false, notes: ['Sin datos de tabla para este partido.'] };
    const mkt = marketConsensus(input.houses);
    const out = { params: P ? input.group : null, model: gm, market: mkt, notes: [].concat(input.dataNotes || []), base };

    const hasX = !!mkt.x, hasM = gm.ok;
    if (!hasX && !hasM) {
      out.quality = { level: 'Sin pronóstico', reasons: ['No hay cuotas válidas ni datos suficientes para el modelo.'].concat(gm.notes) };
      return out;
    }
    // 1X2
    let D = null, w = 0, final;
    if (hasX && hasM) { D = maxAbsDiff(gm.probs, mkt.x); w = modelWeight(P.w1x2, D); final = blend(mkt.x, gm.probs, w); }
    else if (hasX) final = mkt.x.slice();
    else final = gm.probs.slice();
    // Más de 2,5
    let Dou = null, wOu = 0, over, overSource;
    if (mkt.over != null && hasM) { Dou = Math.abs(gm.over25 - mkt.over); wOu = modelWeight(P.wOver, Dou); over = blend([mkt.over, 1 - mkt.over], [gm.over25, 1 - gm.over25], wOu)[0]; overSource = 'mercado+modelo'; }
    else if (mkt.over != null) { over = mkt.over; overSource = 'mercado'; }
    else if (hasM) { over = gm.over25; overSource = 'modelo'; }
    else { over = base.over25; overSource = 'promedio de la liga'; }

    const fit = fitMatrix(final, over);
    out.D = D; out.w = w; out.Dou = Dou; out.wOu = wOu; out.overSource = overSource;
    out.final = { home: final[0], draw: final[1], away: final[2], over25: over, under25: 1 - over };
    out.fit = fit;
    out.btts = fit.btts; out.topScores = fit.topScores.slice(0, 5);

    // Calidad de los datos (no es "confianza en el resultado")
    const poor = [], partial = [];
    if (!hasX) poor.push('No hay cuotas válidas: el número sale solo del modelo de goles.');
    if (!hasM) poor.push('Sin modelo de goles' + (gm.notes[0] ? ` (${gm.notes[0]})` : '') + ': el número es solo el mercado.');
    if (hasM && Math.min(input.model.home.pj, input.model.away.pj) < 8) poor.push('Algún equipo lleva menos de 8 partidos en el torneo.');
    if (D != null && D > LIMITS.dHigh) poor.push('El modelo y el mercado discrepan en más de 10 puntos: se muestra el mercado. Lo más probable es que al modelo le falte información.');
    if (input.phase === 'final' || input.phase === 'copa') poor.push('Partido de final o de copa: los datos de la fase regular pesan poco.');
    if (!P) poor.push('Liga sin parámetros propios.');
    if (fit.residual > LIMITS.fitResidualWarn) poor.push('El 1X2 y el más/menos no cuadran entre sí: revise las cuotas. Ambos anotan y marcadores son aproximados.');
    if (mkt.n1x2 < 2 || mkt.nU1x2 < 1) partial.push('Menos de dos casas independientes (y al menos una escrita por usted).');
    if (D != null && D >= LIMITS.dLow) partial.push('El modelo y el mercado discrepan entre 5 y 10 puntos.');
    if (hasM && Math.min(input.model.home.pj, input.model.away.pj) < 12) partial.push('Algún equipo lleva menos de 12 partidos.');
    if (input.phase === 'cuadrangular') partial.push('Fase final del torneo: los equipos no juegan igual que en la fase regular.');
    if (input.dataComplete === false) partial.push('Faltó algún bloque de datos (desglose local/visitante, torneo anterior o últimos partidos).');
    if (input.venueConfirmed === false) partial.push('Sede no confirmada.');
    if (mkt.userDisagree1x2 || mkt.userDisagreeOU) partial.push('Sus casas difieren mucho entre sí.');
    out.quality = poor.length ? { level: 'Pobre', reasons: poor.concat(partial) } : (partial.length ? { level: 'Parcial', reasons: partial } : { level: 'Completa', reasons: ['Dos o más casas independientes, modelo y mercado de acuerdo, muestra suficiente.'] });
    return out;
  }

  // ---------- Reglas de apuesta ----------
  // Devuelve una fila por mercado y casa del usuario, y como máximo UNA recomendación por partido.
  // El valor solo puede venir de que SU casa pague más que el consenso de sus propias casas;
  // el modelo y las cuotas halladas solo pueden bajarlo, nunca crearlo.
  function evaluateBets(fc, opts) {
    const o = opts || {};
    const rows = [];
    const res = { rows, recommended: null, blockers: [] };
    if (!fc || !fc.final) { res.blockers.push('No hay pronóstico.'); return res; }
    const mkt = fc.market;
    const now = o.now || Date.now();
    const fresh = (e) => !e.at || ((now - e.at) <= LIMITS.userOddsMaxAgeH * 3600e3);
    const beforeKickoff = !o.kickoff || now < o.kickoff;
    const markets = [
      { key: 'home', label: 'Gana local', group: '1x2', xU: mkt.xU ? mkt.xU[0] : null, p: fc.final.home },
      { key: 'draw', label: 'Empate', group: '1x2', xU: mkt.xU ? mkt.xU[1] : null, p: fc.final.draw },
      { key: 'away', label: 'Gana visitante', group: '1x2', xU: mkt.xU ? mkt.xU[2] : null, p: fc.final.away },
      { key: 'over25', label: 'Más de 2,5 goles', group: 'ou', xU: mkt.overU, p: fc.final.over25 },
      { key: 'under25', label: 'Menos de 2,5 goles', group: 'ou', xU: mkt.overU != null ? 1 - mkt.overU : null, p: fc.final.under25 }
    ];
    const general = [];
    if (!(fc.quality.level === 'Completa' || fc.quality.level === 'Parcial')) general.push('La calidad de los datos es pobre.');
    if (!beforeKickoff) general.push('El partido ya empezó.');
    if (fc.fit.residual > LIMITS.fitResidualBet) general.push('El 1X2 y el más/menos no cuadran con precisión.');

    for (const e of mkt.houses.filter(h => h.src === 'U')) {
      for (const m of markets) {
        const c = e.odds[m.key];
        const field = m.group === '1x2' ? 'm1x2' : 'mOU';
        if (!inRange(c) || !e[field]) continue;
        const nU = m.group === '1x2' ? mkt.nU1x2 : mkt.nUOU;
        const D = m.group === '1x2' ? fc.D : fc.Dou;
        const disagree = m.group === '1x2' ? mkt.userDisagree1x2 : mkt.userDisagreeOU;
        const evPrice = m.xU != null ? m.xU * c - 1 : null;
        const evFinal = m.p * c - 1;
        const ev = evPrice != null ? Math.min(evPrice, evFinal) : null;
        const why = general.slice();
        if (nU < 2) why.push('Se necesitan cuotas de dos casas independientes para comparar.');
        if (disagree) why.push('Sus dos casas difieren demasiado: revise las cuotas.');
        if (!fresh(e)) why.push('Las cuotas tienen más de 6 horas: actualícelas.');
        if (ev == null || ev < LIMITS.minEV) why.push('No paga lo suficiente por encima de su valor (se exige +3%).');
        if (evPrice != null && evPrice > LIMITS.maxEVPrice) why.push('Diferencia demasiado grande entre casas: casi seguro es un error al escribir la cuota.');
        if (D != null && D > LIMITS.dHigh) why.push('El modelo discrepa demasiado del mercado en este partido.');
        if (c > LIMITS.maxOddsBet) why.push('Cuota superior a 6: demasiada varianza.');
        const kelly = ev != null && ev > 0 ? ev / (c - 1) : 0;
        const pctStake = Math.min(LIMITS.stakeCap, LIMITS.kellyFraction * kelly);
        const bank = isNum(o.bankroll) && o.bankroll > 0 ? o.bankroll : 0;
        const stake = why.length === 0 && bank ? Math.floor((bank * pctStake) / LIMITS.stakeRound) * LIMITS.stakeRound : 0;
        rows.push({ house: e.name, key: m.key, label: m.label, odds: c, evPrice, evFinal, ev, ok: why.length === 0, why, pctStake: why.length === 0 ? pctStake : 0, stake });
      }
    }
    const ok = rows.filter(r => r.ok).sort((a, b) => b.ev - a.ev);
    if (ok.length) {
      res.recommended = ok[0]; // máximo una apuesta por partido
      for (const r of ok.slice(1)) { r.ok = false; r.stake = 0; r.pctStake = 0; r.why = ['Solo se recomienda una apuesta por partido (la de mayor valor).']; }
    }
    return res;
  }

  // ---------- Métricas de seguimiento ----------
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
  function brier(probs, outcome) { return sum(probs.map((p, i) => (p - (i === outcome ? 1 : 0)) ** 2)); }
  function logLoss(probs, outcome) { return -Math.log(clamp(probs[outcome], 0.01, 0.99)); }
  function outcomeIndex(homeGoals, awayGoals) { return homeGoals > awayGoals ? 0 : (homeGoals === awayGoals ? 1 : 2); }

  // Generador pseudoaleatorio con semilla fija (resultados reproducibles).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Intervalo de la media por bootstrap (remuestreo con reemplazo).
  function bootstrapMeanCI(values, level, reps, seed) {
    const n = values.length;
    if (!n) return null;
    const rnd = mulberry32(seed || 12345);
    const means = [];
    for (let r = 0; r < (reps || 2000); r++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += values[Math.floor(rnd() * n)];
      means.push(s / n);
    }
    means.sort((a, b) => a - b);
    const alpha = (1 - (level || 0.98)) / 2;
    return { mean: sum(values) / n, lo: means[Math.floor(alpha * means.length)], hi: means[Math.min(means.length - 1, Math.ceil((1 - alpha) * means.length) - 1)] };
  }
  // Intervalo de Wilson para una proporción (z = 1,96 → 95%).
  function wilson(k, n, z) {
    if (!n) return null;
    const zz = z || 1.96, p = k / n, d = 1 + zz * zz / n;
    const c = (p + zz * zz / (2 * n)) / d, h = (zz * Math.sqrt(p * (1 - p) / n + zz * zz / (4 * n * n))) / d;
    return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
  }

  // Resumen de desempeño. records: [{ final:[3], market:[3]|null, outcome }] ya resueltos.
  function trackSummary(records) {
    const n = records.length;
    const withMkt = records.filter(r => r.market);
    const favHit = records.filter(r => r.outcome === r.final.indexOf(Math.max.apply(null, r.final))).length;
    const out = { n, nMarket: withMkt.length, favHit, stage: n < 100 ? 'ruido' : (n < 300 ? 'inicial' : 'amplio') };
    out.meanRps = n ? sum(records.map(r => rps(r.final, r.outcome))) / n : null;
    if (withMkt.length) {
      const diffs = withMkt.map(r => rps(r.final, r.outcome) - rps(r.market, r.outcome));
      out.rpsMarket = sum(withMkt.map(r => rps(r.market, r.outcome))) / withMkt.length;
      out.diff = bootstrapMeanCI(diffs, 0.98, 2000, 20261111); // negativo = la app va mejor que el mercado
    }
    const bins = n >= 300 ? 5 : 3;
    const edges = bins === 5 ? [0, 0.40, 0.50, 0.60, 0.70, 1.01] : [0, 0.45, 0.60, 1.01];
    out.calibration = [];
    for (let b = 0; b < bins; b++) {
      const inBin = records.filter(r => { const f = Math.max.apply(null, r.final); return f >= edges[b] && f < edges[b + 1]; });
      const k = inBin.filter(r => r.outcome === r.final.indexOf(Math.max.apply(null, r.final))).length;
      out.calibration.push({ from: edges[b], to: Math.min(1, edges[b + 1]), n: inBin.length, hits: k, predicted: inBin.length ? sum(inBin.map(r => Math.max.apply(null, r.final))) / inBin.length : null, observed: wilson(k, inBin.length) });
    }
    return out;
  }

  const api = {
    PARAMS, LIMITS, PROMOTED_PRIOR,
    isNum, clamp, sum, bisect, poissonPmf,
    scoreMatrix, marketsFromMatrix, rhoBounds,
    americanToDecimal, devig, evalHouse, logPool, marketConsensus, houseGroup,
    leagueStats, teamStrength, contextFactors, goalModel, validSplit, validPrev,
    modelWeight, blend, fitMatrix, forecast, evaluateBets,
    rps, brier, logLoss, outcomeIndex, bootstrapMeanCI, wilson, trackSummary
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
