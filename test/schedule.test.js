"use strict";
/* Tests de la lógica de horario (bot/lib/schedule.js) — el punto que más
   fácilmente falla en silencio: ventana de disparo, dedupe y zona horaria. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pickDueFixtures, nextUpcoming, fixtureId, hasTimezone } = require("../bot/lib/schedule.js");

const NOW = Date.parse("2026-06-18T12:00:00Z");
const at = minsFromNow => new Date(NOW + minsFromNow * 60000).toISOString();

test("selecciona el partido dentro de la ventana [50,70] y descarta los de fuera", () => {
  const fixtures = [
    { home: "A", away: "B", kickoff: at(60) },   // en ventana
    { home: "C", away: "D", kickoff: at(200) },  // demasiado lejos
    { home: "E", away: "F", kickoff: at(10) },   // demasiado cerca / casi empieza
    { home: "G", away: "H", kickoff: at(-30) },  // ya empezó
  ];
  const due = pickDueFixtures(fixtures, new Set(), NOW, 60, 20);
  assert.equal(due.length, 1);
  assert.equal(due[0].fx.home, "A");
});

test("respeta los bordes de la ventana (50 y 70 incluidos; 49 y 71 fuera)", () => {
  const mk = m => [{ home: "X", away: "Y", kickoff: at(m) }];
  const due = m => pickDueFixtures(mk(m), new Set(), NOW, 60, 20);
  assert.equal(due(50).length, 1);
  assert.equal(due(70).length, 1);
  assert.equal(due(49).length, 0);
  assert.equal(due(71).length, 0);
});

test("no repite un partido ya avisado (dedupe por fixtureId)", () => {
  const fx = { home: "A", away: "B", kickoff: at(60) };
  const sent = new Set([fixtureId(fx)]);
  assert.equal(pickDueFixtures([fx], sent, NOW, 60, 20).length, 0);
});

test("ignora partidos sin hora o con hora no parseable", () => {
  const fixtures = [
    { home: "A", away: "B", kickoff: "" },
    { home: "C", away: "D", kickoff: "no-es-fecha" },
    { home: "E", away: "F" },
  ];
  assert.equal(pickDueFixtures(fixtures, new Set(), NOW, 60, 20).length, 0);
});

test("zona horaria: 'Z' (UTC) y offset '-06:00' (CDMX) dan el MISMO instante", () => {
  // 12:00Z == 06:00-06:00 (Ciudad de México, CDT). A 60 min, ambos en ventana.
  const utc = { home: "A", away: "B", kickoff: "2026-06-18T13:00:00Z" };
  const cdmx = { home: "C", away: "D", kickoff: "2026-06-18T07:00:00-06:00" };
  const due = pickDueFixtures([utc, cdmx], new Set(), NOW, 60, 20);
  assert.equal(due.length, 2, "ambos deberían entrar: representan el mismo instante");
});

test("nextUpcoming: devuelve el más próximo en el futuro, ignora pasados/sin hora", () => {
  const fixtures = [
    { home: "Pasado", away: "X", kickoff: at(-100) },
    { home: "Lejano", away: "Y", kickoff: at(500) },
    { home: "Proximo", away: "Z", kickoff: at(120) },
    { home: "SinHora", away: "W", kickoff: "" },
  ];
  assert.equal(nextUpcoming(fixtures, NOW).home, "Proximo");
});

test("nextUpcoming: null si no hay ninguno con hora futura", () => {
  assert.equal(nextUpcoming([{ home: "A", away: "B", kickoff: "" }], NOW), null);
});

test("hasTimezone: detecta Z y offsets, rechaza fechas sin zona", () => {
  assert.ok(hasTimezone("2026-06-18T12:00:00Z"));
  assert.ok(hasTimezone("2026-06-18T12:00:00-06:00"));
  assert.ok(hasTimezone("2026-06-18T12:00:00+02:00"));
  assert.ok(!hasTimezone("2026-06-18T12:00:00"));
  assert.ok(!hasTimezone("2026-06-18"));
});
