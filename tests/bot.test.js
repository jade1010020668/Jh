const { ok, section, wait } = require('./harness.js');
const E = require('../pronosticos/engine.js');
const D = require('../pronosticos/data.js');
const L = require('../pronosticos/leagues.js');
const fx = (n) => require('./fixtures/espn/' + n);

wait((async () => {
  section('Bot: mensaje de WhatsApp con el mismo motor');
  const { formatMessage } = await import('../whatsapp-bot/src/predictor.js');
  const cfg = L.LEAGUES['col.1'];
  const event = D.parseScoreboard(fx('scoreboard-col1-20261114.json')).find(e => e.id === '401878029');
  const input = D.buildInput({ cfg, event, groups: D.parseStandings(fx('standings-col1.json')), core: D.parseCore(fx('core-col1-2026-5.json')), prevCore: D.parseCore(fx('core-col1-2026-1.json')), summary: D.parseSummary(fx('summary-401878029.json')) });
  const fc = E.forecast(input);
  const msg = formatMessage({ cfg, event, fc, context: [{ team: 'home', type: 'rotacion', used: true }, { team: 'away', type: 'baja', player: 'X', used: false }], notes: [] });
  ok(msg.startsWith('⚽ *Atlético Nacional vs Once Caldas*'), 'encabezado');
  ok(/📊 Atlético Nacional \d+% · Empate \d+% · Once Caldas \d+%/.test(msg), 'probabilidades');
  ok(msg.includes('Calidad de los datos: ' + fc.quality.level), 'calidad de los datos');
  ok(msg.includes('rotación de titulares') && !msg.includes('baja de X'), 'solo las novedades usadas');
  ok(!/usted/i.test(msg.split('⚠️')[0]), 'sin frases dirigidas a las cuotas del usuario');
  ok(msg.includes('no una garantía') && msg.length < 1500, 'aviso y tamaño razonable');
  const none = formatMessage({ cfg, event, fc: E.forecast({ group: 'betplay', phase: 'regular', model: null, houses: [] }), context: [], notes: [] });
  ok(none.includes('No hay datos suficientes'), 'sin datos: lo dice');
})());
