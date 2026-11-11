// Interfaz. El cálculo vive en engine.js y los datos en data.js; aquí solo se orquesta y se pinta.
// Todo lo que viene de fuera (ESPN, IA) se inserta con textContent, salvo el análisis de la IA,
// que pasa por un renderizador Markdown propio que escapa el HTML y valida las URL.
const $ = (id) => document.getElementById(id);
const els = {
  league: $('league'), fixturesHint: $('fixtures-hint'), fixturesBox: $('fixtures-box'),
  status: $('status'),
  matchCard: $('match-card'), matchTitle: $('match-title'), matchSub: $('match-sub'), qualityBadge: $('quality-badge'),
  forecastBox: $('forecast-box'), shareBar: $('share-bar'), btnCopy: $('btn-copy'), btnShare: $('btn-share'),
  h1Name: $('h1-name'), h2Name: $('h2-name'), bankroll: $('bankroll'), neutral: $('neutral'),
  valueBox: $('value-box'), dataBox: $('data-box'),
  btnAi: $('btn-ai'), contextBox: $('context-box'), result: $('result'), usage: $('usage'),
  btnTrack: $('btn-track'), trackCard: $('track-card'), trackTiles: $('track-tiles'), trackVerdict: $('track-verdict'), trackList: $('track-list'),
  btnRefreshResults: $('btn-refresh-results'), btnExport: $('btn-export'), btnClearTrack: $('btn-clear-track'),
  btnConfig: $('btn-config'), modal: $('modal'), configForm: $('config-form'), apiKey: $('api-key'), model: $('model'),
  btnCancel: $('btn-cancel'), btnDeleteKey: $('btn-delete-key'), configError: $('config-error')
};
const ODD_KEYS = ['home', 'draw', 'away', 'over', 'under'];
const oddInput = (h, k) => $(`${h}-${k}`);

const CONFIG_KEY = 'football_predictor_config';
const BANK_KEY = 'football_predictor_bank';
const TRACK_KEY = 'football_predictor_track_v3';
const HOUSES = ['Wplay', 'BetPlay', 'Rushbet', 'Codere', 'Betsson', 'Stake', 'Bwin', 'Luckia', 'Rivalo', 'Sportium', 'Yajuego', 'Zamba'];
const OTHER_A = 'Otra casa (A)', OTHER_B = 'Otra casa (B)';
const FIXTURE_DAYS = 14;
const AI_TIMEOUT_MS = 300000;
const FREEZE_BEFORE_MS = 5 * 60e3;   // el pronóstico que cuenta es el último guardado 5 min antes del inicio
const RESULT_AFTER_MS = 110 * 60e3;  // se busca el marcador desde 110 min después del inicio

const state = {
  slug: '', fixtures: [], event: null, parts: null, input: null, fc: null, bets: null,
  context: [], llm1x2: null, aiMarkdown: '',
  oddsAt: { h1: null, h2: null },
  loadToken: 0, aiController: null, aiToken: 0
};

// ===== Utilidades =====
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const pct = (x) => Math.round(x * 100) + '%';
const pct5 = (x) => (Math.round(x * 20) * 5) + '%';
const signed = (x) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1).replace('.', ',') + '%';
const cop = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CO');
const TZ = 'America/Bogota';
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtHour = (iso) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const oneIn = (p) => Math.max(2, Math.round(1 / p));
const dec = (x, n) => x.toFixed(n).replace('.', ','); // números con coma decimal; las cuotas se dejan con punto, como en las casas

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

// ===== Mensajes de estado =====
let statusTimer = null;
function showStatus(msg, type = 'loading', { autoHide, onCancel } = {}) {
  clearTimeout(statusTimer);
  els.status.className = type;
  els.status.textContent = '';
  els.status.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  const row = el('div', 'status-row');
  const left = el('span');
  if (type === 'loading') { const sp = el('span', 'spinner'); sp.setAttribute('aria-hidden', 'true'); left.appendChild(sp); }
  left.appendChild(document.createTextNode(msg));
  row.appendChild(left);
  if (onCancel) { const b = el('button', 'status-cancel', 'Cancelar'); b.addEventListener('click', onCancel); row.appendChild(b); }
  els.status.appendChild(row);
  if (autoHide) statusTimer = setTimeout(hideStatus, autoHide);
}
function hideStatus() { clearTimeout(statusTimer); els.status.className = ''; els.status.textContent = ''; }

// ===== Configuración de la IA (opcional) =====
const DEFAULT_MODEL = 'claude-opus-5-5';
// USD por millón de tokens (tarifas de lista a noviembre de 2026; solo para estimar el costo).
const PRICES = { 'claude-opus-5-5': { in: 4, out: 20 }, 'claude-sonnet-5-5': { in: 2, out: 10 }, 'claude-haiku-5-5': { in: 0.1, out: 0.5 } };
const WEB_SEARCH_USD = 0.01, USD_TO_COP = 4000;
const loadConfig = () => load(CONFIG_KEY, {});
function currentModel() { const m = loadConfig().model; return PRICES[m] ? m : DEFAULT_MODEL; }

function openModal() {
  els.configError.hidden = true;
  els.apiKey.value = loadConfig().apiKey || '';
  els.model.value = currentModel();
  if (typeof els.modal.showModal === 'function') els.modal.showModal(); else els.modal.setAttribute('open', '');
  els.apiKey.focus();
}
function closeModal() { if (typeof els.modal.close === 'function') els.modal.close(); else els.modal.removeAttribute('open'); }
els.btnConfig.addEventListener('click', openModal);
els.btnCancel.addEventListener('click', closeModal);
els.configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  els.configError.hidden = true;
  const apiKey = els.apiKey.value.trim();
  if (!apiKey.startsWith('sk-ant-')) { els.configError.textContent = 'La API key debe empezar con "sk-ant-".'; els.configError.hidden = false; return; }
  const ok = save(CONFIG_KEY, { apiKey, model: els.model.value });
  closeModal();
  showStatus(ok ? 'Configuración guardada.' : 'No se pudo guardar en este navegador.', ok ? 'success' : 'error', { autoHide: 2500 });
});
els.btnDeleteKey.addEventListener('click', () => {
  try { localStorage.removeItem(CONFIG_KEY); } catch {}
  els.apiKey.value = '';
  closeModal();
  showStatus('API key borrada de este navegador.', 'success', { autoHide: 2500 });
});

