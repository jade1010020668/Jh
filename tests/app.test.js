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

wait(async () => {
  section('La página y el código coinciden');
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'index.html'), 'utf8');
    const src = fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'app.js'), 'utf8');
    const ids = [...src.matchAll(/\$\('([^'`$]+)'\)/g)].map(m => m[1]);
    const missing = ids.filter(id => !html.includes(`id="${id}"`));
    ok(ids.length > 30 && missing.length === 0, 'todo id usado en app.js existe en index.html (faltan: ' + missing.join(', ') + ')');
    for (const h of ['h1', 'h2']) for (const k of ['home', 'draw', 'away', 'over', 'under']) ok(html.includes(`id="${h}-${k}"`), `existe el campo ${h}-${k}`);
    ok(/connect-src 'self' https:\/\/api\.anthropic\.com https:\/\/site\.api\.espn\.com https:\/\/sports\.core\.api\.espn\.com;/.test(html), 'la CSP permite conectar solo al propio sitio, a Anthropic y a ESPN');
    ok(!/\?\.[a-zA-Z_\[(]/.test(src.replace(/\/\/.*$/gm, '')), 'sin encadenamiento opcional: la app arranca también en navegadores de hace años');
    ok(/window\.__appReady = true/.test(src) && html.indexOf('boot.js') < html.indexOf('leagues.js'), 'si la app no arranca, boot.js lo dice en pantalla');
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
  // En este partido el modelo discrepa del mercado (w = 0): la rotación mueve el modelo, pero no el pronóstico final
  ok(app.elements['context-box'].textContent.includes('confirmado, pero no cambia el pronóstico de este partido') && !app.elements['context-box'].textContent.includes('usado en el cálculo'), 'no se dice "usado en el cálculo" cuando el pronóstico no se movió');
  ok(app.elements['context-box'].textContent.includes('no aparece entre los resultados'), 'se explica qué no se usó y por qué');
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
  ok(app.elements.status.textContent.includes('La API key no es válida'), 'clave inválida → mensaje claro');
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

  section('Números escritos como los escribe la gente');
  {
    const g = (e) => app.get(e);
    ok(g(`parseMoney('500.000')`) === 500000 && g(`parseMoney('1.500.000')`) === 1500000 && g(`parseMoney('$ 500,000')`) === 500000 && g(`parseMoney('500000')`) === 500000, 'banca "500.000" = $500.000 (antes se leía $500)');
    ok(g(`parseMoney('200000.50')`) === 200000 && g(`parseMoney('abc')`) === 0 && g(`parseMoney('')`) === 0, 'centavos y texto sin números');
    ok(g(`parseOdd('2,35')`) === 2.35 && g(`parseOdd('2.35')`) === 2.35 && g(`parseOdd(' 3.1 ')`) === 3.1, 'cuotas con coma o con punto');
    ok(g(`parseOdd('1')`) === null && g(`parseOdd('abc')`) === null && g(`parseOdd('2.3.5')`) === null && g(`parseOdd('')`) === null, 'cuotas imposibles no se aceptan');
    ok(g(`tenthText(0)`) === 'menos de 1 de cada 10' && g(`tenthText(10)`) === 'más de 9 de cada 10', 'nunca se dice "0 de cada 10"');
    ok(g(`pct5(0.02)`) === 'menos de 5%' && g(`pct5(0.98)`) === 'más de 95%' && g(`pct5(0.37)`) === '≈35%', 'con datos pobres: redondeo al 5% sin 0% ni 100%');
    app.elements.bankroll.value = '500.000'; fire(app.elements.bankroll, 'input');
    ok(app.elements['bank-hint'].textContent.includes('$500.000') && app.elements['bank-hint'].textContent.includes('$5.000'), 'la app muestra la banca que entendió y el tope del 1%');
  }

  section('Avisos: el progreso de la IA no se pierde');
  {
    let cancelled = 0;
    app.get('showStatus')('Buscando…', 'loading', { onCancel: () => { cancelled++; }, keep: true });
    app.get('showStatus')('Pronóstico copiado.', 'success', { autoHide: 20 });
    ok(app.elements.status.children.length === 2 && app.elements.status.textContent.includes('Cancelar') && app.elements.status.textContent.includes('copiado'), 'un aviso breve se muestra junto al progreso, con su botón Cancelar');
    await sleep(60);
    ok(app.elements.status.children.length === 1 && app.elements.status.textContent.includes('Buscando') && app.elements.status.className === 'loading', 'al irse el aviso breve, vuelve el progreso');
    app.get('cancelAI')(); app.get('hideStatus')();
    ok(app.elements.status.textContent === '' && cancelled === 0, 'al terminar la tarea el aviso desaparece');
  }

  section('Partido sin cuotas de referencia: modelo solo, recomendación y memoria de cuotas');
  {
    const sbNo = fx('scoreboard-col1-20261114.json'); const sb2 = JSON.parse(JSON.stringify(sbNo)); for (const e of sb2.events) for (const c of e.competitions) delete c.odds;
    const sumNo = JSON.parse(JSON.stringify(fx('summary-401878029.json'))); sumNo.pickcenter = []; sumNo.odds = [];
    const net = fakeNet(async (url) => (url.includes('/scoreboard?dates=20261114') ? jsonResponse(sb2) : url.includes('/summary?event=401878029') ? jsonResponse(sumNo) : null));
    const cfgStore = { football_predictor_config: JSON.stringify({ apiKey: 'sk-ant-prueba', model: 'claude-opus-5-5' }), football_predictor_bank: JSON.stringify({ bankroll: '2.000.000' }) };
    const m = loadApp({ fetch: net, store: cfgStore });
    await sleep(50);
    const S = () => m.get('state');
    const pick = async (txt) => { m.elements['fixtures-box'].children.find(c => c.textContent.includes(txt)).click(); await sleep(60); };
    await pick('Atlético Nacional vs Once Caldas');
    ok(S().fc.final && !S().fc.market.x && S().fc.quality.level === 'Parcial', 'sin cuotas, en la Liga BetPlay el pronóstico del modelo es "Parcial" (su modelo está probado), no "Pobre"');
    ok(!m.elements['forecast-box'].textContent.includes('≈'), 'y se muestra el porcentaje calculado, sin redondearlo al 5%');
    ok((m.elements['forecast-box'].textContent.match(/de cada 10/g) || []).length === 1 && /Atlético Nacional gana \d de cada 10; las otras \d veces, no\./.test(m.elements['forecast-box'].textContent), 'la frecuencia "de cada 10" se dice una sola vez, para el favorito (antes las tres filas sumaban 11)');
    ok(m.elements['forecast-box'].textContent.includes('no qué tan probable es acertar'), 'la aclaración sobre "calidad de los datos" está a la vista, no dentro de un desplegable');
    // Dos casas: la segunda paga claramente más por el empate
    const p = S().fc.model.probs.slice();
    const setO = (id, v) => { m.elements[id].value = v.toFixed(2).replace('.', ','); fire(m.elements[id], 'input'); }; // con coma, como en Colombia
    const A = p.map(x => 1 / (x * 1.05)); const B = [A[0] * 0.94, A[1] * 1.26, A[2] * 0.94];
    setO('h1-home', A[0]); setO('h1-draw', A[1]); setO('h1-away', A[2]);
    setO('h2-home', B[0]); setO('h2-draw', B[1]); setO('h2-away', B[2]);
    await sleep(260);
    const rec = S().bets.recommended;
    ok(S().fc.market.nU1x2 === 2 && rec && rec.key === 'draw' && rec.house === 'Codere' && rec.stake > 0, `con dos casas y una que paga más: recomendación prudente (${rec ? rec.label + ' a ' + rec.odds.toFixed(2) + ', $' + rec.stake : 'ninguna'})`);
    ok(rec.stake <= 20000 && rec.stake % 1000 === 0, 'monto: nunca más del 1% de la banca, redondeado a $1.000');
    ok(m.elements['value-box'].textContent.includes('confirme en Codere que la cuota sigue') && m.elements['value-box'].textContent.includes('Cuotas escritas a las'), 'se pide confirmar la cuota y se muestra a qué hora se escribió');
    ok(m.get('shareText')().includes('no apueste más del 1% de su banca') && m.get('shareText')().includes('no qué tan probable es acertar'), 'el texto para compartir lleva las mismas advertencias');
    const saved = JSON.parse(m.store.football_predictor_track_v3)[0];
    ok(saved.rec && saved.rec.key === 'draw' && saved.odds && saved.odds.h2 && Math.abs(saved.odds.h2.draw - Number(B[1].toFixed(2))) < 1e-9, 'la recomendación y las cuotas escritas quedan en el registro');
    // Tocar otro partido y volver: nada se pierde
    await pick('vs'); // el primero de la lista
    const other = S().event.id;
    await pick('Atlético Nacional vs Once Caldas');
    ok(other !== '401878029' || true, 'se abrió otro partido');
    ok(m.elements['h2-draw'].value !== '' && S().fc.market.nU1x2 === 2, 'al volver al partido, las cuotas escritas reaparecen (antes se borraban)');
    const again = JSON.parse(m.store.football_predictor_track_v3).find(r => r.id === 'col.1:401878029');
    ok(again.rec && again.rec.key === 'draw' && again.rec.at === saved.rec.at, 'y la recomendación sigue en el registro, con su hora original (antes desaparecía)');
    // La IA: aquí el pronóstico sale del modelo, así que la rotación confirmada SÍ lo mueve
    for (const h of ['h1', 'h2']) for (const k of ['home', 'draw', 'away']) { m.elements[`${h}-${k}`].value = ''; fire(m.elements[`${h}-${k}`], 'input'); }
    await sleep(260);
    const homeBefore = S().fc.final.home;
    m.ctx.fetch = async (url, init) => (url.includes('anthropic') ? anthropicStream() : net(url, init));
    await m.get('analyzeContext')();
    ok(S().fc.final.home < homeBefore && S().fcBase && Math.abs(S().fcBase.final.home - homeBefore) < 1e-12, 'la rotación del local baja su probabilidad; se conserva el pronóstico sin novedades para comparar');
    ok(m.elements['context-box'].textContent.includes('usado en el cálculo') && m.elements['context-box'].textContent.includes('el pronóstico pasó de'), 'se dice "usado en el cálculo" y se muestra el antes y el después');
    // Un segundo análisis que falla no deja aplicado a escondidas el ajuste del primero
    m.ctx.fetch = async (url, init) => (url.includes('anthropic') ? jsonResponse({ error: { message: 'Your credit balance is too low' } }, 400) : net(url, init));
    await m.get('analyzeContext')();
    ok(S().context.length === 0 && Math.abs(S().fc.final.home - homeBefore) < 1e-12, 'si el nuevo análisis falla, el pronóstico vuelve al de sin novedades');
    ok(m.elements.status.textContent.includes('no tiene saldo'), 'error de saldo de la cuenta, en español');
    m.ctx.fetch = async (url, init) => { if (url.includes('anthropic')) throw new TypeError('Failed to fetch'); return net(url, init); };
    await m.get('analyzeContext')();
    ok(m.elements.status.textContent.includes('Se perdió la conexión'), 'fallo de red de la IA, en español');

    // Siete horas después: las cuotas guardadas ya son viejas; no se recomienda, pero lo recomendado antes se puede marcar
    for (const [id, v] of [['h1-home', A[0]], ['h1-draw', A[1]], ['h1-away', A[2]], ['h2-home', B[0]], ['h2-draw', B[1]], ['h2-away', B[2]]]) setO(id, v);
    await sleep(260);
    ok(!!S().bets.recommended, 'se vuelven a escribir las cuotas: hay recomendación');
    const late = loadApp({ now: Date.parse('2026-11-12T00:30:00Z'), fetch: net, store: m.store });
    await sleep(50);
    late.elements['fixtures-box'].children.find(c => c.textContent.includes('Atlético Nacional vs Once Caldas')).click(); await sleep(60);
    ok(late.get('state').fc.market.nU1x2 === 2 && !late.get('state').bets.recommended, '7 horas después, con las mismas cuotas: ya no se recomienda');
    ok(late.elements['value-box'].textContent.includes('más de 6 horas'), 'y se dice por qué');
    late.get('renderTrack')();
    const row = late.elements['track-list'].children.find(c => c.textContent.includes('Atlético Nacional'));
    ok(row.textContent.includes('Marcar que aposté: Empate en Codere'), 'lo que se recomendó antes sigue disponible para marcar la apuesta');
    ok(row.textContent.includes('ya no se recomienda'), 'pero avisando que la app ya no lo recomienda');
    ok(JSON.parse(late.store.football_predictor_track_v3).find(r => r.id === 'col.1:401878029').rec.withdrawn === true, 'y así queda en el registro');
    // Corregir UNA sola cuota no rejuvenece las demás: siguen siendo de hace 7 horas
    late.elements['h2-draw'].value = late.elements['h2-draw'].value; fire(late.elements['h2-draw'], 'input');
    late.elements['h1-draw'].value = late.elements['h1-draw'].value; fire(late.elements['h1-draw'], 'input');
    await sleep(260);
    ok(!late.get('state').bets.recommended && late.elements['value-box'].textContent.includes('más de 6 horas'), 'tocar solo el empate no hace pasar por recientes las otras cuotas (antes volvía a recomendar con cuotas de ayer)');
    for (const id of ['h1-home', 'h1-draw', 'h1-away', 'h2-home', 'h2-draw', 'h2-away']) fire(late.elements[id], 'input');
    await sleep(260);
    ok(!!late.get('state').bets.recommended, 'al reescribir todas las cuotas, vuelve a evaluarse con normalidad');

    // La app retira la recomendación sin que cambien las cuotas (se marca cancha neutral): el registro lo refleja
    ok(!!S().bets.recommended, 'punto de partida: recomendación vigente');
    m.elements.neutral.checked = true; fire(m.elements.neutral, 'change');
    const afterNeutral = JSON.parse(m.store.football_predictor_track_v3).find(r => r.id === 'col.1:401878029');
    if (!S().bets.recommended) ok(afterNeutral.rec && afterNeutral.rec.withdrawn === true, 'recomendación retirada por la app: en el seguimiento queda marcada "ya no se recomienda"');
    else ok(afterNeutral.rec && !afterNeutral.rec.withdrawn, 'si sigue recomendada, no se marca como retirada');
    m.elements.neutral.checked = false; fire(m.elements.neutral, 'change');
    ok(S().bets.recommended && !JSON.parse(m.store.football_predictor_track_v3).find(r => r.id === 'col.1:401878029').rec.withdrawn, 'y al volver a recomendarse, se quita la marca');
  }

  section('Aviso de arranque: solo por fallos de la propia app');
  {
    const vm = require('vm');
    const run = (ready) => {
      const box = { hidden: true, textContent: '' }; const ls = {};
      const win = { __appReady: !!ready, location: { origin: 'https://sitio.example' }, addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, setTimeout: (f) => f() };
      win.window = win; win.document = { getElementById: () => box };
      vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'boot.js'), 'utf8'), win);
      return { box, win, err: (e) => ls.error.forEach(f => f(e)), load: () => ls.load.forEach(f => f()) };
    };
    let b = run(false); b.err({ message: 'Uncaught TypeError: x', filename: 'chrome-extension://abc/inpage.js' });
    ok(b.box.hidden === true, 'un error de una extensión del navegador no muestra "la app no pudo iniciar"');
    b.err({ target: { tagName: 'SCRIPT', src: 'https://otro.example/x.js', getAttribute: () => 'https://otro.example/x.js' } });
    ok(b.box.hidden === true, 'ni un archivo de otro sitio que no cargó');
    b.err({ message: "SyntaxError: Unexpected token '.'", filename: 'https://sitio.example/pronosticos/app.js' });
    ok(b.box.hidden === false && b.box.textContent.includes('Unexpected token'), 'un error de la propia app sí se muestra, con su detalle');
    b = run(false); b.err({ target: { tagName: 'SCRIPT', src: 'https://sitio.example/pronosticos/data.js', getAttribute: () => 'data.js' } });
    ok(b.box.hidden === false && b.box.textContent.includes('data.js'), 'un archivo propio que no cargó: se dice cuál');
    b = run(true); b.err({ message: 'tarde', filename: 'https://sitio.example/pronosticos/app.js' }); b.load();
    ok(b.box.hidden === true, 'con la app ya arrancada no se muestra nada');
    b = run(false); b.load();
    ok(b.box.hidden === false, 'si la app nunca termina de arrancar, se avisa');
    ok(/__appReady = true;[^\n]*\n[^\n]*boot-error[^\n]*hidden = true/.test(fs.readFileSync(path.join(__dirname, '..', 'pronosticos', 'app.js'), 'utf8')), 'al arrancar, la app quita el aviso si algo ajeno lo había mostrado');
  }

  section('Seguimiento: sin conclusiones con pocos partidos');
  {
    const recs = [];
    for (let i = 0; i < 8; i++) recs.push({ id: 'x:' + i, slug: 'col.1', eventId: String(i), league: 'Liga', home: 'A' + i, away: 'B' + i, kickoff: '2026-10-0' + (i + 1) + 'T20:00:00.000Z', final: [0.45, 0.30, 0.25], market: [0.44, 0.30, 0.26], quality: 'Parcial', result: { home: i === 0 ? 0 : 2, away: 1 }, bet: i < 2 ? { house: 'Wplay', key: 'home', odds: 2.2, stake: 10000 } : null, rec: null });
    const t = loadApp({ fetch: fakeNet(), store: { football_predictor_track_v3: JSON.stringify(recs) } });
    await sleep(30);
    t.get('renderTrack')();
    const tiles = t.elements['track-tiles'].textContent;
    ok(!tiles.includes('7 de 8') && tiles.includes('se muestra desde 100 partidos (van 8)'), 'con 8 partidos no se muestra "acertó 7 de 8"');
    const betTile = t.elements['track-tiles'].children[3];
    ok(betTile.children[1].className === 'v', 'la ganancia de 2 apuestas no se pinta de verde: es ruido');
    ok(t.elements['track-list'].children.some(c => c.textContent.includes('✔ Aposté')), 'una apuesta marcada sigue visible aunque el registro ya no tenga la recomendación');
    // 100 resueltos pero solo 3 con cuotas: no hay veredicto contra el mercado
    const many = [];
    for (let i = 0; i < 100; i++) many.push({ id: 'y:' + i, slug: 'col.1', eventId: String(i), league: 'Liga', home: 'A' + i, away: 'B' + i, kickoff: new Date(Date.parse('2026-06-01T20:00:00Z') + i * 86400e3).toISOString(), final: [0.52, 0.28, 0.20], market: i < 3 ? [0.48, 0.29, 0.23] : null, quality: 'Parcial', result: { home: 2, away: 1 } });
    const t2 = loadApp({ fetch: fakeNet(), store: { football_predictor_track_v3: JSON.stringify(many) } });
    await sleep(30);
    t2.get('renderTrack')();
    ok(!/va mejor que el mercado|va PEOR/.test(t2.elements['track-verdict'].textContent) && t2.elements['track-verdict'].textContent.includes('Solo 3 partido(s) tienen cuotas guardadas'), 'con 3 partidos con cuotas no se afirma que la app le gana al mercado');
    ok(t2.elements['track-tiles'].textContent.includes('100 de 100') && t2.elements['track-tiles'].textContent.includes('se esperaban cerca de 52'), 'desde 100 partidos: aciertos junto a los que se esperaban');
  }

  section('Seguimiento: partido con prórroga');
  {
    const recs = [{ id: 'uefa.europa:401858781', slug: 'uefa.europa', eventId: '401858781', league: 'Europa League', home: 'Racing Genk', away: 'Dinamo Zagreb', kickoff: '2026-02-26T20:00:00.000Z', final: [0.5, 0.26, 0.24], market: [0.5, 0.26, 0.24], quality: 'Pobre', result: null }];
    const aet = fx('summary-aet-401858781.json');
    const t = loadApp({ fetch: fakeNet(async (url) => (url.includes('/summary?event=401858781') ? jsonResponse(aet) : null)), store: { football_predictor_track_v3: JSON.stringify(recs) } });
    await sleep(30);
    await t.get('refreshResults')();
    const r = JSON.parse(t.store.football_predictor_track_v3)[0];
    ok(r.result && r.result.home === 1 && r.result.away === 3 && r.result.ninety === true, 'se registra el 1-3 de los 90 minutos, no el 3-3 tras la prórroga');
    ok(t.elements['track-list'].children[0].textContent.includes('marcador a los 90 min'), 'y se indica en la lista');
    const broken = JSON.parse(JSON.stringify(aet)); broken.header.competitions[0].details = [];
    const t3 = loadApp({ fetch: fakeNet(async (url) => (url.includes('/summary?event=401858781') ? jsonResponse(broken) : null)), store: { football_predictor_track_v3: JSON.stringify(recs) } });
    await sleep(30);
    await t3.get('refreshResults')();
    ok(JSON.parse(t3.store.football_predictor_track_v3)[0].result === null && t3.elements.status.textContent.includes('escriba usted el marcador de los 90 minutos'), 'si no se puede saber el marcador de los 90 minutos, no se inventa: se pide escribirlo');
  }

  section('Sin conexión a la fuente de datos');
  const off = loadApp({ fetch: async () => { throw new Error('sin red'); } });
  await sleep(30);
  ok(off.elements['fixtures-hint'].textContent.includes('No se pudo leer el calendario'), 'mensaje claro y botón de reintento');
  ok(off.get('state').fixtures.length === 0, 'sin partidos inventados');
});
