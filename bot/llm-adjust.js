/* ============================================================================
 *  bot/llm-adjust.js  —  Capa híbrida: Opus 4.8 + búsqueda web
 * ----------------------------------------------------------------------------
 *  Toma la línea base matemática (goles esperados λ de cada equipo) y la AJUSTA
 *  según LESIONES y SUSPENSIONES confirmadas, buscadas en vivo en la web.
 *
 *  Principios de diseño (para que "siempre se analice igual"):
 *    · Modelo fijo: claude-opus-4-8.
 *    · Procedimiento fijo: mismo system prompt + misma lista de factores.
 *    · Ajuste ACOTADO a ±MAX_ADJ % por equipo -> la base matemática manda;
 *      el LLM solo "empuja" por las bajas, nunca reescribe el marcador.
 *    · Si no hay API key, no hay SDK, o algo falla -> ajuste 0 (la rutina
 *      cae limpiamente al modelo determinista y nunca se rompe).
 *
 *  Variable de entorno:
 *    ANTHROPIC_API_KEY   tu clave de la API de Anthropic (secret en Actions)
 * ==========================================================================*/

"use strict";

const MODEL = "claude-opus-4-8";
const MAX_ADJ = 25;          // tope de ajuste por equipo, en % de goles esperados

// El SDK puede no estar instalado (p. ej. en local sin npm install): degradamos.
let Anthropic = null;
try { Anthropic = require("@anthropic-ai/sdk"); } catch { /* sin SDK -> fallback */ }

const SYSTEM = [
  "Eres un analista de fútbol. Tu ÚNICA tarea es estimar el impacto de las",
  "LESIONES y SUSPENSIONES confirmadas en el partido indicado y devolver un",
  "ajuste ACOTADO a los goles esperados de cada equipo. Sigue SIEMPRE el mismo",
  "procedimiento, en este orden:",
  "1) Busca en la web las bajas (lesionados y sancionados) confirmadas de AMBOS",
  "   equipos para ESTE partido y fecha.",
  "2) Pondera el impacto: la baja de cracks/goleadores o de varios titulares",
  "   reduce los goles esperados de su equipo; un rival debilitado puede subir",
  "   ligeramente los del otro.",
  "3) Sé conservador: si no hay bajas claras, o la información no es fiable o no",
  "   es de este partido, ajusta 0. Nunca inventes bajas.",
  "",
  "Responde EXCLUSIVAMENTE con un objeto JSON (sin markdown, sin texto extra):",
  '{"homeAdjPct": <número entre -25 y 25>,',
  ' "awayAdjPct": <número entre -25 y 25>,',
  ' "note": "<resumen en español, máx 140 caracteres, citando las bajas clave>",',
  ' "confidence": "<alta|media|baja>"}',
  "",
  "homeAdjPct y awayAdjPct son el cambio PORCENTUAL en los goles esperados de",
  "cada equipo debido a SUS bajas (negativo = juega peor por las ausencias).",
].join("\n");

const ZERO = { used: false, homeAdjPct: 0, awayAdjPct: 0, note: "", confidence: "" };

/** Extrae el primer objeto JSON de un texto (tolera fences de markdown). */
function parseJsonObject(text) {
  if (!text) return null;
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

const clampPct = x => Math.max(-MAX_ADJ, Math.min(MAX_ADJ, Number(x) || 0));

/**
 *  Devuelve { used, homeAdjPct, awayAdjPct, note, confidence }.
 *  `used:false` significa que se usa solo el modelo matemático.
 */
async function adjustForInjuries({ home, away, kickoffISO }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) return { ...ZERO };

  const client = new Anthropic({ apiKey });
  const userMsg =
    `Partido del Mundial 2026: ${home} (local) vs ${away} (visitante). ` +
    `Inicio (UTC): ${kickoffISO || "desconocido"}. ` +
    `Busca las bajas por lesión o sanción de ambas selecciones para este ` +
    `partido y responde solo con el JSON indicado.`;

  let messages = [{ role: "user", content: userMsg }];
  let resp, guard = 0;
  do {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },      // adaptativo: piensa lo justo entre búsquedas
      output_config: { effort: "low" },     // tarea acotada -> barato y consistente
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      system: SYSTEM,
      messages,
    });
    // El bucle de herramientas del servidor puede pausar; lo reanudamos.
    if (resp.stop_reason === "pause_turn") {
      messages = [
        { role: "user", content: userMsg },
        { role: "assistant", content: resp.content },
      ];
    }
  } while (resp.stop_reason === "pause_turn" && ++guard < 4);

  if (resp.stop_reason === "refusal") return { ...ZERO };

  const text = resp.content
    .filter(b => b.type === "text").map(b => b.text).join("\n");
  const parsed = parseJsonObject(text);
  if (!parsed) return { ...ZERO };

  return {
    used: true,
    homeAdjPct: clampPct(parsed.homeAdjPct),
    awayAdjPct: clampPct(parsed.awayAdjPct),
    note: String(parsed.note || "").slice(0, 140),
    confidence: String(parsed.confidence || ""),
  };
}

module.exports = { adjustForInjuries, MAX_ADJ, MODEL };
