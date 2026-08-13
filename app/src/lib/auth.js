// Autenticación ligera sin dependencias externas (crypto nativo de Node).
//  - Contraseñas: scrypt con salt por usuario.
//  - Sesión: token firmado con HMAC (tipo JWT simple) en cookie httpOnly.
// Suficiente y seguro para el piloto; en escala se puede migrar a un proveedor.

import crypto from 'crypto';
import { createUser, findUserByEmail, findUserById } from './db';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-cambia-esto-en-produccion';
const COOKIE = 'amara_auth';
const SESSION_DAYS = 30;

// ---- Password ----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// ---- Token de sesión (HMAC) ----
export function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- Registro / Login ----
export async function register(email, password) {
  if (!isEmail(email)) throw new Error('Email inválido');
  if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Ese email ya está registrado');
  const id = 'u_' + crypto.randomBytes(9).toString('hex');
  const user = await createUser({ id, email, passwordHash: hashPassword(password) });
  return user;
}

export async function login(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Email o contraseña incorrectos');
  }
  return { id: user.id, email: user.email, ageVerified: user.ageVerified };
}

// ---- Helpers de cookie ----
export function sessionCookie(userId) {
  const token = signToken({ uid: userId });
  return {
    name: COOKIE,
    value: token,
    options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 },
  };
}

export function clearCookie() {
  return { name: COOKIE, value: '', options: { httpOnly: true, path: '/', maxAge: 0 } };
}

export async function currentUser(req) {
  const cookie = req.cookies.get(COOKIE);
  if (!cookie) return null;
  const data = verifyToken(cookie.value);
  if (!data?.uid) return null;
  return findUserById(data.uid);
}

export const COOKIE_NAME = COOKIE;

function isEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
}
