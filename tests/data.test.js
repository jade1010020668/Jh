const D = require('../pronosticos/data.js');
const E = require('../pronosticos/engine.js');
const L = require('../pronosticos/leagues.js');
const { ok, near, section } = require('./harness.js');
const fx = (n) => require('./fixtures/espn/' + n);

const sb = D.parseScoreboard(fx('scoreboard-col1-20261114.json'));
const groups = D.parseStandings(fx('standings-col1.json'));
const core = D.parseCore(fx('core-col1-2026-5.json'));
const prevCore = D.parseCore(fx('core-col1-2026-1.json'));
const summary = D.parseSummary(fx('summary-401878029.json'));
const cfg = L.LEAGUES['col.1'];
const ev = sb.find(e => e.id === '401878029');

section('Calendario real (ESPN, 14-nov-2026)');
ok(sb.length === 7, '7 partidos'); ok(!!ev, 'está Nacional–Once Caldas');
ok(ev.home.name === 'Atlético Nacional' && ev.away.name === 'Once Caldas' && ev.home.id === '5264' && ev.away.id === '2919', 'equipos e ids');
ok(ev.date === '2026-11-14T20:30:00.000Z' && ev.state === 'pre' && !ev.completed, 'fecha y estado');
ok(ev.venue.city === 'Medellin' && ev.seasonSlug === 'clausura', 'sede y torneo');
near(ev.house.odds.home, 2.45, 1e-9, 'cuota local +145'); near(ev.house.odds.draw, 3.0, 1e-9, 'empate +200'); near(ev.house.odds.away, 2.75, 1e-9, 'visitante +175');
near(ev.house.odds.over25, 1 + 100 / 140, 1e-9, 'over -140'); near(ev.house.odds.under25, 1 + 100 / 105, 1e-9, 'under -105');
ok(ev.house.src === 'H' && ev.house.name === 'DraftKings', 'casa hallada');

section('Tabla y desglose reales');
ok(groups.length === 1 && groups[0].rows.length === 20 && groups[0].year === 2026 && groups[0].type === 5, 'una tabla de 20 equipos, Clausura 2026');
const nal = groups[0].rows.find(r => r.id === '5264');
ok(nal.pj === 18 && nal.g === 12 && nal.e === 3 && nal.p === 3 && nal.gf === 37 && nal.gc === 17 && nal.pts === 39, 'fila de Nacional');
ok(D.tableChecks(groups[0].rows).ok, 'la tabla real pasa las comprobaciones (' + D.tableChecks(groups[0].rows).notes.join(' ') + ')');
ok(Object.keys(core).length === 20, 'desglose de 20 equipos');
ok(core['5264'].home.pj === 9 && core['5264'].home.gf === 19 && core['5264'].home.gc === 7 && core['5264'].away.gf === 18 && core['5264'].away.gc === 10, 'Nacional en casa 9 PJ 19-7, fuera 18-10');
ok(Object.values(core).every(c => c.home && c.away), 'todos los desgloses cuadran con el total');
ok(prevCore['5264'].total.pj === 19 && prevCore['5264'].total.gf === 35, 'Apertura de Nacional');
{
  const broken = JSON.parse(JSON.stringify(groups[0].rows)); broken[0].gf += 3;
  ok(!D.tableChecks(broken).ok, 'una tabla alterada no pasa las comprobaciones');
  const bad = D.parseCore({ standings: [{ team: { $ref: 'x/teams/1?y' }, records: [{ type: 'total', stats: [{ name: 'gamesPlayed', value: 10 }, { name: 'pointsFor', value: 12 }, { name: 'pointsAgainst', value: 9 }, { name: 'homeGamesPlayed', value: 5 }, { name: 'homePointsFor', value: 9 }, { name: 'homePointsAgainst', value: 2 }, { name: 'awayGamesPlayed', value: 5 }, { name: 'awayPointsFor', value: 9 }, { name: 'awayPointsAgainst', value: 7 }] }] }] });
  ok(bad['1'].home === null, 'desglose que no suma el total → se descarta');
  ok(D.parseStandings(null).length === 0 && D.parseScoreboard({}).length === 0 && Object.keys(D.parseCore(undefined)).length === 0, 'respuestas vacías no rompen');
}

