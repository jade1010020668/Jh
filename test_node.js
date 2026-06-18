/* Prueba rápida del motor (no se publica en la app). */
const fs = require("fs");
const vm = require("vm");

const ctx = { Math, console, setTimeout };
vm.createContext(ctx);
for (const f of ["js/data.js", "js/models.js", "js/simulation.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
// Las consts viven en el ámbito léxico del contexto; las exponemos.
vm.runInContext("globalThis.__x = { Models, Simulation, TEAMS, HOST_TEAMS };", ctx);

const { Models, Simulation, TEAMS, HOST_TEAMS } = ctx.__x;
let ok = true;
function assert(cond, msg) { if (!cond) { ok = false; console.error("❌ " + msg); } else console.log("✅ " + msg); }

// 1) Datos
assert(TEAMS.length === 48, `48 equipos (hay ${TEAMS.length})`);

// 2) Análisis de partido: probabilidades 1X2 suman ~1
const r = Models.analyzeMatch(1890, 1490, { homeAdv: 0 });
const sum = r.pHome + r.pDraw + r.pAway;
assert(Math.abs(sum - 1) < 1e-6, `1X2 suma 1 (=${sum.toFixed(6)})`);
assert(r.pHome > r.pAway, `favorito fuerte gana más (${(r.pHome*100).toFixed(1)}% vs ${(r.pAway*100).toFixed(1)}%)`);
assert(r.lambdaHome > r.lambdaAway, `λ local > λ visita (${r.lambdaHome.toFixed(2)} > ${r.lambdaAway.toFixed(2)})`);

// 2b) Modelo log-lineal: partido parejo -> λ iguales y total = base
const even = Models.expectedGoals(1800, 1800, { baseTotalGoals: 2.65 });
assert(Math.abs(even.lambdaHome - even.lambdaAway) < 1e-9, "partido parejo: λ iguales");
assert(Math.abs((even.lambdaHome + even.lambdaAway) - 2.65) < 1e-6, `total parejo = base (=${(even.lambdaHome+even.lambdaAway).toFixed(3)})`);
// 2c) Invariante multiplicativo: el producto de λ no depende del desajuste
const eg1 = Models.expectedGoals(1900, 1500, { baseTotalGoals: 2.65 });
const eg2 = Models.expectedGoals(1700, 1700, { baseTotalGoals: 2.65 });
assert(Math.abs(eg1.lambdaHome*eg1.lambdaAway - eg2.lambdaHome*eg2.lambdaAway) < 1e-6, "producto de λ constante (modelo log-lineal)");
assert((eg1.lambdaHome+eg1.lambdaAway) > (eg2.lambdaHome+eg2.lambdaAway), "desajuste -> más goles totales (goleadas)");

// 3) Over/Under y BTTS en rango válido
assert(r.over25 >= 0 && r.over25 <= 1, "Over2.5 en [0,1]");
assert(Math.abs((r.over25 + r.under25) - 1) < 1e-6, "Over+Under = 1");

// 4) Cuotas: quita de margen (Shin por defecto)
const m = Models.removeMargin([2.10, 3.30, 3.50]);
assert(m.method === "shin", `usa método de Shin (=${m.method})`);
assert(m.overround > 1, `overround > 1 (=${m.overround.toFixed(3)}, margen ${m.marginPct.toFixed(1)}%)`);
const fairSum = m.fair.reduce((a,b)=>a+b,0);
assert(Math.abs(fairSum - 1) < 1e-9, `prob. justas (Shin) suman 1 (=${fairSum.toFixed(6)})`);
// Shin asigna al FAVORITO más prob. que el proporcional (corrige el sesgo
// favorito-perdedor): a los favoritos se les sube y a los longshots se les baja.
const prop = Models.removeMargin([2.10, 3.30, 3.50], "proporcional");
assert(m.fair[0] >= prop.fair[0] - 1e-9, `Shin sube al favorito (${m.fair[0].toFixed(3)} ≥ ${prop.fair[0].toFixed(3)})`);
assert(m.fair[2] <= prop.fair[2] + 1e-9, `Shin baja al longshot (${m.fair[2].toFixed(3)} ≤ ${prop.fair[2].toFixed(3)})`);
const m2 = Models.removeMargin([1.90, 1.90]);
assert(Math.abs(m2.fair[0]+m2.fair[1]-1) < 1e-9, "2 vías: prob. justas suman 1");

// 5) Valor y Kelly
const v = Models.valueBet(0.6, 2.0, 0.25);
assert(v.isValue && v.ev > 0, `p=0.6 @2.0 es valor (EV=${v.ev.toFixed(3)})`);
const v2 = Models.valueBet(0.4, 2.0, 0.25);
assert(!v2.isValue, "p=0.4 @2.0 NO es valor");

// 6) RPS / Brier
const rps = Models.rps([0.7,0.2,0.1], 0);
assert(rps >= 0 && rps < 0.2, `RPS razonable (=${rps.toFixed(3)})`);

// 7) Simulación de Montecarlo (pequeña)
const teams = TEAMS.map(t => ({ ...t, isHost: HOST_TEAMS.includes(t.name) }));
const sim = Simulation.run(teams, 300, { homeAdvantageElo: 45 });
const champSum = sim.reduce((a, s) => a + s.champion, 0);
const advSum = sim.reduce((a, s) => a + s.advance, 0);
assert(Math.abs(champSum - 1) < 1e-9, `prob. de campeón suma 1 (=${champSum.toFixed(4)})`);
assert(Math.abs(advSum - 32) < 1e-6, `32 equipos avanzan en promedio (=${advSum.toFixed(2)})`);
console.log("\nTop 5 favoritos (300 sims):");
sim.slice(0,5).forEach((s,i)=>console.log(`  ${i+1}. ${s.name} — campeón ${(s.champion*100).toFixed(1)}%, avanza ${(s.advance*100).toFixed(1)}%`));

console.log(ok ? "\n🎉 TODAS LAS PRUEBAS PASARON" : "\n💥 HAY FALLOS");
process.exit(ok ? 0 : 1);
