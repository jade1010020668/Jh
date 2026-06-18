#!/usr/bin/env node
/* Genera los 72 cruces de la fase de grupos en fixtures.json.
 * Las horas (kickoff) quedan vacías para que las completes tú (ISO 8601).
 * Uso:  node bot/gen-fixtures.js   (no sobreescribe horas ya puestas) */
const fs = require("fs");
const path = require("path");
const { TEAMS } = require("../js/data.js");

const FIX = path.join(__dirname, "fixtures.json");

// Conservar horas ya rellenadas si el archivo existe.
let prev = {};
try {
  JSON.parse(fs.readFileSync(FIX, "utf8")).forEach(f => {
    prev[`${f.home}|${f.away}`] = f.kickoff || "";
  });
} catch { /* no existe todavía */ }

const groups = {};
TEAMS.forEach(t => (groups[t.group] = groups[t.group] || []).push(t.name));

const out = [];
Object.keys(groups).sort().forEach(g => {
  const t = groups[g];
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++)
      out.push({
        home: t[i], away: t[j], group: g,
        kickoff: prev[`${t[i]}|${t[j]}`] || "",
        venue: "",
      });
});

fs.writeFileSync(FIX, JSON.stringify(out, null, 2) + "\n");
console.log(`Generadas ${out.length} fixtures de fase de grupos en ${FIX}`);