// ===== Ligas y calendario =====
function populateSelectors() {
  for (const [slug, cfg] of Object.entries(LEAGUES)) { const o = el('option', null, cfg.name); o.value = slug; els.league.appendChild(o); }
  for (const [sel, extra] of [[els.h1Name, OTHER_A], [els.h2Name, OTHER_B]]) {
    for (const h of HOUSES.concat([extra])) { const o = el('option', null, h); o.value = h; sel.appendChild(o); }
  }
  const bank = load(BANK_KEY, {});
  els.h1Name.value = (HOUSES.includes(bank.h1) || bank.h1 === OTHER_A) ? bank.h1 : 'Wplay';
  els.h2Name.value = (HOUSES.includes(bank.h2) || bank.h2 === OTHER_B) ? bank.h2 : 'Codere';
  if (bank.bankroll) els.bankroll.value = bank.bankroll;
  els.league.value = LEAGUES[bank.slug] ? bank.slug : 'col.1';
}
function saveBank() { save(BANK_KEY, { h1: els.h1Name.value, h2: els.h2Name.value, bankroll: els.bankroll.value, slug: els.league.value }); }

async function loadFixturesUI() {
  const slug = els.league.value;
  state.slug = slug;
  const token = ++state.loadToken;
  cancelAI();
  state.fixtures = []; state.event = null;
  els.fixturesBox.textContent = '';
  els.matchCard.hidden = true;
  els.fixturesHint.textContent = 'Buscando los próximos partidos…';
  saveBank();
  try {
    const list = await Data.loadFixtures(slug, FIXTURE_DAYS);
    if (token !== state.loadToken) return;
    state.fixtures = list;
    renderFixtures();
  } catch (err) {
    if (token !== state.loadToken) return;
    els.fixturesHint.textContent = 'No se pudo leer el calendario (la fuente de datos no respondió). ';
    const b = el('button', 'icon-btn', '↻ Reintentar');
    b.addEventListener('click', loadFixturesUI);
    els.fixturesHint.appendChild(b);
  }
}
function renderFixtures() {
  els.fixturesBox.textContent = '';
  if (!state.fixtures.length) { els.fixturesHint.textContent = `No hay partidos programados en los próximos ${FIXTURE_DAYS} días para esta competición.`; return; }
  els.fixturesHint.textContent = 'Próximos partidos (hora de Colombia). Toque uno para ver el pronóstico.';
  for (const ev of state.fixtures) {
    const chip = el('button', 'chip' + (state.event && state.event.id === ev.id ? ' active' : ''), `${ev.home.name} vs ${ev.away.name}`);
    chip.type = 'button';
    chip.appendChild(el('small', null, fmtDateTime(ev.date)));
    chip.addEventListener('click', () => selectEvent(ev));
    els.fixturesBox.appendChild(chip);
  }
}
els.league.addEventListener('change', loadFixturesUI);

// ===== Partido =====
function clearOdds() {
  for (const h of ['h1', 'h2']) { for (const k of ODD_KEYS) oddInput(h, k).value = ''; state.oddsAt[h] = null; }
}
async function selectEvent(ev) {
  cancelAI();
  const token = ++state.loadToken;
  state.event = ev; state.parts = null; state.input = null; state.fc = null; state.bets = null;
  state.context = []; state.llm1x2 = null; state.aiMarkdown = '';
  clearOdds(); // las cuotas escritas eran de otro partido
  els.neutral.checked = ev.neutral === true;
  els.contextBox.textContent = ''; els.result.textContent = ''; els.usage.hidden = true;
  renderFixtures();
  els.matchCard.hidden = false;
  els.matchTitle.textContent = `${ev.home.name} vs ${ev.away.name}`;
  els.matchSub.textContent = `${LEAGUES[state.slug].name} · ${fmtDay(ev.date)}, ${fmtHour(ev.date)} (hora de Colombia)` + (ev.venue && ev.venue.name ? ` · ${ev.venue.name}` : '');
  els.qualityBadge.textContent = ''; els.qualityBadge.className = 'badge';
  els.forecastBox.textContent = ''; els.valueBox.textContent = ''; els.dataBox.textContent = ''; els.shareBar.hidden = true;
  showStatus('Leyendo tabla, resultados y cuotas del partido…', 'loading');
  els.matchCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const parts = await Data.loadMatch(state.slug, LEAGUES[state.slug], ev);
    if (token !== state.loadToken) return;
    state.parts = parts;
    hideStatus();
    recompute();
  } catch (err) {
    if (token !== state.loadToken) return;
    showStatus('No se pudieron leer los datos del partido. Intente de nuevo.', 'error');
  }
}

function readOdd(input) { const v = parseFloat(String(input.value).replace(',', '.')); return Number.isFinite(v) && v > 1 ? v : null; }
function userHouses() {
  const out = [];
  for (const [h, sel] of [['h1', els.h1Name], ['h2', els.h2Name]]) {
    const odds = { home: readOdd(oddInput(h, 'home')), draw: readOdd(oddInput(h, 'draw')), away: readOdd(oddInput(h, 'away')), over25: readOdd(oddInput(h, 'over')), under25: readOdd(oddInput(h, 'under')) };
    if (Object.values(odds).some(v => v != null)) out.push({ name: sel.value, src: 'U', odds, at: state.oddsAt[h] || Date.now() });
  }
  return out;
}
const bankrollValue = () => Math.max(0, parseFloat(els.bankroll.value) || 0);

function recompute() {
  if (!state.parts || !state.event) return;
  const used = state.context.filter(c => c.used);
  const input = Data.buildInput(Object.assign({}, state.parts, { neutral: els.neutral.checked, context: used }));
  input.houses = input.houses.concat(userHouses());
  state.input = input;
  state.fc = Engine.forecast(input);
  state.bets = Engine.evaluateBets(state.fc, { bankroll: bankrollValue(), now: Date.now(), kickoff: Date.parse(state.event.date) });
  renderForecast();
  renderValue();
  renderData();
  saveTrack();
}
let recomputeTimer = null;
function scheduleRecompute() { clearTimeout(recomputeTimer); recomputeTimer = setTimeout(recompute, 200); }
for (const h of ['h1', 'h2']) for (const k of ODD_KEYS) oddInput(h, k).addEventListener('input', () => { state.oddsAt[h] = Date.now(); scheduleRecompute(); });
for (const e of [els.h1Name, els.h2Name, els.bankroll]) e.addEventListener('change', () => { saveBank(); scheduleRecompute(); });
els.bankroll.addEventListener('input', scheduleRecompute);
els.neutral.addEventListener('change', recompute);

