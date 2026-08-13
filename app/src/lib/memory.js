// Memoria por usuario+personaje, ahora sobre la capa de datos (db.js).
// Persiste entre sesiones y entre dispositivos (clave para el "ella me recuerda").
import { loadConvo, saveConvo } from './db';

export async function loadSession(userId, characterId) {
  return loadConvo(userId, characterId);
}

export async function saveSession(userId, characterId, session) {
  await saveConvo(userId, characterId, session);
}

// Extracción de hechos ultra-simple para el MVP (regex de patrones comunes).
// En producción esto lo hace un LLM barato en background.
const FACT_PATTERNS = [
  { re: /me llamo ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i, fmt: (m) => `Se llama ${m[1]}.` },
  { re: /soy de ([A-ZÁÉÍÓÚÑa-záéíóúñ ]+?)[\.,!\n]/i, fmt: (m) => `Es de ${m[1].trim()}.` },
  { re: /trabajo (?:en|como) ([a-záéíóúñ ]+?)[\.,!\n]/i, fmt: (m) => `Trabaja en/como ${m[1].trim()}.` },
  { re: /me gusta(?:n)? ([a-záéíóúñ ]+?)[\.,!\n]/i, fmt: (m) => `Le gusta ${m[1].trim()}.` },
  { re: /tengo (\d{2}) a[ñn]os/i, fmt: (m) => `Tiene ${m[1]} años.` },
  { re: /mi (perro|gato|mascota) se llama ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i, fmt: (m) => `Su ${m[1]} se llama ${m[2]}.` },
];

export function extractFacts(userText, existingFacts) {
  const found = [];
  for (const { re, fmt } of FACT_PATTERNS) {
    const m = userText.match(re);
    if (m) {
      const fact = fmt(m);
      if (!existingFacts.includes(fact)) found.push(fact);
    }
  }
  return found;
}

export function memoryContext(session) {
  if (!session.facts?.length) return '';
  return session.facts.slice(-15).map((f) => `- ${f}`).join('\n');
}
