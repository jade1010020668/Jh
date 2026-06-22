"use strict";
/* Tests de la capa Opus (bot/llm-adjust.js): garantías de "acotado" y "nunca rompe".
   NO llaman a la API real: usan un cliente inyectado (mock). */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { adjustForFactors, clampPct, parseJsonObject, MAX_ADJ } = require("../bot/llm-adjust.js");

test("clampPct: acota a ±MAX_ADJ y tolera basura", () => {
  assert.equal(clampPct(10), 10);
  assert.equal(clampPct(999), MAX_ADJ);
  assert.equal(clampPct(-999), -MAX_ADJ);
  assert.equal(clampPct("hola"), 0);
  assert.equal(clampPct(undefined), 0);
});

test("parseJsonObject: extrae JSON (con o sin fences), null si no hay", () => {
  assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonObject('```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(parseJsonObject('texto {"a":3} más texto'), { a: 3 });
  assert.equal(parseJsonObject("sin json aquí"), null);
  assert.equal(parseJsonObject(""), null);
});

test("sin ANTHROPIC_API_KEY -> ajuste 0 (fallback determinista)", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const adj = await adjustForFactors({ home: "México", away: "Brasil" });
    assert.equal(adj.used, false);
    assert.equal(adj.homeAdjPct, 0);
    assert.equal(adj.awayAdjPct, 0);
  } finally {
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  }
});

// Cliente mock que simula una respuesta del SDK.
const mockClient = (text, stop_reason = "end_turn") => ({
  messages: { create: async () => ({ stop_reason, content: [{ type: "text", text }] }) },
});

test("respuesta válida fuera de rango -> SIEMPRE acotada a ±MAX_ADJ", async () => {
  const client = mockClient('{"homeAdjPct": 80, "awayAdjPct": -200, "note": "x", "confidence": "alta"}');
  const adj = await adjustForFactors({ home: "A", away: "B" }, { client });
  assert.equal(adj.used, true);
  assert.equal(adj.homeAdjPct, MAX_ADJ);
  assert.equal(adj.awayAdjPct, -MAX_ADJ);
});

test("nota recortada a 180 caracteres", async () => {
  const longNote = "x".repeat(500);
  const client = mockClient(`{"homeAdjPct": 5, "awayAdjPct": 0, "note": "${longNote}"}`);
  const adj = await adjustForFactors({ home: "A", away: "B" }, { client });
  assert.ok(adj.note.length <= 180);
});

test("JSON corrupto del modelo -> ajuste 0 (no rompe)", async () => {
  const client = mockClient("el modelo no devolvió JSON");
  const adj = await adjustForFactors({ home: "A", away: "B" }, { client });
  assert.equal(adj.used, false);
  assert.equal(adj.homeAdjPct, 0);
});

test("stop_reason refusal -> ajuste 0", async () => {
  const client = mockClient("", "refusal");
  const adj = await adjustForFactors({ home: "A", away: "B" }, { client });
  assert.equal(adj.used, false);
});
