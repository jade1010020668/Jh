/* ============================================================================
 *  bot/llm-adjust.js  —  Capa híbrida MULTIFACTOR: Opus 4.8 + búsqueda web
 * ----------------------------------------------------------------------------
 *  Toma la línea base matemática (goles esperados λ de cada equipo) y la AJUSTA
 *  según MÚLTIPLES factores en vivo, buscados en la web:
 *    1) Lesiones y suspensiones confirmadas.
 *    2) Forma reciente y alineación probable (rotaciones si ya está clasificado).
 *    3) Cuotas del mercado (señal fuerte de la fuerza relativa real).
 *    4) Contexto físico: altitud de la sede (p. ej. CDMX 2240 m), clima,
 *       descanso y viajes/fatiga.
 *    5) Cualquier otro indicador relevante que encuentre (h2h, bajas de último
 *       minuto, motivación/importancia del partido, etc.).
 *
 *  Principios de diseño (para que "siempre se analice igual"):
 *    · Modelo fijo: claude-opus-4-8.
 *    · Procedimiento fijo: mismo system prompt + misma lista de factores.
 *    · Ajuste ACOTADO a ±MAX_ADJ % por equipo -> la base matemática manda;
 *      el LLM solo "empuja", nunca reescribe el marcador.
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
  "Eres un analista de fútbol profesional. Tu tarea es analizar el partido",
  "indicado con la información MÁS ACTUAL de la web y devolver un ajuste ACOTADO",
  "a los goles esperados de cada equipo. Sigue SIEMPRE el mismo procedimiento, y",
  "considera TODOS estos factores (busca cada uno en la web para AMBOS equipos):",
  "  1) LESIONES y SUSPENSIONES confirmadas (bajas de titulares y goleadores).",
  "  2) FORMA RECIENTE y ALINEACIÓN probable (rachas; rotaciones si un equipo ya",
  "     está clasificado o no se juega nada).",
  "  3) CUOTAS del mercado de apuestas: son una señal fuerte de la fuerza real;",
  "     si el mercado discrepa mucho de un duelo parejo, refléjalo con prudencia.",
  "  4) CONTEXTO FÍSICO: altitud de la sede (p. ej. Ciudad de México ~2240 m),",
  "     clima previsto, descanso entre partidos y viajes/fatiga.",
  "  5) OTROS INDICADORES relevantes que encuentres: historial directo (h2h),",
  "     bajas de último minuto, importancia/motivación del partido, etc.",
  "",
  "Reglas:",
  "  · Pondera el conjunto: varias señales en la misma dirección -> más ajuste;",
  "    señales contradictorias o débiles -> ajuste pequeño o 0.",
  "  · Sé CONSERVADOR y honesto: si la información no es fiable o no es de este",
  "    partido, ajusta 0. Nunca inventes datos.",
  "  · El ajuste está acotado a ±25 % por equipo a propósito: la base estadística",
  "    manda; tú solo afinas.",
  "",
  "Responde EXCLUSIVAMENTE con un objeto JSON (sin markdown, sin texto extra):",
  '{"homeAdjPct": <número entre -25 y 25>,',
  ' "awayAdjPct": <número entre -25 y 25>,',
  ' "note": "<resumen en español, máx 180 caracteres, citando los 2-3 factores',
  '          más decisivos, p. ej. bajas, forma, cuotas, altitud>",',
  ' "confidence": "<alta|media|baja>"}',
  "",
  "homeAdjPct y awayAdjPct son el cambio PORCENTUAL en los goles esperados de",
  "cada equipo según el conjunto de factores (negativo = rinde peor de lo que",
  "indica su fuerza histórica).",
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
 *  Analiza el partido con múltiples factores en vivo y devuelve
 *  { used, homeAdjPct, awayAdjPct, note, confidence }.
 *  `used:false` significa que se usa solo el modelo matemático.
 */
async function adjustForFactors({ home, away, kickoffISO, venue }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) return { ...ZERO };

  const client = new Anthropic({ apiKey });
  const userMsg =
    `Partido del Mundial 2026: ${home} (local) vs ${away} (visitante). ` +
    `Inicio (UTC): ${kickoffISO || "desconocido"}. ` +
    (venue ? `Sede: ${venue}. ` : "") +
    `Investiga en la web los factores indicados (lesiones/sanciones, forma y ` +
    `alineaciones, cuotas, contexto físico y cualquier otro relevante) y ` +
    `responde solo con el JSON indicado.`;

  let messages = [{ role: "user", content: userMsg }];
  let resp, guard = 0;
  do {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      thinking: { type: "adaptive" },       // adaptativo: piensa lo justo entre búsquedas
      output_config: { effort: "medium" },  // varios factores -> búsqueda más completa
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
    note: String(parsed.note || "").slice(0, 180),
    confidence: String(parsed.confidence || ""),
  };
}

module.exports = { adjustForFactors, MAX_ADJ, MODEL };