// ===== Pintar el pronóstico =====
function renderForecast() {
  const fc = state.fc, ev = state.event, box = els.forecastBox;
  box.textContent = '';
  const level = fc.quality.level;
  els.qualityBadge.textContent = level === 'Sin pronóstico' ? 'Sin pronóstico' : `Calidad de los datos: ${level}`;
  els.qualityBadge.className = 'badge ' + (level === 'Completa' ? 'completa' : level === 'Parcial' ? 'parcial' : level === 'Pobre' ? 'pobre' : 'sin');
  if (!fc.final) {
    const nb = el('div', 'note-box bad');
    nb.appendChild(el('h3', null, 'No hay datos suficientes para pronosticar este partido'));
    for (const r of fc.quality.reasons) nb.appendChild(el('p', null, r));
    nb.appendChild(el('p', null, 'Si escribe abajo las cuotas de su casa, la app puede mostrar al menos lo que piensa el mercado.'));
    box.appendChild(nb);
    els.shareBar.hidden = true;
    return;
  }
  const poor = level === 'Pobre';
  const P = poor ? pct5 : pct; // con datos pobres no se finge precisión
  const rows = [[ev.home.name, fc.final.home, 0], ['Empate', fc.final.draw, 1], [ev.away.name, fc.final.away, 2]];
  const probs = el('div', 'probs');
  for (const [name, p, i] of rows) {
    const row = el('div', 'prob-row');
    row.appendChild(el('div', 'name', name));
    const bar = el('div', 'bar'); const fill = el('span'); fill.style.width = Math.round(p * 100) + '%'; bar.appendChild(fill); row.appendChild(bar);
    row.appendChild(el('div', 'val', P(p)));
    const parts = [`${Math.round(p * 10)} de cada 10`];
    if (fc.market.x) parts.push(`mercado ${pct(fc.market.x[i])}`);
    if (fc.model.ok) parts.push(`modelo ${pct(fc.model.probs[i])}`);
    row.appendChild(el('div', 'sub', parts.join(' · ')));
    probs.appendChild(row);
  }
  box.appendChild(probs);

  const tiles = el('div', 'tiles');
  const tile = (k, v, s) => { const t = el('div', 'tile'); t.appendChild(el('div', 'k', k)); t.appendChild(el('div', 'v', v)); if (s) t.appendChild(el('div', 's', s)); tiles.appendChild(t); };
  tile('Más de 2,5 goles', P(fc.final.over25), 'fuente: ' + fc.overSource);
  tile('Ambos anotan', P(fc.btts), 'derivado, aproximado');
  const top = fc.topScores[0];
  tile('Marcador más probable', `${top.home}–${top.away}`, `ocurre cerca de 1 de cada ${oneIn(top.p)} veces`);
  if (fc.model.ok) tile('Goles esperados (modelo)', `${dec(fc.model.lambda, 1)} – ${dec(fc.model.mu, 1)}`, 'local – visitante');
  else tile('Goles esperados', `${dec(fc.fit.lambda, 1)} – ${dec(fc.fit.mu, 1)}`, 'según el mercado');
  box.appendChild(tiles);
  box.appendChild(el('p', 'small muted', 'Otros marcadores probables: ' + fc.topScores.slice(1).map(s => `${s.home}–${s.away} (${pct(s.p)})`).join(' · ')));

  const how = el('div', 'note-box' + (poor ? ' bad' : ''));
  let txt;
  if (fc.market.x && fc.model.ok) {
    txt = fc.w > 0
      ? `El pronóstico es el mercado (cuotas sin margen) con un ajuste del ${Math.round(fc.w * 100)}% hacia el modelo de goles. ${fc.D < Engine.LIMITS.dLow ? 'Ambos están de acuerdo' : 'Se parecen, pero no del todo, así que el ajuste es menor'} (diferencia máxima de ${Math.round(fc.D * 100)} puntos).`
      : `El modelo de goles y el mercado discrepan en ${Math.round(fc.D * 100)} puntos. En estos casos casi siempre al modelo le falta una noticia (rotación, bajas), así que el pronóstico es el del mercado.`;
  } else if (fc.market.x) txt = 'El pronóstico es lo que dicen las cuotas (sin el margen de la casa). No hay modelo de goles para este partido.';
  else txt = 'No hay cuotas para este partido: el pronóstico sale solo del modelo de goles, que no conoce bajas ni rotaciones. Escriba las cuotas de su casa para contrastarlo.';
  how.appendChild(el('p', null, txt));
  box.appendChild(how);

  const q = el('details', 'fold');
  q.appendChild(el('summary', null, `¿Por qué la calidad de los datos es "${level}"?`));
  const qb = el('div', 'fold-body'); const ul = el('ul');
  for (const r of fc.quality.reasons.concat(fc.notes || [], fc.model.notes || [], fc.market.notes || [])) ul.appendChild(el('li', null, r));
  qb.appendChild(ul);
  qb.appendChild(el('p', 'small muted', '"Calidad de los datos" indica qué tan bien respaldado está el número, no qué tan probable es acertar.'));
  q.appendChild(qb);
  box.appendChild(q);
  els.shareBar.hidden = false;
}

// ===== Pintar el valor de las apuestas =====
function renderValue() {
  const box = els.valueBox, fc = state.fc, bets = state.bets;
  box.textContent = '';
  if (!fc.final) return;
  const uHouses = fc.market.houses.filter(h => h.src === 'U');
  if (!uHouses.length) {
    const nb = el('div', 'note-box');
    nb.appendChild(el('h3', null, '¿Vale la pena apostar?'));
    nb.appendChild(el('p', null, 'Escriba arriba las cuotas de dos casas donde usted pueda apostar. La app comparará sus precios y le dirá si alguna cuota paga más de lo que vale; si no, la recomendación será no apostar.'));
    box.appendChild(nb);
    return;
  }
  const rec = bets.recommended;
  const nb = el('div', 'note-box ' + (rec && rec.stake > 0 ? 'good' : 'bad'));
  if (rec) {
    const bank = bankrollValue();
    nb.appendChild(el('h3', null, `${rec.stake > 0 || !bank ? '✅' : '⚠️'} Hay una cuota con valor: ${rec.label} en ${rec.house}, a ${rec.odds.toFixed(2)}`));
    if (!bank) nb.appendChild(el('p', null, 'Escriba su banca para ver el monto sugerido (nunca más del 1% de la banca).'));
    else if (rec.stake > 0) nb.appendChild(el('p', null, `Monto sugerido: ${cop(rec.stake)} (${dec(rec.pctStake * 100, 2)}% de su banca; el tope es 1%). Una sola apuesta en este partido, sin combinarla.`));
    else nb.appendChild(el('p', null, 'Con su banca, el monto sugerido queda por debajo de $1.000: es demasiado pequeño para que valga la pena. No apostar.'));
    nb.appendChild(el('p', null, `Ventaja estimada: ${signed(rec.ev)} sobre lo apostado. Este valor viene de que su casa paga más que la otra, no de que la app sepa más que el mercado. Sigue siendo una apuesta: puede perderla.`));
  } else {
    nb.appendChild(el('h3', null, '⛔ No apostar este partido'));
    const reasons = [];
    for (const r of bets.rows) for (const w of r.why) if (!reasons.includes(w)) reasons.push(w);
    if (!bets.rows.length) reasons.push('Las cuotas escritas están incompletas o no son creíbles: se necesitan las tres del 1X2 (o las dos del más/menos) de cada casa.');
    for (const r of reasons.slice(0, 4)) nb.appendChild(el('p', null, '• ' + r));
    nb.appendChild(el('p', null, 'Es lo normal: la mayoría de los partidos no ofrece ninguna cuota con valor. No apostar también es ganar.'));
  }
  box.appendChild(nb);

  if (bets.rows.length) {
    const wrap = el('div', 'tbl-wrap'); const t = el('table', 'tbl');
    const hr = el('tr'); ['Casa', 'Apuesta', 'Cuota', 'Frente a sus casas', 'Frente al pronóstico', 'Veredicto'].forEach(h => hr.appendChild(el('th', null, h)));
    const thead = el('thead'); thead.appendChild(hr); t.appendChild(thead);
    const tb = el('tbody');
    for (const r of bets.rows) {
      const tr = el('tr');
      tr.appendChild(el('td', null, r.house)); tr.appendChild(el('td', null, r.label)); tr.appendChild(el('td', null, r.odds.toFixed(2)));
      tr.appendChild(el('td', null, r.evPrice != null ? signed(r.evPrice) : '—')); tr.appendChild(el('td', null, signed(r.evFinal)));
      const positive = r.ev != null && r.ev > 0;
      const td = el('td'); td.appendChild(el('span', 'tag ' + (r.ok ? 'good' : (positive ? 'mid' : 'bad')), r.ok ? 'Con valor' : (positive ? 'Insuficiente' : 'Sin valor'))); tr.appendChild(td);
      tb.appendChild(tr);
    }
    t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
    box.appendChild(el('p', 'small muted', '"Frente a sus casas": cuánto paga esa cuota por encima del consenso de las casas que usted escribió. "Frente al pronóstico": lo mismo contra el pronóstico final. Para decidir se toma el menor de los dos.'));
  }
  const houseNotes = [];
  for (const h of fc.market.houses) for (const n of h.notes) houseNotes.push(`${h.name}: ${n}`);
  if (houseNotes.length) { const p = el('ul', 'fineprint'); for (const n of houseNotes) p.appendChild(el('li', null, n)); box.appendChild(p); }
}