section('Resumen real: últimos 5 y cuotas');
ok(summary.last5['5264'].length === 5 && summary.last5['2919'].length === 5, 'cinco partidos por equipo');
const l0 = summary.last5['5264'][0]; ok(l0.cond === 'L' && l0.gf === 2 && l0.gc === 1 && l0.league === 'Colombian Primera A', 'primer partido de Nacional: local 2-1');
const cup = summary.last5['5264'][4]; ok(cup.cond === 'V' && cup.league === 'Copa Colombia', 'el último fue de copa y de visitante');
near(summary.house.odds.home, 2.45, 1e-9, 'cuotas del resumen'); ok(summary.status.completed === false, 'partido sin jugar');

section('Entrada del motor y pronóstico con datos reales');
const input = D.buildInput({ cfg, event: ev, groups, core, prevCore, summary, leagueName: 'Colombian Primera A' });
ok(input.model && input.phase === 'regular' && input.dataComplete === true, 'modelo armado, fase regular, datos completos (' + input.dataNotes.join(' | ') + ')');
ok(input.model.home.homeRec.gf === 19 && input.model.home.prev.pj === 19 && !input.model.home.promoted, 'desglose y torneo anterior del local');
ok(input.model.home.last5.length === 4 && input.model.home.last5.every(e => e.league === 'Colombian Primera A'), 'los últimos 5 excluyen la copa');
ok(input.houses.length === 1 && input.houses[0].src === 'H', 'una casa hallada');
ok(input.model.altitude.venueM === 1495 && input.model.altitude.awayBaseM === 2150 && input.venueConfirmed, 'altitudes: Medellín y Manizales');
const fc = E.forecast(input);
ok(fc.model.ok && fc.model.level === 'split', 'modelo con desglose');
near(fc.final.home + fc.final.draw + fc.final.away, 1, 1e-9, 'el 1X2 final suma 1');
ok(fc.model.lambda > 1.2 && fc.model.lambda < 2.6 && fc.model.mu > 0.5 && fc.model.mu < 1.6, `goles esperados plausibles (${fc.model.lambda.toFixed(2)} – ${fc.model.mu.toFixed(2)})`);
ok(fc.quality.level === 'Pobre' || fc.quality.level === 'Parcial', 'sin cuotas del usuario nunca es calidad Completa');
ok(!E.evaluateBets(fc, { bankroll: 1e6 }).recommended, 'sin cuotas del usuario no hay recomendación');
console.log(`    Nacional–Once Caldas → modelo ${fc.model.probs.map(p => (p * 100).toFixed(0)).join('/')} · mercado ${fc.market.x.map(p => (p * 100).toFixed(0)).join('/')} · final ${[fc.final.home, fc.final.draw, fc.final.away].map(p => (p * 100).toFixed(0)).join('/')} · D=${fc.D.toFixed(3)} · ${fc.quality.level}`);

