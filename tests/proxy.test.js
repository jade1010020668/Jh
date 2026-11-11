// Respaldo de datos (netlify/functions/espn.mjs): solo deja pasar las consultas de fútbol que usa la app.
const { ok, section, wait } = require('./harness.js');
const D = require('../pronosticos/data.js');

wait(async () => {
  section('Respaldo de datos: lista de consultas permitidas');
  const { default: handler, config } = await import('../netlify/functions/espn.mjs');
  ok(config.path === '/api/espn', 'la función atiende en /api/espn (la ruta que usa la app)');
  const realFetch = global.fetch;
  const asked = [];
  global.fetch = async (url, init) => { asked.push({ url: String(url), init }); return new Response('{"ok":true}', { status: 200 }); };
  const call = (u, method) => handler(new Request('https://sitio.example/api/espn?u=' + encodeURIComponent(u), { method: method || 'GET' }));
  // Todas las direcciones que la app construye deben pasar
  const good = [D.urls.scoreboard('col.1', '20261114'), D.urls.standings('col.1'), D.urls.summary('col.1', '401878029'), D.urls.core('col.1', 2026, 5), D.urls.scoreboard('uefa.champions', '20261125'), D.urls.standings('eng.1'), D.urls.core('conmebol.libertadores', 2026, 1)];
  for (const u of good) { const r = await call(u); ok(r.status === 200 && (await r.json()).ok === true, 'permitida: ' + u.replace(/^https:\/\/[^/]+/, '').slice(0, 70)); }
  ok(asked.length === good.length && asked.every(a => good.includes(a.url)), 'se consulta exactamente la dirección pedida, sin modificarla');
  ok(asked.every(a => !a.init.headers.cookie && !a.init.headers.authorization), 'no se reenvían cookies ni credenciales');
  const before = asked.length;
  const bad = ['https://evil.example/x', 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261114', 'https://site.api.espn.com.evil.example/apis/v2/sports/soccer/col.1/standings', D.urls.standings('col.1') + '?x=1', D.urls.summary('col.1', '1') + '&u=https://evil.example', 'http://site.api.espn.com/apis/v2/sports/soccer/col.1/standings', 'https://site.api.espn.com/apis/v2/sports/soccer/../../x/standings', 'file:///etc/passwd', ''];
  for (const u of bad) { const r = await call(u); ok(r.status === 400, 'rechazada: ' + (u || '(vacía)').slice(0, 70)); }
  ok((await call(good[0], 'POST')).status === 405, 'solo acepta GET');
  ok(asked.length === before, 'una consulta rechazada no sale del servidor');
  global.fetch = async () => { throw new Error('sin red'); };
  ok((await call(good[0])).status === 502, 'si la fuente no responde: 502, sin inventar datos');
  global.fetch = realFetch;

  section('Respaldo de datos: la app solo lo usa si la consulta directa falla');
  {
    const calls = [];
    global.fetch = async (url) => { calls.push(String(url)); if (String(url).startsWith('https://')) throw new TypeError('Failed to fetch'); return { ok: true, status: 200, json: async () => ({ via: 'respaldo' }) }; };
    D.net.proxy = '/api/espn?u='; D.net.viaProxy = false;
    const j = await D.fetchJson(D.urls.standings('col.1'));
    ok(j.via === 'respaldo' && calls.length === 2 && calls[1] === '/api/espn?u=' + encodeURIComponent(D.urls.standings('col.1')), 'red que bloquea la fuente: se reintenta por el propio sitio');
    await D.fetchJson(D.urls.standings('eng.1'));
    ok(calls.length === 3 && calls[2].startsWith('/api/espn?u='), 'y el resto de la sesión va directo por el respaldo, sin esperar otro fallo');
    D.net.viaProxy = false;
    global.fetch = async (url) => { calls.push(String(url)); return { ok: false, status: 404, json: async () => ({}) }; };
    let err = null; try { await D.fetchJson(D.urls.core('col.1', 2026, 6)); } catch (e) { err = e; }
    ok(err && err.status === 404 && calls.length === 4, 'un 404 de la fuente es una respuesta, no un bloqueo: no se usa el respaldo');
    D.net.proxy = null; D.net.viaProxy = false; global.fetch = realFetch;
  }
});