// ===== Pintar los datos usados =====
function renderData() {
  const box = els.dataBox, input = state.input, fc = state.fc;
  box.textContent = '';
  const m = input.model;
  if (m) {
    const wrap = el('div', 'tbl-wrap'); const t = el('table', 'tbl');
    const hr = el('tr'); ['Equipo', 'Torneo (PJ · GF-GC)', 'En casa', 'Fuera', 'Torneo anterior', 'Últimos de liga', 'Ataque', 'Defensa'].forEach(h => hr.appendChild(el('th', null, h)));
    const thead = el('thead'); thead.appendChild(hr); t.appendChild(thead);
    const tb = el('tbody');
    const rec = (r) => (r ? `${r.pj} · ${r.gf}-${r.gc}` : '—');
    for (const [team, s] of [[m.home, fc.model.home], [m.away, fc.model.away]]) {
      const tr = el('tr');
      tr.appendChild(el('td', null, team.name)); tr.appendChild(el('td', null, rec(team)));
      tr.appendChild(el('td', null, rec(team.homeRec))); tr.appendChild(el('td', null, rec(team.awayRec)));
      tr.appendChild(el('td', null, team.promoted ? 'no jugó' : rec(team.prev)));
      tr.appendChild(el('td', null, team.last5 && team.last5.length ? team.last5.map(e => `${e.cond} ${e.gf}-${e.gc}`).join(', ') : '—'));
      tr.appendChild(el('td', null, s ? dec(s.att, 2) : '—')); tr.appendChild(el('td', null, s ? dec(s.def, 2) : '—'));
      tb.appendChild(tr);
    }
    t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
    if (fc.model.ok) box.appendChild(el('p', 'small muted', `Ataque y defensa: 1,00 es el promedio de la liga (ataque más alto = anota más; defensa más baja = recibe menos). Promedio de la liga: ${dec(fc.model.league.g, 2)} goles por partido. L = de local, V = de visitante. Las columnas "En casa" y "Fuera" son informativas: el modelo usa los totales, porque en la prueba con partidos reales el desglose empeoraba el pronóstico.`));
  }
  const hs = fc.market.houses;
  if (hs.length) {
    const wrap = el('div', 'tbl-wrap'); const t = el('table', 'tbl');
    const hr = el('tr'); ['Casa', 'Origen', '1', 'X', '2', 'Más 2,5', 'Menos 2,5', 'Margen 1X2'].forEach(h => hr.appendChild(el('th', null, h)));
    const thead = el('thead'); thead.appendChild(hr); t.appendChild(thead);
    const tb = el('tbody');
    const f = (v) => (v ? v.toFixed(2) : '—');
    for (const h of hs) {
      const tr = el('tr');
      tr.appendChild(el('td', null, h.name)); tr.appendChild(el('td', null, h.src === 'U' ? 'escrita por usted' : 'referencia (ESPN)'));
      for (const k of ['home', 'draw', 'away', 'over25', 'under25']) tr.appendChild(el('td', null, f(h.odds[k])));
      tr.appendChild(el('td', null, h.m1x2 ? dec((h.m1x2.overround - 1) * 100, 1) + '%' : '—'));
      tb.appendChild(tr);
    }
    t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
  }
  box.appendChild(el('p', 'small muted', `Fuente de tabla, resultados y cuotas de referencia: ESPN${input.tournament ? ` (${input.tournament.name} ${input.tournament.year})` : ''}. Las cuotas de referencia son de una casa internacional y pueden diferir de las de su casa.`));
}

// ===== Copiar / compartir =====
function shareText() {
  const fc = state.fc, ev = state.event;
  if (!fc || !fc.final || !ev) return '';
  const top = fc.topScores[0];
  const lines = [
    `⚽ ${ev.home.name} vs ${ev.away.name}`,
    `${LEAGUES[state.slug].name} · ${fmtDateTime(ev.date)}`,
    `Pronóstico: ${ev.home.name} ${pct(fc.final.home)} · Empate ${pct(fc.final.draw)} · ${ev.away.name} ${pct(fc.final.away)}`,
    `Más de 2,5 goles: ${pct(fc.final.over25)} · Ambos anotan: ${pct(fc.btts)}`,
    `Marcador más probable: ${top.home}-${top.away} (1 de cada ${oneIn(top.p)})`,
    `Calidad de los datos: ${fc.quality.level}`
  ];
  const rec = state.bets && state.bets.recommended;
  lines.push(rec && rec.stake > 0 ? `Cuota con valor: ${rec.label} en ${rec.house} a ${rec.odds.toFixed(2)}` : 'Apuesta recomendada: ninguna');
  lines.push('', 'Estimación estadística, no una garantía. Juegue con responsabilidad.');
  return lines.join('\n');
}
els.btnCopy.addEventListener('click', async () => {
  const t = shareText(); if (!t) return;
  try { await navigator.clipboard.writeText(t + (state.aiMarkdown ? '\n\n' + state.aiMarkdown : '')); showStatus('Pronóstico copiado.', 'success', { autoHide: 2000 }); }
  catch { showStatus('No se pudo copiar automáticamente.', 'error', { autoHide: 3000 }); }
});
els.btnShare.addEventListener('click', () => {
  const t = shareText(); if (!t) return;
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
});

