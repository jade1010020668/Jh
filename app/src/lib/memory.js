// Memoria v1: archivo JSON por sesión (MVP). En producción: Postgres + pgvector
// con extracción de hechos y resúmenes progresivos (docs/06 M9).
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.AMARA_DATA_DIR || path.join(process.cwd(), '.data');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(sessionId) {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, `session-${safe}.json`);
}

export async function loadSession(sessionId) {
  await ensureDir();
  try {
    const raw = await fs.readFile(fileFor(sessionId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { character: null, messages: [], facts: [] };
  }
}

export async function saveSession(sessionId, session) {
  await ensureDir();
  // Solo se conservan los últimos 60 mensajes; el resto vive como "hechos"/resumen.
  const toSave = { ...session, messages: session.messages.slice(-60) };
  await fs.writeFile(fileFor(sessionId), JSON.stringify(toSave, null, 2), 'utf8');
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
  if (!session.facts.length) return '';
  return session.facts.slice(-15).map((f) => `- ${f}`).join('\n');
}
