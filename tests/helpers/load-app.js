// Carga la app REAL (los mismos scripts y en el mismo orden que index.html) en un contexto de Node
// con un DOM mínimo simulado, un reloj fijo y una red falsa servida desde respuestas reales guardadas.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(), children: [], style: {}, attrs: {}, _l: {},
    value: '', checked: false, hidden: false, disabled: false, className: '', type: '',
    _text: '', _html: '',
    get textContent() { return this._text + this.children.map(c => c.textContent || '').join(''); },
    set textContent(v) { this._text = String(v); this.children = []; this._html = ''; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; this._text = ''; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(type, fn) { (el._l[type] = el._l[type] || []).push(fn); },
    appendChild(c) { el.children.push(c); return c; },
    setAttribute(k, v) { el.attrs[k] = String(v); }, removeAttribute(k) { delete el.attrs[k]; },
    focus() {}, scrollIntoView() {}, querySelector() { return null; }, remove() {}, click() { fire(el, 'click'); },
    showModal() { el.open = true; }, close() { el.open = false; }
  };
  return el;
}
function fire(el, type, evt) { for (const fn of (el._l[type] || [])) fn(Object.assign({ preventDefault() {}, target: el }, evt || {})); }

// Respuesta falsa con cuerpo en streaming (para simular la API de Anthropic)
function sseResponse(events) {
  const enc = new TextEncoder();
  const chunks = events.map(e => enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
  let i = 0;
  return { ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) } };
}
const jsonResponse = (obj, status) => ({ ok: (status || 200) < 400, status: status || 200, headers: { get: () => null }, json: async () => obj });

function loadApp(opts) {
  const o = opts || {};
  const FIXED = o.now || Date.parse('2026-11-11T17:00:00Z');
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
    static now() { return FIXED; }
  }
  const store = Object.assign({}, o.store || {});
  const elements = {};
  const requests = [];
  const ctx = {
    console, URL, Math, Number, parseInt, parseFloat, JSON, Object, Array, String, Promise, RegExp, Error, Set, Map, Symbol,
    setTimeout, clearTimeout, isNaN, TextDecoder, TextEncoder, AbortController, Blob, encodeURIComponent, decodeURIComponent,
    Date: FakeDate,
    document: {
      getElementById: (id) => (elements[id] = elements[id] || Object.assign(makeElement('div'), { id })),
      createElement: (t) => makeElement(t),
      createTextNode: (t) => ({ textContent: String(t) }),
      body: makeElement('body')
    },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { clipboard: { writeText: async () => {} } },
    addEventListener() {}, open() {},
    fetch: async (url, init) => { requests.push({ url: String(url), init }); return o.fetch ? o.fetch(String(url), init) : jsonResponse({}, 500); }
  };
  ctx.window = ctx; ctx.globalThis = ctx; // como en el navegador: window es el objeto global
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', '..', 'pronosticos');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(dir, s), 'utf8'), ctx, { filename: s });
  return { ctx, elements, store, html, scripts, requests, get: (expr) => vm.runInContext(expr, ctx), fire };
}

module.exports = { loadApp, fire, sseResponse, jsonResponse };
