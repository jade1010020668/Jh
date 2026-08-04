// Capa de datos con dos drivers (mismo patrón que ai.js):
//  - Postgres  -> si DATABASE_URL está definida (producción: Neon/Supabase, Vercel).
//  - Local     -> archivos JSON bajo .data/ (sandbox y desarrollo sin DB).
// La app no cambia: usa esta API sin saber qué driver hay debajo.
//
// Entidades: users, characters, convos (memoria+relación por user+character), events.

import { promises as fs } from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_DIR = process.env.AMARA_DATA_DIR || path.join(process.cwd(), '.data');

let pgPool = null;
let pgReady = null;

// ---------- Selección de driver ----------
export function usingPostgres() {
  return Boolean(DATABASE_URL);
}

async function pg() {
  if (pgPool) return pgPool;
  const { Pool } = await import('pg');
  pgPool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  if (!pgReady) pgReady = initSchema(pgPool);
  await pgReady;
  return pgPool;
}

async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      age_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      config JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS convos (
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, character_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      meta JSONB,
      ts TIMESTAMPTZ DEFAULT now()
    );
  `);
}

// ---------- Driver local (JSON) ----------
async function localRead(name, fallback) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
async function localWrite(name, obj) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(obj, null, 2), 'utf8');
}

// ================= API pública =================

// ---- Users ----
export async function createUser({ id, email, passwordHash }) {
  if (usingPostgres()) {
    const pool = await pg();
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3)', [id, email, passwordHash]);
    return { id, email, ageVerified: false };
  }
  const users = await localRead('users.json', {});
  users[email.toLowerCase()] = { id, email, passwordHash, ageVerified: false, createdAt: Date.now() };
  await localWrite('users.json', users);
  return { id, email, ageVerified: false };
}

export async function findUserByEmail(email) {
  const key = email.toLowerCase();
  if (usingPostgres()) {
    const pool = await pg();
    const { rows } = await pool.query('SELECT id, email, password_hash, age_verified FROM users WHERE email=$1', [key]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash, ageVerified: rows[0].age_verified };
  }
  const users = await localRead('users.json', {});
  return users[key] || null;
}

export async function findUserById(id) {
  if (usingPostgres()) {
    const pool = await pg();
    const { rows } = await pool.query('SELECT id, email, age_verified FROM users WHERE id=$1', [id]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, ageVerified: rows[0].age_verified };
  }
  const users = await localRead('users.json', {});
  return Object.values(users).find((u) => u.id === id) || null;
}

export async function setAgeVerified(id, verified = true) {
  if (usingPostgres()) {
    const pool = await pg();
    await pool.query('UPDATE users SET age_verified=$2 WHERE id=$1', [id, verified]);
    return;
  }
  const users = await localRead('users.json', {});
  for (const k of Object.keys(users)) if (users[k].id === id) users[k].ageVerified = verified;
  await localWrite('users.json', users);
}

// ---- Characters ----
export async function saveCharacter(character) {
  if (usingPostgres()) {
    const pool = await pg();
    await pool.query(
      'INSERT INTO characters (id, user_id, config) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET config=$3',
      [character.id, character.userId, character]
    );
    return character;
  }
  const chars = await localRead('characters.json', {});
  chars[character.id] = character;
  await localWrite('characters.json', chars);
  return character;
}

export async function listCharacters(userId) {
  if (usingPostgres()) {
    const pool = await pg();
    const { rows } = await pool.query('SELECT config FROM characters WHERE user_id=$1 ORDER BY created_at', [userId]);
    return rows.map((r) => r.config);
  }
  const chars = await localRead('characters.json', {});
  return Object.values(chars).filter((c) => c.userId === userId);
}

// ---- Convos (memoria + relación por user+character) ----
export async function loadConvo(userId, characterId) {
  const empty = { messages: [], facts: [], affinity: 0 };
  if (usingPostgres()) {
    const pool = await pg();
    const { rows } = await pool.query('SELECT data FROM convos WHERE user_id=$1 AND character_id=$2', [userId, characterId]);
    return rows[0]?.data || empty;
  }
  return localRead(`convo-${sanitize(userId)}-${sanitize(characterId)}.json`, empty);
}

export async function saveConvo(userId, characterId, data) {
  const toSave = { ...data, messages: (data.messages || []).slice(-60) };
  if (usingPostgres()) {
    const pool = await pg();
    await pool.query(
      'INSERT INTO convos (user_id, character_id, data, updated_at) VALUES ($1,$2,$3,now()) ' +
        'ON CONFLICT (user_id, character_id) DO UPDATE SET data=$3, updated_at=now()',
      [userId, characterId, toSave]
    );
    return;
  }
  await localWrite(`convo-${sanitize(userId)}-${sanitize(characterId)}.json`, toSave);
}

// ---- Events (analítica del embudo — para VALIDAR demanda) ----
export async function logEvent(userId, type, meta = {}) {
  if (usingPostgres()) {
    const pool = await pg();
    await pool.query('INSERT INTO events (user_id, type, meta) VALUES ($1,$2,$3)', [userId, type, meta]);
    return;
  }
  const events = await localRead('events.json', []);
  events.push({ userId, type, meta, ts: Date.now() });
  await localWrite('events.json', events.slice(-5000));
}

export async function funnelStats() {
  let events;
  if (usingPostgres()) {
    const pool = await pg();
    const { rows } = await pool.query('SELECT type, count(*)::int AS n FROM events GROUP BY type');
    events = rows.reduce((a, r) => ((a[r.type] = r.n), a), {});
    const { rows: u } = await pool.query('SELECT count(*)::int AS n FROM users');
    events.users = u[0].n;
    return events;
  }
  const raw = await localRead('events.json', []);
  const counts = raw.reduce((a, e) => ((a[e.type] = (a[e.type] || 0) + 1), a), {});
  const users = await localRead('users.json', {});
  counts.users = Object.keys(users).length;
  return counts;
}

function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '');
}
