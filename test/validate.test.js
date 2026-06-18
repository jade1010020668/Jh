"use strict";
/* Tests del validador (bot/validate.js) — debe cazar typos, duplicados,
   horas inválidas y horas sin zona. También valida el fixtures.json real. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateFixtures } = require("../bot/validate.js");
const { TEAMS, HOST_TEAMS } = require("../js/data.js");

const TEAMSET = [{ name: "México" }, { name: "Sudáfrica" }, { name: "Corea del Sur" }];

test("equipo inexistente (typo) -> error", () => {
  const { errors } = validateFixtures(
    [{ home: "Mexico", away: "Sudáfrica", kickoff: "" }], TEAMSET);  // "Mexico" sin acento
  assert.ok(errors.some(e => e.includes("no existe")));
});

test("equipo contra sí mismo -> error", () => {
  const { errors } = validateFixtures(
    [{ home: "México", away: "México", kickoff: "" }], TEAMSET);
  assert.ok(errors.some(e => e.includes("contra sí mismo")));
});

test("partido duplicado -> error", () => {
  const fx = { home: "México", away: "Sudáfrica", kickoff: "2026-06-11T20:00:00Z" };
  const { errors } = validateFixtures([fx, { ...fx }], TEAMSET);
  assert.ok(errors.some(e => e.includes("duplicado")));
});

test("hora no parseable -> error; hora sin zona -> aviso", () => {
  const r1 = validateFixtures([{ home: "México", away: "Sudáfrica", kickoff: "ayer" }], TEAMSET);
  assert.ok(r1.errors.some(e => e.includes("no es una fecha")));

  const r2 = validateFixtures([{ home: "México", away: "Sudáfrica", kickoff: "2026-06-11T20:00:00" }], TEAMSET);
  assert.equal(r2.errors.length, 0);
  assert.ok(r2.warnings.some(w => w.includes("sin zona horaria")));
});

test("sin hora -> aviso (no error) y cuenta en stats", () => {
  const { errors, warnings, stats } = validateFixtures(
    [{ home: "México", away: "Sudáfrica", kickoff: "" }], TEAMSET);
  assert.equal(errors.length, 0);
  assert.equal(stats.withoutTime, 1);
  assert.ok(warnings.some(w => w.includes("sin hora")));
});

test("partido válido y completo -> sin errores ni avisos", () => {
  const { errors, warnings } = validateFixtures(
    [{ home: "México", away: "Sudáfrica", kickoff: "2026-06-11T20:00:00Z" }], TEAMSET);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test("el fixtures.json REAL no tiene errores (equipos válidos, sin duplicados)", () => {
  const fixtures = require("../bot/fixtures.json");
  const { errors } = validateFixtures(fixtures, TEAMS, HOST_TEAMS);
  assert.deepEqual(errors, [], "fixtures.json no debería tener errores:\n" + errors.join("\n"));
});
