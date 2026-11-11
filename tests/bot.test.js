const { ok, section, wait } = require('./harness.js');
const E = require('../pronosticos/engine.js');
const D = require('../pronosticos/data.js');
const L = require('../pronosticos/leagues.js');
const fx = (n) => require('./fixtures/espn/' + n);

wait(async () => {
  section('Bot: mensaje de WhatsApp con el mismo motor');
  const { formatMessage } = await import('../whatsapp-bot/src/predictor.js');
  const cfg = L.LEAGUES['col.1'];
  const event = D.parseScoreboard(fx('scoreboard-col1-20261114.json')).find(e => e.id === '401878029');
  const input = D.buildInput({ cfg, event, groups: D.parseStandings(fx('standings-col1.json')), core: D.parseCore(fx('core-col1-2026-5.json')), prevCore: D.parseCore(fx('core-col1-2026-1.json')), summary: D.parseSummary(fx('summary-401878029.json')) });
  const fc = E.forecast(input);
  const msg = formatMessage({ cfg, event, fc, context: [{ team: 'home', type: 'rotacion', used: true }, { team: 'away', type: 'baja', player: 'X', used: false }], notes: [] });
  ok(msg.startsWith('⚽ *Atlético Nacional vs Once Caldas*'), 'encabezado');
  ok(/📊 Atlético Nacional ≈?\d+% · Empate ≈?\d+% · Once Caldas ≈?\d+%/.test(msg), 'probabilidades');
  ok(msg.includes('Calidad de los datos: ' + fc.quality.level), 'calidad de los datos');
  ok(msg.includes('rotación de titulares') && !msg.includes('baja de X'), 'solo las novedades usadas');
  ok(!/usted/i.test(msg.split('⚠️')[0]), 'sin frases dirigidas a las cuotas del usuario');
  ok(msg.includes('no una garantía') && msg.length < 1500, 'aviso y tamaño razonable');
  ok(msg.includes('no qué tan probable es acertar'), 'se aclara qué significa la calidad de los datos');
  if (fc.quality.level === 'Pobre') ok(/📊 Atlético Nacional (≈\d+|menos de 5|más de 95)%/.test(msg), 'con datos pobres el bot redondea al 5%, igual que la app');

  section('Bot: buscar el partido de un equipo');
  const { findFixture, buildForecast } = await import('../whatsapp-bot/src/predictor.js');
  const fxs = [{ home: { name: 'Internacional de Bogotá' }, away: { name: 'Fortaleza CEIF' } }, { home: { name: 'Atlético Nacional' }, away: { name: 'Once Caldas' } }, { home: { name: 'Independiente Medellín' }, away: { name: 'América de Cali' } }];
  ok(findFixture(fxs, 'nacional') === fxs[1], '"nacional" encuentra a Atlético Nacional, no a Internacional de Bogotá');
  ok(findFixture(fxs, 'medellin') === fxs[2] && findFixture(fxs, 'AMERICA') === fxs[2], 'sin tildes ni mayúsculas');
  ok(findFixture(fxs, 'inter') === fxs[0] && findFixture(fxs, '') === fxs[0] && findFixture(fxs, 'zzz') === null, 'parte del nombre, sin filtro y sin coincidencias');

  section('Bot: un fallo pasajero de la fuente no produce un mensaje a medias');
  {
    const realFetch = global.fetch;
    const reply = (j) => ({ ok: !!j, status: j ? 200 : 503, json: async () => j });
    // La tabla y el resumen fallan (503): antes el bot enviaba "No hay datos suficientes" y daba el partido por enviado
    global.fetch = async () => reply(null);
    let threw = null;
    try { await buildForecast('col.1', event, null, { strict: true }); } catch (e) { threw = e; }
    ok(threw && /se reintenta/.test(threw.message), 'con la fuente caída y en modo estricto: no hay pronóstico, se reintenta');
    const loose = await buildForecast('col.1', event, null, { strict: false });
    ok(loose.incomplete === true, 'en el último cuarto de hora se envía lo que haya, marcado como incompleto');
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/standings')) return reply(fx('standings-col1.json'));
      if (u.includes('/types/5/')) return reply(fx('core-col1-2026-5.json'));
      if (u.includes('/types/1/')) return reply(fx('core-col1-2026-1.json'));
      if (u.includes('/summary')) return reply(fx('summary-401878029.json'));
      return reply(null);
    };
    const good = await buildForecast('col.1', event, null, { strict: true });
    ok(good.incomplete === false && good.fc.final && good.fc.model.ok, 'con la fuente respondiendo: pronóstico completo');
    global.fetch = realFetch;
  }

  const none = formatMessage({ cfg, event, fc: E.forecast({ group: 'betplay', phase: 'regular', model: null, houses: [] }), context: [], notes: [] });
  ok(none.includes('No hay datos suficientes'), 'sin datos: lo dice');
});
