// Carga pronosticos/*.js en un contexto de Node con un DOM mínimo simulado,
// para poder probar la lógica real de la app sin navegador.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement() {
  const el = {
    children: [], style: {}, value: '', hidden: false, disabled: false, innerHTML: '', textContent: '', className: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, appendChild(c) { el.children.push(c); return c; }, setAttribute() {}, removeAttribute() {},
    focus() {}, scrollIntoView() {}, querySelector() { return null; }, showModal() {}, close() {}
  };
  return el;
}

function loadApp() {
  const store = {};
  const elements = {};
  const ctx = {
    console, URL, Date, Math, Number, parseInt, parseFloat, JSON, Object, Array, String, Promise, RegExp, Error, Set, Map,
    setTimeout, clearTimeout, isNaN, TextDecoder, AbortController,
    document: {
      getElementById: (id) => (elements[id] = elements[id] || makeElement()),
      createElement: () => makeElement(),
      createTextNode: (t) => ({ textContent: t })
    },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    window: { addEventListener() {}, open() {} },
    navigator: {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', '..', 'pronosticos');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  // Mismos scripts y mismo orden que la página real
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(dir, s), 'utf8'), ctx, { filename: s });
  return { ctx, elements, store, html, get: (expr) => vm.runInContext(expr, ctx) };
}

module.exports = { loadApp };