// ===== Renderizador Markdown seguro (solo para el texto de la IA) =====
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function safeUrl(u) { try { const url = new URL(u); if (url.protocol === 'http:' || url.protocol === 'https:') return url.href; } catch {} return null; }
function inline(s) {
  let h = escapeHtml(s);
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, rawUrl) => {
    const safe = safeUrl(rawUrl.replace(/&amp;/g, '&'));
    return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return h;
}
function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = []; let para = [];
  const flush = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) { flush(); const tag = m[1].length >= 3 ? 'h3' : 'h2'; out.push(`<${tag}>${inline(m[2])}</${tag}>`); i++; continue; }
    if (/^\s*([-_*])\1{2,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*\d+\.\s+/.test(line)) {
      flush();
      const start = parseInt(line.match(/^\s*(\d+)\./)[1], 10) || 1; const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let c = lines[i].replace(/^\s*\d+\.\s+/, ''); const sub = []; i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { const b = lines[i].match(/^\s*[-*]\s+(.*)$/); if (b) sub.push(b[1]); else c += ' ' + lines[i].trim(); i++; }
        items.push('<li>' + inline(c) + (sub.length ? '<ul>' + sub.map(s => '<li>' + inline(s) + '</li>').join('') + '</ul>' : '') + '</li>');
      }
      out.push(`<ol start="${start}">` + items.join('') + '</ol>'); continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flush(); const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let c = lines[i].replace(/^\s*[-*]\s+/, ''); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { c += ' ' + lines[i].trim(); i++; }
        items.push('<li>' + inline(c) + '</li>');
      }
      out.push('<ul>' + items.join('') + '</ul>'); continue;
    }
    para.push(line); i++;
  }
  flush();
  return out.join('\n');
}

// ===== Llamada a la IA (opcional): streaming, reintentos y turnos pausados =====
async function fetchWithRetry(body, signal, onRetry, withFallbackBeta) {
  const headers = { 'Content-Type': 'application/json', 'x-api-key': loadConfig().apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  if (withFallbackBeta) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  let attempt = 0;
  while (true) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (resp.ok) return resp;
    const retryable = resp.status === 429 || resp.status === 529 || (resp.status >= 500 && resp.status < 600);
    if (retryable && attempt < 3) {
      const ra = parseInt(resp.headers.get('retry-after'), 10);
      const waitMs = Number.isFinite(ra) ? Math.min(ra * 1000, 30000) : Math.min(1000 * 2 ** attempt, 8000);
      attempt++;
      if (onRetry) onRetry(resp.status, attempt);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    let detail = '';
    try { detail = (await resp.json())?.error?.message || ''; } catch {}
    const map = { 401: 'API key inválida o sin permisos.', 403: 'Acceso denegado con esta API key.', 429: 'Límite de peticiones alcanzado. Intente en unos minutos.', 529: 'Los servidores de Claude están saturados. Intente en unos minutos.' };
    const error = new Error(resp.status === 400 ? (detail || 'Solicitud inválida (revise el saldo de su cuenta).') : (map[resp.status] || detail || `Error ${resp.status} de la API.`));
    error.status = resp.status;
    throw error;
  }
}

async function readStream(resp, { onText, onSearch }) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const blocks = {}, partialJson = {};
  let buffer = '', stopReason = null;
  const usage = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const evt of events) {
      const dataLine = evt.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      let data;
      try { data = JSON.parse(payload); } catch { continue; }
      if (data.type === 'message_start') {
        usage.input_tokens = Math.max(usage.input_tokens, data.message?.usage?.input_tokens || 0);
      } else if (data.type === 'content_block_start') {
        blocks[data.index] = JSON.parse(JSON.stringify(data.content_block));
        if (data.content_block.type === 'server_tool_use') partialJson[data.index] = '';
      } else if (data.type === 'content_block_delta') {
        const d = data.delta, blk = blocks[data.index];
        if (d.type === 'text_delta') { if (blk) blk.text = (blk.text || '') + d.text; if (onText) onText(d.text); }
        else if (d.type === 'input_json_delta') partialJson[data.index] = (partialJson[data.index] || '') + d.partial_json;
        else if (d.type === 'citations_delta' && blk) (blk.citations = blk.citations || []).push(d.citation);
        // Los bloques de razonamiento deben reenviarse intactos si el turno se pausa
        else if (d.type === 'thinking_delta' && blk) blk.thinking = (blk.thinking || '') + d.thinking;
        else if (d.type === 'signature_delta' && blk) blk.signature = (blk.signature || '') + d.signature;
      } else if (data.type === 'content_block_stop') {
        const blk = blocks[data.index];
        if (blk && blk.type === 'server_tool_use') {
          try { blk.input = JSON.parse(partialJson[data.index] || '{}'); } catch { blk.input = {}; }
          if (blk.name === 'web_search' && blk.input?.query && onSearch) onSearch(blk.input.query);
        }
      } else if (data.type === 'message_delta') {
        if (data.delta?.stop_reason) stopReason = data.delta.stop_reason;
        usage.output_tokens += data.usage?.output_tokens || 0;
        usage.input_tokens = Math.max(usage.input_tokens, data.usage?.input_tokens || 0);
        usage.web_search_requests += data.usage?.server_tool_use?.web_search_requests || 0;
      } else if (data.type === 'error') {
        throw new Error(data.error?.message || 'Error de streaming.');
      }
    }
  }
  return { stopReason, usage, blocks: Object.keys(blocks).sort((a, b) => a - b).map(k => blocks[k]) };
}

async function runClaude({ system, userPrompt, tools, maxTokens, signal, onText, onSearch, onRetry }) {
  const model = currentModel();
  let messages = [{ role: 'user', content: userPrompt }];
  const allBlocks = [];
  const total = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 };
  let stopReason = null, text = '';
  const collect = (t) => { text += t; if (onText) onText(t); };
  // Si el modelo declina por sus filtros, la API reintenta en un modelo de respaldo (Haiku no lo tiene).
  let useFallbacks = !model.includes('haiku');
  for (let cont = 0; cont < 6; cont++) {
    const body = { model, max_tokens: maxTokens, system, tools, messages, stream: true };
    if (useFallbacks) body.fallbacks = 'default';
    let resp;
    try { resp = await fetchWithRetry(body, signal, onRetry, useFallbacks); }
    catch (err) {
      // Si esta cuenta no admite el respaldo, se repite la petición sin él en vez de fallar
      if (useFallbacks && err.status === 400 && /fallback/i.test(err.message)) { useFallbacks = false; cont--; continue; }
      throw err;
    }
    const { stopReason: sr, usage, blocks } = await readStream(resp, { onText: collect, onSearch });
    total.input_tokens += usage.input_tokens; total.output_tokens += usage.output_tokens; total.web_search_requests += usage.web_search_requests;
    stopReason = sr;
    allBlocks.push(...blocks);
    if (sr === 'pause_turn') { messages = [{ role: 'user', content: userPrompt }, { role: 'assistant', content: allBlocks.slice() }]; continue; }
    break;
  }
  return { text, stopReason, usage: total, model, blocks: allBlocks };
}

