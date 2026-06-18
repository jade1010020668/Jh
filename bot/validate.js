#!/usr/bin/env node
/* ============================================================================
 *  bot/validate.js  —  Valida el calendario (fixtures.json) contra los datos
 * ----------------------------------------------------------------------------
 *  Detecta los fallos silenciosos típicos ANTES de que rompan un aviso:
 *    · equipos que no existen en data.js (p. ej. un typo en el nombre),
 *    · horas no parseables o sin zona horaria explícita (ambiguas),
 *    · partidos duplicados,
 *    · equipo contra sí mismo.
 *  Uso:  node bot/validate.js   (sale con código 1 si hay ERRORES).
 *  También se usa desde doctor.js y desde los tests.
 * ==========================================================================*/

"use strict";

const path = require("path");
const { hasTimezone, fixtureId } = require("./lib/schedule.js");

/**
 *  Valida una lista de partidos. Devuelve { errors, warnings, stats }.
 *  No imprime nada (para poder testearlo); el CLI de abajo es quien imprime.
 */
function validateFixtures(fixtures, teams, hostTeams = []) {
  const errors = [];
  const warnings = [];
  const names = new Set(teams.map(t => t.name));
  const seen = new Map();
  let withTime = 0, withoutTime = 0;

  if (!Array.isArray(fixtures)) {
    return { errors: ["fixtures.json no es una lista"], warnings, stats: {} };
  }

  fixtures.forEach((fx, i) => {
    const where = `partido #${i + 1} (${fx.home} vs ${fx.away})`;

    if (!fx.home || !fx.away) { errors.push(`${where}: falta 'home' o 'away'`); return; }
    if (fx.home === fx.away) errors.push(`${where}: un equipo no puede jugar contra sí mismo`);
    if (!names.has(fx.home)) errors.push(`${where}: '${fx.home}' no existe en data.js`);
    if (!names.has(fx.away)) errors.push(`${where}: '${fx.away}' no existe en data.js`);

    const id = fixtureId(fx);
    if (seen.has(id)) errors.push(`${where}: duplicado de ${where === seen.get(id) ? "sí mismo" : seen.get(id)}`);
    else seen.set(id, where);

    if (!fx.kickoff || String(fx.kickoff).trim() === "") {
      withoutTime++;
      warnings.push(`${where}: sin hora -> no se avisará hasta que la pongas`);
    } else {
      withTime++;
      if (isNaN(new Date(fx.kickoff).getTime())) {
        errors.push(`${where}: kickoff '${fx.kickoff}' no es una fecha válida`);
      } else if (!hasTimezone(fx.kickoff)) {
        warnings.push(`${where}: kickoff '${fx.kickoff}' sin zona horaria (añade 'Z' o '-06:00')`);
      }
    }
  });

  return { errors, warnings, stats: { total: fixtures.length, withTime, withoutTime } };
}

module.exports = { validateFixtures };

/* --------------------------- CLI --------------------------------------- */
if (require.main === module) {
  const fixtures = require(path.join(__dirname, "fixtures.json"));
  const { TEAMS, HOST_TEAMS } = require(path.join(__dirname, "..", "js", "data.js"));
  const { errors, warnings, stats } = validateFixtures(fixtures, TEAMS, HOST_TEAMS);

  console.log(`📋 Calendario: ${stats.total} partidos · ${stats.withTime} con hora · ${stats.withoutTime} sin hora.`);
  warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  errors.forEach(e => console.log(`  ❌ ${e}`));

  if (errors.length) {
    console.log(`\n❌ ${errors.length} error(es). Corrige antes de desplegar.`);
    process.exit(1);
  }
  console.log(`\n✅ Sin errores${warnings.length ? ` (${warnings.length} aviso/s)` : ""}.`);
}
