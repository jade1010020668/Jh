/* ============================================================================
 *  bot/lib/schedule.js  —  Lógica de selección de partidos (PURA y testeable)
 * ----------------------------------------------------------------------------
 *  Separada de predict.js para poder testear sin tocar la red ni el reloj real:
 *  todas las funciones reciben `nowMs` explícito y no leen variables de entorno.
 * ==========================================================================*/

"use strict";

/** Identificador estable de un partido (para deduplicar avisos enviados). */
function fixtureId(fx) {
  return `${fx.home}|${fx.away}|${fx.kickoff}`;
}

/** Próximo partido con hora futura (el "siguiente" del calendario). */
function nextUpcoming(fixtures, nowMs) {
  return fixtures
    .filter(f => f.kickoff && !isNaN(new Date(f.kickoff).getTime())
                 && new Date(f.kickoff).getTime() > nowMs)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0] || null;
}

/**
 *  Partidos que DEBEN avisarse ahora: dentro de la ventana de disparo
 *  [lead − window/2, lead + window/2] minutos antes del inicio, con hora
 *  válida y que no se hayan avisado ya (sentSet).
 *  Devuelve [{ fx, id, mins }] ordenado por cercanía al inicio.
 */
function pickDueFixtures(fixtures, sentSet, nowMs, leadMin, windowMin) {
  const lo = leadMin - windowMin / 2;
  const hi = leadMin + windowMin / 2;
  const due = [];
  for (const fx of fixtures) {
    if (!fx.kickoff) continue;                       // sin hora -> se ignora
    const t = new Date(fx.kickoff).getTime();
    if (isNaN(t)) continue;                          // hora no parseable
    const id = fixtureId(fx);
    if (sentSet.has(id)) continue;                   // ya avisado
    const mins = (t - nowMs) / 60000;
    if (mins < lo || mins > hi) continue;            // fuera de ventana
    due.push({ fx, id, mins });
  }
  return due.sort((a, b) => a.mins - b.mins);
}

/** ¿La cadena de fecha trae zona horaria explícita (Z u offset ±hh:mm)? */
function hasTimezone(iso) {
  return typeof iso === "string" && /(Z|[+-]\d{2}:?\d{2})$/.test(iso.trim());
}

module.exports = { fixtureId, nextUpcoming, pickDueFixtures, hasTimezone };
