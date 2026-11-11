const fs = require('fs');
const path = require('path');
const { ok, near, section, wait } = require('./harness.js');
const { loadApp, fire, sseResponse, jsonResponse } = require('./helpers/load-app.js');
const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'espn', n), 'utf8'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Red falsa: ESPN desde respuestas reales guardadas; Anthropic con un stream SSE fabricado.
function fakeNet(extra) {
  return async (url, init) => {
    if (extra) { const r = await extra(url, init); if (r) return r; }
    if (url.includes('/scoreboard?dates=20261114')) return jsonResponse(fx('scoreboard-col1-20261114.json'));
    if (url.includes('/scoreboard?dates=')) return jsonResponse({ events: [] });
    if (url.includes('/apis/v2/sports/soccer/col.1/standings')) return jsonResponse(fx('standings-col1.json'));
    if (url.includes('/seasons/2026/types/5/')) return jsonResponse(fx('core-col1-2026-5.json'));
    if (url.includes('/seasons/2026/types/1/')) return jsonResponse(fx('core-col1-2026-1.json'));
    if (url.includes('/summary?event=401878029')) return jsonResponse(fx('summary-401878029.json'));
    return jsonResponse({}, 404);
  };
}
const aiText = `<datos_json>{"contexto":[{"equipo":"local","tipo":"rotacion","jugador":null,"rol":"otro","estado":"confirmada","fuente_url":"https://www.futbolred.com/nota/1","nota":"ya clasificado"},{"equipo":"visitante","tipo":"baja","jugador":"Inventado","rol":"goleador","estado":"confirmada","fuente_url":"https://sitio-que-no-aparecio.com/x"}],"llm_1x2":{"l":0.40,"e":0.30,"v":0.30}}</datos_json>

## Novedades del partido
Nacional rotará ([fuente](https://www.futbolred.com/nota/1)). <script>alert(1)</script> [malo](https://x.com/a" onmouseover="alert(1))

## Fuentes
- https://www.futbolred.com/nota/1`;
function anthropicStream(stop) {
  return sseResponse([
    { type: 'message_start', message: { usage: { input_tokens: 900 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"Nacional Once Caldas bajas"}' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://www.futbolred.com/nota/1', title: 'Nota' }] } },
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: aiText.slice(0, 200) } },
    { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: aiText.slice(200) } },
    { type: 'content_block_stop', index: 2 },
    { type: 'message_delta', delta: { stop_reason: stop || 'end_turn' }, usage: { output_tokens: 700, input_tokens: 20000, server_tool_use: { web_search_requests: 1 } } },
    { type: 'message_stop' }
  ]);
}