function cancelAI() {
  if (state.aiController) { state.aiController.abort(); state.aiController = null; }
  state.aiToken++;
  els.btnAi.disabled = false;
}

async function analyzeContext() {
  if (!state.event || !state.fc) return;
  if (!loadConfig().apiKey) { openModal(); return; }
  cancelAI();
  const token = state.aiToken;
  const ev = state.event, slug = state.slug;
  const controller = new AbortController();
  state.aiController = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, AI_TIMEOUT_MS);
  els.btnAi.disabled = true;
  els.result.textContent = ''; els.contextBox.textContent = ''; els.usage.hidden = true;
  const live = () => token === state.aiToken;
  const cancel = () => { cancelAI(); showStatus('Análisis cancelado.', 'success', { autoHide: 2500 }); };
  showStatus('Buscando novedades del partido en la web…', 'loading', { onCancel: cancel });

  // La variante básica de la búsqueda devuelve cada resultado con su URL: así se comprueba la fuente.
  const tool = { type: 'web_search_20250305', name: 'web_search', max_uses: 6 };
  if (LEAGUES[slug].country === 'CO') tool.user_location = { type: 'approximate', city: 'Bogotá', region: 'Bogotá', country: 'CO', timezone: TZ };
  const longDate = { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const userPrompt = Data.contextUserPrompt({
    cfg: LEAGUES[slug], event: ev, input: state.input, fc: state.fc,
    todayText: new Date().toLocaleDateString('es-CO', longDate),
    kickoffText: new Date(ev.date).toLocaleString('es-CO', Object.assign({ hour: '2-digit', minute: '2-digit' }, longDate)) + ' (hora de Colombia)'
  });

  let shown = '', timer = null, done = false;
  const flush = () => { timer = null; if (done || !live()) return; els.result.innerHTML = renderMarkdown(shown.replace(/<datos_json>[\s\S]*?(<\/datos_json>|$)/i, '')); };
  const onText = (t) => { shown += t; if (!timer) timer = setTimeout(flush, 150); };
  const onSearch = (q) => { if (live()) showStatus(`🔍 Buscando: ${q}`, 'loading', { onCancel: cancel }); };
  const onRetry = (code, n) => { if (live()) showStatus(`Servidor ocupado (${code}). Reintentando… (${n}/3)`, 'loading', { onCancel: cancel }); };

  try {
    const { text, stopReason, usage, model, blocks } = await runClaude({ system: Data.CONTEXT_SYSTEM, userPrompt, tools: [tool], maxTokens: 16000, signal: controller.signal, onText, onSearch, onRetry });
    done = true; clearTimeout(timer);
    if (!live()) return;
    if (stopReason === 'refusal') throw new Error('El modelo declinó responder esta consulta. Intente de nuevo o cambie de modelo en ⚙️.');
    if (!text.trim()) throw new Error('La respuesta llegó vacía. Intente de nuevo.');

    const ex = Data.extractContext(text);
    // URL que la búsqueda realmente devolvió en esta consulta
    const seen = [];
    for (const b of blocks) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r && typeof r.url === 'string') seen.push(r.url);
    const complete = stopReason === 'end_turn';
    const verified = Data.verifyContext(ex.contexto, seen);
    // Una respuesta cortada no ajusta el pronóstico: podría faltar la mitad de las novedades
    state.context = complete ? verified : verified.map(c => Object.assign(c, { used: false }));
    state.llm1x2 = ex.llm1x2;
    let md = ex.cleanText;
    if (!complete) {
      const why = stopReason === 'max_tokens' ? 'se cortó por límite de longitud' : stopReason === 'pause_turn' ? 'quedó a medias tras demasiadas búsquedas' : 'se interrumpió antes de terminar';
      md += `\n\n---\n\n⚠️ **Aviso:** la respuesta ${why}. Por precaución no se usó para ajustar el pronóstico. Vuelva a intentarlo.`;
    }
    state.aiMarkdown = md;
    els.result.innerHTML = renderMarkdown(md);
    renderContext(ex.parsed, seen.length, complete);
    const usd = (usage.input_tokens / 1e6) * PRICES[model].in + (usage.output_tokens / 1e6) * PRICES[model].out + usage.web_search_requests * WEB_SEARCH_USD;
    els.usage.textContent = `Esta consulta: ${usage.input_tokens.toLocaleString('es-CO')} tokens de entrada · ${usage.output_tokens.toLocaleString('es-CO')} de salida · ${usage.web_search_requests} búsqueda(s) ≈ US$${usd.toFixed(3)} (~${cop(usd * USD_TO_COP)} COP, estimado).`;
    els.usage.hidden = false;
    hideStatus();
    recompute(); // el contexto verificado ajusta los goles esperados
  } catch (err) {
    if (!live()) return;
    if (err.name === 'AbortError') showStatus(timedOut ? 'Tiempo de espera agotado. Intente de nuevo.' : 'Análisis cancelado.', timedOut ? 'error' : 'success', { autoHide: 3500 });
    else showStatus(`❌ ${err.message}`, 'error');
  } finally {
    clearTimeout(timeout);
    if (state.aiController === controller) { state.aiController = null; els.btnAi.disabled = false; }
  }
}
els.btnAi.addEventListener('click', analyzeContext);

