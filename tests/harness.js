// Mini arnés de pruebas sin dependencias.
let passed = 0, failed = 0;
const fails = [], pending = [];
function ok(cond, msg) { if (cond) passed++; else { failed++; fails.push(msg); console.log('  ❌ ' + msg); } }
function near(a, b, tol, msg) { ok(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg} (obtenido ${a}, esperado ${b} ±${tol})`); }
function section(name) { console.log('• ' + name); }
// Las pruebas asíncronas se pasan como función y corren UNA DESPUÉS DE OTRA: varias sustituyen la red
// (global.fetch) y, si corrieran a la vez, se pisarían entre sí.
let chain = Promise.resolve();
function wait(job) {
  const run = typeof job === 'function' ? job : () => job;
  chain = chain.then(run).catch((e) => { ok(false, 'excepción en prueba asíncrona: ' + (e && e.stack || e)); });
  pending.push(chain);
}
async function summary() {
  await Promise.all(pending);
  console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
  if (failed) { console.log(fails.map(f => ' - ' + f).join('\n')); process.exitCode = 1; }
}
module.exports = { ok, near, section, wait, summary };