wait((async () => {
  section('La página y el código coinciden');
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'index.html'), 'utf8');
    const src = fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'app.js'), 'utf8');
    const ids = [...src.matchAll(/\$\('([^'`$]+)'\)/g)].map(m => m[1]);
    const missing = ids.filter(id => !html.includes(`id="${id}"`));
    ok(ids.length > 30 && missing.length === 0, 'todo id usado en app.js existe en index.html (faltan: ' + missing.join(', ') + ')');
    for (const h of ['h1', 'h2']) for (const k of ['home', 'draw', 'away', 'over', 'under']) ok(html.includes(`id="${h}-${k}"`), `existe el campo ${h}-${k}`);
    ok(/connect-src https:\/\/api\.anthropic\.com https:\/\/site\.api\.espn\.com https:\/\/sports\.core\.api\.espn\.com;/.test(html), 'la CSP permite conectar solo a Anthropic y ESPN');
    ok(/default-src 'none'; script-src 'self';/.test(html) && /frame-src https:\/\/app\.netlify\.com;/.test(html), 'scripts solo propios; el único marco permitido es la barra de vista previa de Netlify');
    ok(!/onclick=|onload=|<script>(?!<)/.test(html.replace(/<script src="[^"]+"><\/script>/g, '')), 'sin scripts ni manejadores en línea');
    ok(!/innerHTML\s*=(?!\s*renderMarkdown\()/.test(src), 'innerHTML solo recibe la salida del renderizador Markdown');
  }

  section('Arranque: calendario real');
  const app = loadApp({ fetch: fakeNet(), store: { football_predictor_config: JSON.stringify({ apiKey: 'sk-ant-prueba', model: 'claude-opus-5-5' }) } });
  await sleep(50);
  const st = () => app.get('state');
  ok(app.elements.league.value === 'col.1', 'liga por defecto: BetPlay');
  ok(st().fixtures.length === 7 && app.elements['fixtures-box'].children.length === 7, 'siete partidos en pantalla');
  ok(app.requests.every(r => /^https:\/\/(site\.api|sports\.core\.api)\.espn\.com\//.test(r.url)), 'al arrancar solo se consulta ESPN');
  ok(app.requests.every(r => !r.init || !r.init.headers), 'a ESPN no se le envía ninguna cabecera (ni la API key)');

  section('Elegir un partido: pronóstico sin IA');
  const chip = app.elements['fixtures-box'].children.find(c => c.textContent.includes('Atlético Nacional vs Once Caldas'));
  ok(!!chip, 'está el partido Nacional–Once Caldas');
  chip.click();
  await sleep(50);
  ok(st().fc && st().fc.final, 'hay pronóstico');
  ok(app.elements['quality-badge'].textContent.startsWith('Calidad de los datos:'), 'insignia de calidad');
  ok(app.elements['match-title'].textContent === 'Atlético Nacional vs Once Caldas', 'título');
  ok(app.elements['forecast-box'].textContent.includes('de cada 10') && app.elements['forecast-box'].textContent.includes('Marcador más probable'), 'probabilidades y marcador en pantalla');
  ok(app.elements['value-box'].textContent.includes('dos casas'), 'sin cuotas del usuario: se piden dos casas');
  ok(app.elements['data-box'].textContent.includes('ESPN') && app.elements['data-box'].textContent.includes('Atlético Nacional'), 'datos usados a la vista');
  ok(!app.requests.some(r => r.url.includes('anthropic')), 'el pronóstico no usó la IA');
  const track1 = JSON.parse(app.store.football_predictor_track_v3);
  ok(track1.length === 1 && track1[0].id === 'col.1:401878029' && track1[0].final.length === 3 && track1[0].market && track1[0].model, 'el pronóstico quedó guardado para el seguimiento');

  section('Escribir cuotas: evaluación inmediata y prudente');
  const set = (id, v) => { app.elements[id].value = String(v); fire(app.elements[id], 'input'); };
  set('h1-home', 2.40); set('h1-draw', 3.10); set('h1-away', 2.80);
  await sleep(260);
  ok(st().fc.market.nU1x2 === 1, 'una casa del usuario');
  ok(!st().bets.recommended && app.elements['value-box'].textContent.includes('No apostar'), 'con una casa: no apostar');
  set('h2-home', 2.45); set('h2-draw', 3.60); set('h2-away', 2.70);
  await sleep(260);
  ok(st().fc.market.nU1x2 === 2, 'dos casas del usuario');
  ok(st().bets.rows.length === 6, 'seis filas evaluadas (3 por casa)');
  // En este partido el modelo discrepa del mercado en ~20 puntos: aunque una cuota "pague más", no se recomienda
  ok(st().fc.D > 0.10 && !st().bets.recommended, 'modelo y mercado discrepan: ninguna recomendación');
  ok(JSON.parse(app.store.football_predictor_track_v3)[0].rec === null, 'sin recomendación en el registro');
  app.elements.bankroll.value = '500000'; fire(app.elements.bankroll, 'change');
  ok(JSON.parse(app.store.football_predictor_bank).bankroll === '500000', 'la banca se recuerda');

  section('IA opcional: fuentes comprobadas y texto saneado');
  const before = st().fc.model.lambda;
  app.ctx.fetch = async (url, init) => { app.requests.push({ url, init }); return url.includes('anthropic') ? anthropicStream() : fakeNet()(url, init); };
  await app.get('analyzeContext')();
  const aiReq = app.requests.find(r => r.url.includes('anthropic'));
  const body = JSON.parse(aiReq.init.body);
  ok(body.model === 'claude-opus-5-5' && body.stream === true && body.tools[0].type === 'web_search_20250305' && body.tools[0].user_location.country === 'CO', 'petición a la API bien formada');
  ok(body.messages[0].content.includes('Atlético Nacional') && body.messages[0].content.includes('en casa 9 PJ 19-7'), 'la IA recibe los datos ya conocidos');
  ok(aiReq.init.headers['x-api-key'] === 'sk-ant-prueba' && body.fallbacks === 'default', 'clave y respaldo');
  ok(st().context.length === 2 && st().context[0].used === true && st().context[1].used === false, 'solo se usa la novedad cuya fuente devolvió la búsqueda');
  ok(st().fc.model.lambda < before, 'la rotación confirmada baja los goles esperados del local');
  near(st().fc.model.lambda / before, 0.95, 1e-9, 'ajuste de 5% por rotación');
  const htmlOut = app.elements.result.innerHTML;
  ok(!/<script/i.test(htmlOut) && htmlOut.includes('&lt;script&gt;'), 'el HTML de la IA se muestra escapado, no se ejecuta');
  ok(!/<a [^>]*onmouseover/i.test(htmlOut), 'un enlace malicioso no inyecta atributos');
  ok(!htmlOut.includes('datos_json') && htmlOut.includes('Novedades del partido'), 'el bloque de datos no se muestra');
  ok(app.elements['context-box'].textContent.includes('usado en el cálculo') && app.elements['context-box'].textContent.includes('no aparece entre los resultados'), 'se explica qué se usó y qué no');
  ok(app.elements.usage.textContent.includes('20.000') && app.elements.usage.textContent.includes('US$'), 'costo estimado con los tokens reales de entrada');
  near(JSON.parse(app.store.football_predictor_track_v3)[0].llm[0], 0.4, 1e-9, 'la estimación de la IA solo se registra');

  section('IA: respuesta cortada no ajusta nada');
  app.ctx.fetch = async (url, init) => (url.includes('anthropic') ? anthropicStream('max_tokens') : fakeNet()(url, init));
  await app.get('analyzeContext')();
  ok(st().context.every(c => !c.used) && Math.abs(st().fc.model.lambda - before) < 1e-12, 'respuesta incompleta → sin ajuste');
  ok(app.elements.result.innerHTML.includes('Aviso'), 'se avisa que quedó incompleta');

  section('IA: errores claros');
  app.ctx.fetch = async (url, init) => (url.includes('anthropic') ? jsonResponse({ error: { message: 'x' } }, 401) : fakeNet()(url, init));
  await app.get('analyzeContext')();
  ok(app.elements.status.textContent.includes('API key inválida'), 'clave inválida → mensaje claro');
  ok(app.elements['btn-ai'].disabled === false, 'el botón vuelve a estar disponible');

  section('Seguimiento: resultado y métricas');
  app.get('renderTrack')();
  ok(app.elements['track-tiles'].children.length === 4 && app.elements['track-list'].children.length === 1, 'panel de seguimiento');
  ok(app.elements['track-verdict'].textContent.includes('Aún no hay partidos con resultado'), 'sin resultados todavía');
  // Tres días después: el partido ya se jugó y la fuente lo da por terminado 2-1
  const done = fx('summary-401878029.json');
  done.header.competitions[0].status = { type: { completed: true, name: 'STATUS_FULL_TIME', state: 'post' } };
  done.header.competitions[0].competitors.forEach(c => { c.score = c.homeAway === 'home' ? '2' : '1'; });
  const later = loadApp({ now: Date.parse('2026-11-15T12:00:00Z'), store: app.store, fetch: fakeNet(async (url) => (url.includes('/summary?event=401878029') ? jsonResponse(done) : null)) });
  await sleep(30);
  await later.get('refreshResults')();
  const rec = JSON.parse(later.store.football_predictor_track_v3)[0];
  ok(rec.result && rec.result.home === 2 && rec.result.away === 1, 'el marcador real se registra solo');
  ok(later.elements['track-verdict'].textContent.includes('todavía es ruido'), 'con 1 partido: "todavía es ruido"');
  ok(later.elements['track-list'].children[0].textContent.includes('2–1'), 'marcador en la lista');
  // El pronóstico guardado no se reescribe después del partido
  const frozen = JSON.stringify(rec.final);
  later.get('state').slug = 'col.1';
  ok(JSON.stringify(JSON.parse(later.store.football_predictor_track_v3)[0].final) === frozen, 'el pronóstico registrado no cambia tras el partido');

  section('Sin conexión a la fuente de datos');
  const off = loadApp({ fetch: async () => { throw new Error('sin red'); } });
  await sleep(30);
  ok(off.elements['fixtures-hint'].textContent.includes('No se pudo leer el calendario'), 'mensaje claro y botón de reintento');
  ok(off.get('state').fixtures.length === 0, 'sin partidos inventados');
})());