section('Fase, torneo anterior y copas');
ok(D.detectPhase(cfg, { seasonSlug: 'clausura' }, { pj: 19 }, { pj: 19 }, 20) === 'cuadrangular', 'fase regular terminada → fase final');
ok(D.detectPhase(cfg, { seasonSlug: 'clausura-cuadrangulares' }, { pj: 18 }, { pj: 18 }, 20) === 'cuadrangular', 'slug de cuadrangulares');
ok(D.detectPhase(cfg, { seasonSlug: 'clausura', note: 'Final - Ida' }, { pj: 19 }, { pj: 19 }, 20) === 'final', 'nota de final');
ok(D.detectPhase(L.LEAGUES['eng.1'], { seasonSlug: 'x' }, { pj: 30 }, { pj: 30 }, 20) === 'regular', 'Europa siempre regular');
ok(D.detectPhase(L.LEAGUES['uefa.champions'], {}, null, null, 0) === 'copa', 'copa');
const pt = D.prevTournament(cfg, 2026, 5); ok(pt.year === 2026 && pt.type === 1, 'anterior al Clausura 2026 = Apertura 2026');
const pt2 = D.prevTournament(cfg, 2027, 1); ok(pt2.year === 2026 && pt2.type === 5, 'anterior al Apertura 2027 = Clausura 2026');
const pt3 = D.prevTournament(L.LEAGUES['eng.1'], 2026, 1); ok(pt3.year === 2025 && pt3.type === 1, 'Europa: temporada anterior');
const cupIn = D.buildInput({ cfg: L.LEAGUES['uefa.champions'], event: ev, groups: [], summary });
ok(cupIn.model === null && cupIn.phase === 'copa' && cupIn.houses.length === 1, 'copa: solo mercado');
const noTable = D.buildInput({ cfg, event: ev, groups: [], core: null, prevCore: null, summary: null });
ok(noTable.model === null && noTable.dataComplete === false, 'sin tabla → sin modelo');
const promo = D.buildInput({ cfg, event: ev, groups, core, prevCore: { '5264': prevCore['5264'] }, summary });
ok(promo.model.away.promoted === true && !promo.model.away.prev, 'equipo ausente del torneo anterior → ascendido');

section('Contexto de la IA: saneo y verificación de fuente');
{
  const txt = 'Análisis...\n<datos_json>{"contexto":[{"equipo":"local","tipo":"baja","jugador":"Fulano","rol":"goleador","estado":"confirmada","fuente_url":"https://www.futbolred.com/nota/1"},{"equipo":"visitante","tipo":"baja","jugador":"Zutano","rol":"arquero","estado":"confirmada","fuente_url":"https://inventada.com/x"},{"equipo":"local","tipo":"rotacion","estado":"rumor","fuente_url":"https://www.futbolred.com/nota/1"},{"equipo":"marte","tipo":"baja"},{"tipo":"hackeo"}],"llm_1x2":{"l":50,"e":30,"v":20}}</datos_json>\n## Fuentes';
  const ex = D.extractContext(txt);
  ok(ex.parsed && ex.contexto.length === 3, 'se descartan los elementos mal formados'); ok(!/datos_json/.test(ex.cleanText) && /Fuentes/.test(ex.cleanText), 'el bloque se quita del texto');
  near(ex.llm1x2[0], 0.5, 1e-12, 'llm_1x2 en escala 0-100 se normaliza');
  const v = D.verifyContext(ex.contexto, ['https://futbolred.com/nota/1/', 'https://otra.com/']);
  ok(v[0].used === true, 'baja confirmada con fuente vista → se usa');
  ok(v[1].used === false && v[1].sourceSeen === false, 'baja con fuente que la búsqueda no devolvió → NO se usa');
  ok(v[2].used === false, 'rumor → no se usa');
  ok(D.extractContext('sin bloque').contexto.length === 0 && D.extractContext('<datos_json>{roto</datos_json>').parsed === false, 'bloque ausente o roto no rompe');
  ok(D.normUrl('javascript:alert(1)') !== D.normUrl('https://a.com/x') && D.normUrl('no es url') === null, 'normUrl');
}

section('Altitud');
ok(L.cityAltitude('Bogotá') === 2600 && L.cityAltitude('Medellin') === 1495 && L.cityAltitude('Ciudad Desconocida') === null, 'ciudades');
ok(L.clubBaseAltitude('Deportivo Cali') === 1000 && L.clubBaseAltitude('América de Cali') === 1000 && L.clubBaseAltitude('Independiente Medellín') === 1495 && L.clubBaseAltitude('Atlético Nacional') === 1495 && L.clubBaseAltitude('Internacional de Bogotá') === 2600 && L.clubBaseAltitude('Real Madrid') === null, 'clubes');
