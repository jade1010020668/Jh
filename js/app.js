/* ============================================================================
 *  app.js  —  Interfaz de la herramienta de análisis del Mundial 2026
 * ==========================================================================*/

/* ----------------------------- Estado global ---------------------------- */
const LS_KEY = "wc2026_elos_v1";

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(LS_KEY, JSON.stringify(o)); }

/** Equipos enriquecidos con localía y con los Elo editados aplicados. */
function getTeams() {
  const ov = loadOverrides();
  return TEAMS.map(t => ({
    ...t,
    elo: ov[t.name] != null ? ov[t.name] : t.elo,
    isHost: HOST_TEAMS.includes(t.name),
  }));
}

/** Lee los parámetros avanzados desde la UI. */
function getOpts() {
  return {
    goalsPerElo: numVal("p-goalsPerElo", Models.DEFAULTS.goalsPerElo),
    baseTotalGoals: numVal("p-baseGoals", Models.DEFAULTS.baseTotalGoals),
    rho: numVal("p-rho", Models.DEFAULTS.rho),
    homeAdvantageElo: numVal("p-homeAdv", Models.DEFAULTS.homeAdvantageElo),
    maxGoals: 10,
  };
}

const $ = id => document.getElementById(id);
const numVal = (id, d) => { const v = parseFloat($(id)?.value); return isNaN(v) ? d : v; };
const pct = x => (x * 100).toFixed(1) + "%";
const teamByName = n => getTeams().find(t => t.name === n);

/* ============================ Navegación tabs =========================== */
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.target).classList.add("active");
    });
  });
}

/* ======================= Sección: analizar partido ====================== */
function initMatchPanel() {
  const teams = getTeams().sort((a, b) => a.name.localeCompare(b.name));
  const optsHTML = teams.map(t =>
    `<option value="${t.name}">${t.flag} ${t.name} (${t.elo})</option>`).join("");
  $("sel-home").innerHTML = optsHTML;
  $("sel-away").innerHTML = optsHTML;
  $("sel-home").value = "Argentina";
  $("sel-away").value = "Brasil";

  ["sel-home", "sel-away", "chk-homeadv",
   "p-goalsPerElo", "p-baseGoals", "p-rho", "p-homeAdv",
   "f-trust", "f-kelly", "f-bankroll",
   "odd-1", "odd-x", "odd-2", "odd-over", "odd-under", "odd-btts-y", "odd-btts-n"]
    .forEach(id => $(id)?.addEventListener("input", renderMatch));

  renderMatch();
}

function renderMatch() {
  const home = teamByName($("sel-home").value);
  const away = teamByName($("sel-away").value);
  if (!home || !away) return;

  const opts = getOpts();
  // Ventaja de localía solo si se marca la casilla (p.ej. partido en sede).
  if ($("chk-homeadv").checked) opts.homeAdv = opts.homeAdvantageElo;

  const r = Models.analyzeMatch(home.elo, away.elo, opts);

  // --- Cabecera de goles esperados ---
  $("match-summary").innerHTML = `
    <div class="xg">
      <div><span class="big">${r.lambdaHome.toFixed(2)}</span><small>goles esp. ${home.flag} ${home.name}</small></div>
      <div class="vs">—</div>
      <div><span class="big">${r.lambdaAway.toFixed(2)}</span><small>goles esp. ${away.flag} ${away.name}</small></div>
    </div>`;

  // --- 1X2 + mercados ---
  $("match-markets").innerHTML = `
    ${bar("Gana " + home.name, r.pHome, "#4ade80")}
    ${bar("Empate", r.pDraw, "#fbbf24")}
    ${bar("Gana " + away.name, r.pAway, "#60a5fa")}
    <div class="market-grid">
      <div><b>Más de 2.5</b><span>${pct(r.over25)}</span></div>
      <div><b>Menos de 2.5</b><span>${pct(r.under25)}</span></div>
      <div><b>Ambos marcan: Sí</b><span>${pct(r.btts)}</span></div>
      <div><b>Ambos marcan: No</b><span>${pct(1 - r.btts)}</span></div>
    </div>
    <div class="scores">
      <b>Marcadores más probables:</b>
      ${r.topScores.map(s => `<span class="chip">${s.h}-${s.a} <i>${pct(s.p)}</i></span>`).join("")}
    </div>`;

  renderValue(r);
}

/* ----------------- Detección de valor + Kelly por mercado --------------- */
function renderValue(r) {
  const trust = numVal("f-trust", 0.4);
  const kFrac = numVal("f-kelly", 0.25);
  const bankroll = numVal("f-bankroll", 100);

  const groups = [
    { label: "1X2", names: ["Local", "Empate", "Visitante"],
      model: [r.pHome, r.pDraw, r.pAway], ids: ["odd-1", "odd-x", "odd-2"] },
    { label: "Over/Under 2.5", names: ["Más de 2.5", "Menos de 2.5"],
      model: [r.over25, r.under25], ids: ["odd-over", "odd-under"] },
    { label: "Ambos marcan", names: ["Sí", "No"],
      model: [r.btts, 1 - r.btts], ids: ["odd-btts-y", "odd-btts-n"] },
  ];

  let rows = "";
  for (const g of groups) {
    const odds = g.ids.map(id => parseFloat($(id).value));
    const haveAll = odds.every(o => o > 1);
    let fair = g.model;
    if (haveAll) fair = Models.removeMargin(odds).fair;     // mercado "justo"
    const blended = haveAll ? Models.blend(g.model, fair, trust) : g.model;

    g.names.forEach((nm, i) => {
      const o = odds[i];
      let cells;
      if (o > 1) {
        const v = Models.valueBet(blended[i], o, kFrac);
        const stake = v.kellyStakeFraction * bankroll;
        cells = `
          <td>${pct(blended[i])}</td>
          <td>${o.toFixed(2)}</td>
          <td class="${v.isValue ? "pos" : "neg"}">${v.edgePct >= 0 ? "+" : ""}${v.edgePct.toFixed(1)}%</td>
          <td>${v.isValue ? "$" + stake.toFixed(2) : "—"}</td>
          <td>${v.isValue ? "✅ VALOR" : "—"}</td>`;
      } else {
        cells = `<td>${pct(g.model[i])}</td><td>—</td><td>—</td><td>—</td><td>—</td>`;
      }
      rows += `<tr><td class="mname"><span class="mgroup">${g.label}</span> ${nm}</td>${cells}</tr>`;
    });
  }

  $("value-body").innerHTML = rows;
}