function renderContext(parsed, nSeen, complete) {
  const box = els.contextBox;
  box.textContent = '';
  const nb = el('div', 'note-box');
  nb.appendChild(el('h3', null, 'Novedades que ajustan el pronóstico'));
  if (!parsed) nb.appendChild(el('p', null, 'La IA no devolvió los datos en el formato esperado: el pronóstico no se ajustó. El texto de abajo es solo informativo.'));
  else if (!state.context.length) nb.appendChild(el('p', null, 'La IA no encontró bajas ni rotaciones: el pronóstico no cambia.'));
  else {
    const ROLE = { goleador: 'goleador', creador: 'creador de juego', defensa_titular: 'defensa titular', arquero: 'arquero', otro: 'otro jugador' };
    const ul = el('ul'); ul.style.paddingLeft = '20px';
    for (const c of state.context) {
      const who = c.team === 'home' ? state.event.home.name : c.team === 'away' ? state.event.away.name : 'Partido';
      const what = c.type === 'baja' ? `baja de ${c.player || 'un jugador'} (${ROLE[c.role]})` : c.type === 'rotacion' ? 'rotación de titulares' : 'sin público';
      const counts = c.type !== 'baja' || c.role !== 'otro';
      let verdict;
      if (c.used) verdict = counts ? '✔ usado en el cálculo' : '✔ confirmado (no cambia el cálculo: no es un jugador clave)';
      else if (!complete) verdict = '✖ no usado: la respuesta quedó incompleta';
      else if (c.status !== 'confirmada') verdict = `✖ no usado: es ${c.status === 'duda' ? 'duda' : 'rumor'}, no está confirmado`;
      else verdict = '✖ no usado: la fuente citada no aparece entre los resultados de la búsqueda';
      const li = el('li', null, `${who}: ${what}. ${verdict}.`);
      const u = safeUrl(c.url);
      if (u && c.sourceSeen) { const a = el('a', null, ' fuente'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'var(--info)'; li.appendChild(a); }
      ul.appendChild(li);
    }
    nb.appendChild(ul);
    if (!nSeen) nb.appendChild(el('p', null, 'No se pudo comprobar ninguna fuente en esta consulta, así que nada se usó para ajustar el pronóstico.'));
  }
  nb.appendChild(el('p', 'small muted', 'Cada novedad usada mueve los goles esperados un 4–5%, con un tope total del 10%.'));
  box.appendChild(nb);
}

// ===== Seguimiento =====
const loadTrack = () => { const t = load(TRACK_KEY, []); return Array.isArray(t) ? t : []; };
const saveTrackList = (list) => { if (!save(TRACK_KEY, list)) showStatus('No se pudo guardar el seguimiento en este navegador (almacenamiento lleno o bloqueado).', 'error', { autoHide: 5000 }); };

function saveTrack() {
  const fc = state.fc, ev = state.event;
  if (!fc || !fc.final || !ev) return;
  const kickoff = Date.parse(ev.date);
  const now = Date.now();
  // Lo que cuenta es el último pronóstico guardado antes del partido: después ya no se modifica.
  if (now > kickoff - FREEZE_BEFORE_MS) return;
  const list = loadTrack();
  const id = `${state.slug}:${ev.id}`;
  const idx = list.findIndex(r => r.id === id);
  const rec = state.bets && state.bets.recommended;
  const record = {
    id, slug: state.slug, eventId: ev.id, league: LEAGUES[state.slug].name, home: ev.home.name, away: ev.away.name, kickoff: ev.date,
    savedAt: new Date(now).toISOString(), v: 3,
    final: [fc.final.home, fc.final.draw, fc.final.away], over: fc.final.over25, btts: fc.btts,
    market: fc.market.x || null, model: fc.model.ok ? fc.model.probs : null, llm: state.llm1x2 || null,
    quality: fc.quality.level, top: `${fc.topScores[0].home}-${fc.topScores[0].away}`,
    rec: rec && rec.stake > 0 ? { house: rec.house, key: rec.key, label: rec.label, odds: rec.odds, stake: rec.stake, ev: rec.ev } : null,
    bet: idx >= 0 ? list[idx].bet || null : null, result: idx >= 0 ? list[idx].result || null : null
  };
  if (idx >= 0) list[idx] = record; else list.unshift(record);
  saveTrackList(list);
  refreshTrackButton();
  if (!els.trackCard.hidden) renderTrack();
}
function refreshTrackButton() { const n = loadTrack().length; els.btnTrack.textContent = n ? `📈 Seguimiento (${n})` : '📈 Seguimiento'; }

function betWon(bet, result) {
  const o = Engine.outcomeIndex(result.home, result.away), tot = result.home + result.away;
  return { home: o === 0, draw: o === 1, away: o === 2, over25: tot >= 3, under25: tot < 3 }[bet.key] === true;
}

function renderTrack() {
  const list = loadTrack().sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
  const now = Date.now();
  const resolved = list.filter(r => r.result);
  const pending = list.filter(r => !r.result);
  const overdue = pending.filter(r => now - Date.parse(r.kickoff) > 48 * 3600e3);
  const sum = Engine.trackSummary(resolved.map(r => ({ final: r.final, market: r.market, outcome: Engine.outcomeIndex(r.result.home, r.result.away) })));

  els.trackTiles.textContent = '';
  const tile = (k, v, s, cls) => { const t = el('div', 'tile'); t.appendChild(el('div', 'k', k)); t.appendChild(el('div', 'v' + (cls ? ' ' + cls : ''), v)); if (s) t.appendChild(el('div', 's', s)); els.trackTiles.appendChild(t); };
  tile('Pronósticos', String(list.length), `${resolved.length} con resultado`);
  tile('Pendientes', String(pending.length), overdue.length ? `${overdue.length} sin resultado hace más de 2 días` : 'por jugar o por registrar', overdue.length ? 'neg' : '');
  tile('Acertó el favorito', resolved.length ? `${sum.favHit} de ${resolved.length}` : '—', 'el resultado con más probabilidad');
  const bets = list.filter(r => r.bet && r.result);
  let pnl = 0, staked = 0;
  for (const r of bets) { staked += r.bet.stake; pnl += betWon(r.bet, r.result) ? r.bet.stake * (r.bet.odds - 1) : -r.bet.stake; }
  tile('Mis apuestas', bets.length ? cop(pnl) : '—', bets.length ? `${bets.length} apuesta(s), ${cop(staked)} apostados` : 'ninguna registrada', bets.length ? (pnl >= 0 ? 'pos' : 'neg') : '');

  const v = els.trackVerdict; v.textContent = '';
  const nb = el('div', 'note-box');
  if (!resolved.length) nb.appendChild(el('p', null, 'Aún no hay partidos con resultado. Cada pronóstico que usted ve queda guardado; después del partido, toque "Buscar resultados".'));
  else if (sum.stage === 'ruido') {
    nb.appendChild(el('h3', null, `Con ${resolved.length} partido(s) todavía es ruido`));
    nb.appendChild(el('p', null, 'Se necesitan al menos 100 partidos con resultado para empezar a distinguir un buen pronosticador de una racha de suerte. Hasta entonces, no saque conclusiones ni de los aciertos ni de los fallos.'));
  } else {
    const d = sum.diff;
    nb.appendChild(el('h3', null, `${resolved.length} partidos con resultado`));
    if (d) {
      const verdict = d.hi < 0 ? 'Por ahora la app va mejor que el mercado.' : d.lo > 0 ? 'Por ahora la app va PEOR que el mercado: fíese más de las cuotas que del ajuste del modelo.' : 'No hay diferencia demostrable entre la app y el mercado.';
      nb.appendChild(el('p', null, `Error medio (RPS, menor es mejor) en los ${sum.nMarket} partidos con cuotas: diferencia app − mercado de ${d.mean.toFixed(4)} (intervalo del 98%: ${d.lo.toFixed(4)} a ${d.hi.toFixed(4)}). ${verdict}`));
    }
    nb.appendChild(el('p', null, 'Calibración (lo pronosticado debería parecerse a lo ocurrido):'));
    const ul = el('ul'); ul.style.paddingLeft = '20px';
    for (const c of sum.calibration) if (c.n) ul.appendChild(el('li', null, `Favorito entre ${pct(c.from)} y ${pct(c.to)}: se pronosticó ${pct(c.predicted)} en promedio y acertó ${c.hits} de ${c.n} (${pct(c.observed.p)}; rango creíble ${pct(c.observed.lo)}–${pct(c.observed.hi)}).`));
    nb.appendChild(ul);
  }
  if (bets.length && bets.length < 200) nb.appendChild(el('p', 'small muted', `${bets.length} apuesta(s) registradas: son muy pocas para saber si la ganancia o la pérdida es habilidad o suerte (se necesitan cientos).`));
  v.appendChild(nb);

  els.trackList.textContent = '';
  for (const r of list) {
    const item = el('div', 'track-item'); const top = el('div', 'track-top'); const meta = el('div', 'meta');
    meta.appendChild(el('div', null, `${r.home} vs ${r.away}`));
    meta.appendChild(el('small', null, `${r.league} · ${fmtDateTime(r.kickoff)} · ${pct(r.final[0])}/${pct(r.final[1])}/${pct(r.final[2])} · datos: ${r.quality}`));
    const actions = el('div', 'track-actions');
    if (r.result) {
      const o = Engine.outcomeIndex(r.result.home, r.result.away);
      const fav = r.final.indexOf(Math.max.apply(null, r.final));
      actions.appendChild(el('span', 'tag ' + (o === fav ? 'good' : 'bad'), `${r.result.home}–${r.result.away} · favorito ${o === fav ? 'acertó' : 'falló'}`));
      if (r.result.extraTime) actions.appendChild(el('span', 'tag mid', 'revise: hubo prórroga o penales'));
      const edit = el('button', 'icon-btn', '✏️'); edit.title = 'Corregir el marcador'; edit.setAttribute('aria-label', 'Corregir el marcador');
      edit.addEventListener('click', () => updateRecord(r.id, x => { x.result = null; }));
      actions.appendChild(edit);
    } else if (now > Date.parse(r.kickoff)) {
      const a = document.createElement('input'), b = document.createElement('input');
      for (const i of [a, b]) { i.type = 'number'; i.min = '0'; i.max = '20'; i.step = '1'; i.inputMode = 'numeric'; }
      a.setAttribute('aria-label', `Goles de ${r.home} al minuto 90`); b.setAttribute('aria-label', `Goles de ${r.away} al minuto 90`);
      const ok = el('button', 'icon-btn', 'Guardar marcador');
      ok.addEventListener('click', () => {
        const ha = parseInt(a.value, 10), hb = parseInt(b.value, 10);
        if (!(ha >= 0 && ha <= 20 && hb >= 0 && hb <= 20)) { showStatus('Escriba los goles de ambos equipos al minuto 90 (sin prórroga ni penales).', 'error', { autoHide: 3500 }); return; }
        updateRecord(r.id, x => { x.result = { home: ha, away: hb, manual: true }; });
      });
      actions.appendChild(a); actions.appendChild(el('span', null, '–')); actions.appendChild(b); actions.appendChild(ok);
    } else actions.appendChild(el('span', 'tag mid', 'por jugar'));
    if (r.rec) {
      const betBtn = el('button', 'icon-btn', r.bet ? `✔ Aposté ${cop(r.bet.stake)}` : `Marcar: aposté la recomendada (${r.rec.label})`);
      betBtn.addEventListener('click', () => updateRecord(r.id, x => { x.bet = x.bet ? null : { house: x.rec.house, key: x.rec.key, odds: x.rec.odds, stake: x.rec.stake }; }));
      actions.appendChild(betBtn);
    }
    const del = el('button', 'icon-btn', '🗑'); del.title = 'Quitar del seguimiento'; del.setAttribute('aria-label', 'Quitar del seguimiento');
    del.addEventListener('click', () => { saveTrackList(loadTrack().filter(x => x.id !== r.id)); renderTrack(); refreshTrackButton(); });
    actions.appendChild(del);
    top.appendChild(meta); top.appendChild(actions); item.appendChild(top);
    els.trackList.appendChild(item);
  }
}
function updateRecord(id, fn) {
  const list = loadTrack(); const r = list.find(x => x.id === id);
  if (r) { fn(r); saveTrackList(list); }
  renderTrack();
}

async function refreshResults() {
  const now = Date.now();
  const due = loadTrack().filter(r => !r.result && now - Date.parse(r.kickoff) > RESULT_AFTER_MS);
  if (!due.length) { showStatus('No hay partidos jugados pendientes de resultado.', 'success', { autoHide: 2500 }); return; }
  els.btnRefreshResults.disabled = true;
  showStatus(`Buscando ${due.length} resultado(s)…`, 'loading');
  let found = 0, failed = 0;
  for (const r of due) {
    try {
      const st = await Data.loadResult(r.slug, r.eventId);
      if (st && st.completed && st.home != null && st.away != null) {
        const list = loadTrack(); const x = list.find(y => y.id === r.id);
        if (x && !x.result) { x.result = { home: st.home, away: st.away, extraTime: st.extraTime || false }; saveTrackList(list); found++; }
      }
    } catch { failed++; }
  }
  els.btnRefreshResults.disabled = false;
  renderTrack();
  const rest = due.length - found - failed;
  showStatus(`${found} resultado(s) nuevos.` + (failed ? ` ${failed} no se pudieron consultar.` : '') + (rest > 0 ? ` ${rest} aún no figuran como terminados.` : ''), failed ? 'error' : 'success', { autoHide: 4500 });
}
els.btnRefreshResults.addEventListener('click', refreshResults);
els.btnTrack.addEventListener('click', () => {
  els.trackCard.hidden = !els.trackCard.hidden;
  if (!els.trackCard.hidden) { renderTrack(); els.trackCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});
els.btnExport.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadTrack(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href; a.download = 'pronosticos-seguimiento.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
});
let clearArmed = false;
els.btnClearTrack.addEventListener('click', () => {
  if (!clearArmed) { clearArmed = true; els.btnClearTrack.textContent = '¿Seguro? Toque otra vez para borrar'; setTimeout(() => { clearArmed = false; els.btnClearTrack.textContent = '🗑 Borrar todo'; }, 4000); return; }
  clearArmed = false; els.btnClearTrack.textContent = '🗑 Borrar todo';
  try { localStorage.removeItem(TRACK_KEY); } catch {}
  renderTrack(); refreshTrackButton();
});

// ===== Inicio =====
populateSelectors();
refreshTrackButton();
loadFixturesUI();
