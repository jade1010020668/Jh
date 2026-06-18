/* ============================================================================
 *  simulation.js  —  Simulación de Montecarlo del Mundial 2026
 * ----------------------------------------------------------------------------
 *  Simula el torneo completo miles de veces para estimar, de cada selección,
 *  la probabilidad de:
 *    - avanzar de la fase de grupos (1.º/2.º o mejor 3.º)
 *    - llegar a octavos, cuartos, semis, final y ser CAMPEÓN.
 *
 *  Formato 2026: 12 grupos de 4. Avanzan los 2 primeros de cada grupo + los
 *  8 mejores terceros = 32 equipos a la ronda eliminatoria.
 *
 *  NOTA sobre el cuadro (bracket): el emparejamiento eliminatorio oficial de
 *  FIFA es fijo y complejo. Aquí se usa un cuadro por SIEMBRA (los 32
 *  clasificados se ordenan por su rendimiento y se emparejan 1.º vs 32.º,
 *  etc.), una simplificación transparente que da probabilidades de título
 *  perfectamente representativas. Es ajustable en el futuro.
 * ==========================================================================*/

const Simulation = (() => {

  /** Orden de siembra estándar de un cuadro eliminatorio de tamaño n. */
  function seedOrder(n) {
    let seeds = [1, 2];
    const rounds = Math.log2(n);
    for (let r = 0; r < rounds - 1; r++) {
      const sum = seeds.length * 2 + 1;
      const next = [];
      for (const s of seeds) { next.push(s); next.push(sum - s); }
      seeds = next;
    }
    return seeds; // p.ej. n=4 -> [1,4,2,3]
  }

  /** Simula goles de un partido a partir de los ratings (vía Elo->Poisson). */
  function simMatchGoals(rh, ra, opts) {
    const eg = Models.expectedGoals(rh, ra, opts);
    return {
      gh: Models.samplePoisson(eg.lambdaHome),
      ga: Models.samplePoisson(eg.lambdaAway),
      lh: eg.lambdaHome, la: eg.lambdaAway,
    };
  }

  /** Resuelve un cruce eliminatorio (sin empates: prórroga/penales). */
  function simKnockout(a, b, opts) {
    const { gh, ga, lh, la } = simMatchGoals(a.elo, b.elo, opts);
    if (gh > ga) return a;
    if (ga > gh) return b;
    // Empate -> se decide por la fuerza relativa (prob. de ganar el partido).
    const pa = lh / (lh + la);
    return Math.random() < pa ? a : b;
  }

  /**
   *  Ejecuta `nSims` torneos completos.
   *  teams: [{name, group, elo, flag, isHost}]
   *  Devuelve, por equipo, conteos acumulados que luego se dividen por nSims.
   */
  function run(teams, nSims, opts = {}) {
    const stats = {};
    teams.forEach(t => stats[t.name] = {
      name: t.name, flag: t.flag, group: t.group, elo: t.elo,
      groupWinner: 0, advance: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0,
    });

    const groups = {};
    teams.forEach(t => (groups[t.group] = groups[t.group] || []).push(t));

    for (let s = 0; s < nSims; s++) {
      // -------- Fase de grupos --------
      const thirds = [];
      const qualified = []; // {team, tier:0=1.º,1=2.º,2=3.º, pts, gd, gf}

      for (const g of Object.keys(groups)) {
        const table = groups[g].map(t => ({
          team: t, pts: 0, gd: 0, gf: 0,
        }));
        // Round robin (todos contra todos).
        for (let i = 0; i < table.length; i++) {
          for (let j = i + 1; j < table.length; j++) {
            const A = table[i], B = table[j];
            const hostOpts = matchOpts(A.team, B.team, opts);
            const { gh, ga } = simMatchGoals(A.team.elo, B.team.elo, hostOpts);
            A.gf += gh; B.gf += ga;
            A.gd += gh - ga; B.gd += ga - gh;
            if (gh > ga) A.pts += 3;
            else if (ga > gh) B.pts += 3;
            else { A.pts += 1; B.pts += 1; }
          }
        }
        table.sort(cmpTable);
        stats[table[0].team.name].groupWinner++;
        qualified.push({ ...table[0], tier: 0 });
        qualified.push({ ...table[1], tier: 1 });
        thirds.push({ ...table[2], tier: 2 });
      }

      // -------- 8 mejores terceros --------
      thirds.sort(cmpTable);
      const bestThirds = thirds.slice(0, 8);
      bestThirds.forEach(t => qualified.push(t));

      // Marcar a los 32 que avanzaron.
      qualified.forEach(q => stats[q.team.name].advance++);

      // -------- Siembra del cuadro eliminatorio (32) --------
      // Orden: 1.º de grupo > 2.º > mejor 3.º, y dentro de cada nivel por
      // puntos, diferencia de goles y goles a favor.
      qualified.sort((x, y) =>
        x.tier - y.tier || cmpTable(x, y));
      const order = seedOrder(32);
      // seeds[k] (1..32) -> índice qualified[seed-1]
      let bracket = order.map(seed => qualified[seed - 1].team);

      // -------- Eliminatorias --------
      const roundKeys = ["r16", "qf", "sf", "final", "champion"];
      // R32 -> R16 (16 partidos), etc.
      let round = bracket;
      let ri = 0;
      while (round.length > 1) {
        const next = [];
        for (let i = 0; i < round.length; i += 2) {
          const w = simKnockout(round[i], round[i + 1], opts);
          next.push(w);
        }
        // Tras esta ronda, los ganadores alcanzaron la ronda roundKeys[ri].
        next.forEach(w => stats[w.name][roundKeys[ri]]++);
        round = next;
        ri++;
      }
    }

    // Normalizar a probabilidades.
    const out = Object.values(stats).map(r => ({
      name: r.name, flag: r.flag, group: r.group, elo: r.elo,
      groupWinner: r.groupWinner / nSims,
      advance: r.advance / nSims,
      r16: r.r16 / nSims,
      qf: r.qf / nSims,
      sf: r.sf / nSims,
      final: r.final / nSims,
      champion: r.champion / nSims,
    }));
    out.sort((a, b) => b.champion - a.champion);
    return out;
  }

  /** Aplica ventaja de localía si uno de los dos es anfitrión. */
  function matchOpts(teamA, teamB, opts) {
    const o = { ...opts };
    if (teamA.isHost && !teamB.isHost) o.homeAdv = (opts.homeAdvantageElo ?? 45);
    else if (teamB.isHost && !teamA.isHost) o.homeAdv = -(opts.homeAdvantageElo ?? 45);
    else o.homeAdv = 0;
    return o;
  }

  /** Comparador de tabla: puntos, dif. de goles, goles a favor (desc). */
  function cmpTable(a, b) {
    return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || Math.random() - 0.5;
  }

  return { run, seedOrder };
})();

if (typeof window !== "undefined") window.Simulation = Simulation;