/* --------------------------- helpers de render -------------------------- */
function bar(label, p, color) {
  return `<div class="prob-row">
    <span class="prob-label">${label}</span>
    <span class="prob-track"><span class="prob-fill" style="width:${(p*100).toFixed(1)}%;background:${color}"></span></span>
    <span class="prob-val">${pct(p)}</span>
  </div>`;
}

/* ====================== Sección: simular el Mundial ===================== */
let simRunning = false;

function initSimPanel() {
  $("btn-sim").addEventListener("click", runSimulation);
  $("sim-n").addEventListener("input", () => $("sim-n-val").textContent =
    Number($("sim-n").value).toLocaleString("es"));
  $("sim-n-val").textContent = Number($("sim-n").value).toLocaleString("es");
}

async function runSimulation() {
  if (simRunning) return;
  simRunning = true;
  const total = parseInt($("sim-n").value, 10);
  const teams = getTeams();
  const opts = getOpts();
  $("btn-sim").disabled = true;
  $("sim-progress-wrap").style.display = "block";

  const batch = 500;
  const acc = {}; // name -> sums ponderados
  let done = 0;

  while (done < total) {
    const n = Math.min(batch, total - done);
    const res = Simulation.run(teams, n, opts);
    res.forEach(r => {
      const a = acc[r.name] || (acc[r.name] = {
        name: r.name, flag: r.flag, group: r.group, elo: r.elo,
        groupWinner: 0, advance: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0 });
      ["groupWinner","advance","r16","qf","sf","final","champion"]
        .forEach(k => a[k] += r[k] * n);
    });
    done += n;
    const frac = done / total;
    $("sim-bar").style.width = (frac * 100).toFixed(0) + "%";
    $("sim-progress-txt").textContent =
      `${done.toLocaleString("es")} / ${total.toLocaleString("es")} torneos simulados`;
    await new Promise(r => setTimeout(r, 0)); // ceder al hilo de UI
  }

  const out = Object.values(acc).map(a => {
    const o = { name: a.name, flag: a.flag, group: a.group, elo: a.elo };
    ["groupWinner","advance","r16","qf","sf","final","champion"]
      .forEach(k => o[k] = a[k] / total);
    return o;
  }).sort((x, y) => y.champion - x.champion);

  renderSimTable(out);
  $("btn-sim").disabled = false;
  simRunning = false;
}

function renderSimTable(rows) {
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="tleft">${r.flag} ${r.name}</td>
      <td>${r.elo}</td>
      <td>${pct(r.advance)}</td>
      <td>${pct(r.qf)}</td>
      <td>${pct(r.sf)}</td>
      <td>${pct(r.final)}</td>
      <td class="champ">${pct(r.champion)}</td>
    </tr>`).join("");
  $("sim-body").innerHTML = body;
  $("sim-results").style.display = "block";

  // Convertir prob. de campeón en "cuota justa" (1/p) para el top 3.
  const top = rows.slice(0, 3).map(r =>
    `${r.flag} <b>${r.name}</b> — ${pct(r.champion)} (cuota justa ${r.champion > 0 ? (1/r.champion).toFixed(1) : "∞"})`);
  $("sim-fav").innerHTML = "🏆 Favoritos al título: " + top.join(" · ");
}

/* ========================= Sección: ratings Elo ========================= */
function initRatingsPanel() {
  renderRatings();
  $("btn-reset-elo").addEventListener("click", () => {
    if (confirm("¿Restaurar todos los ratings Elo a sus valores por defecto?")) {
      localStorage.removeItem(LS_KEY);
      renderRatings(); refreshAfterRatingChange();
    }
  });
}

function renderRatings() {
  const teams = getTeams().sort((a, b) => b.elo - a.elo);
  $("ratings-body").innerHTML = teams.map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="tleft">${t.flag} ${t.name}</td>
      <td>${t.group}</td>
      <td><input type="number" class="elo-input" data-name="${t.name}" value="${t.elo}" step="1"></td>
    </tr>`).join("");

  document.querySelectorAll(".elo-input").forEach(inp => {
    inp.addEventListener("change", () => {
      const ov = loadOverrides();
      const v = parseInt(inp.value, 10);
      if (!isNaN(v)) ov[inp.dataset.name] = v;
      saveOverrides(ov);
      refreshAfterRatingChange();
    });
  });
}

function refreshAfterRatingChange() {
  // Re-poblar selects manteniendo selección.
  const h = $("sel-home").value, a = $("sel-away").value;
  initMatchPanel();
  $("sel-home").value = h; $("sel-away").value = a;
  renderMatch();
}

/* ------------------------------- arranque ------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initMatchPanel();
  initSimPanel();
  initRatingsPanel();
});
