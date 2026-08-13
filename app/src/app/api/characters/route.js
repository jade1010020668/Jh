import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { saveCharacter, listCharacters, logEvent } from '../../../lib/db';
import { checkSafety } from '../../../lib/safety';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const characters = await listCharacters(user.id);
  return NextResponse.json({ characters });
}

export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim().slice(0, 30);
  if (!name) return NextResponse.json({ error: 'Ponle un nombre' }, { status: 400 });

  // Seguridad: nombre + descripción no pueden evocar líneas rojas (docs/07 §3.1).
  const check = checkSafety(`${name} ${body.bio || ''}`);
  if (!check.ok) return NextResponse.json({ error: 'Ese nombre o descripción no está permitido' }, { status: 400 });

  // Edad ficticia: piso duro 21+ (nunca apariencia de menor).
  const age = Math.max(21, Math.min(60, parseInt(body.age, 10) || 25));

  const gender = body.gender === 'hombre' ? 'hombre' : 'mujer';
  const defaults = gender === 'hombre'
    ? { job: 'arquitecto', emoji: '💙', hair: 'corto_oscuro', body: 'atletico', style: 'casual' }
    : { job: 'diseñadora', emoji: '💜', hair: 'castano_ondulado', body: 'curvas', style: 'coqueta' };

  const character = {
    id: 'c_' + crypto.randomBytes(6).toString('hex'),
    userId: user.id,
    custom: true,
    name,
    gender,
    age,
    job: String(body.job || '').slice(0, 40) || defaults.job,
    emoji: body.emoji || defaults.emoji,
    personality: body.personality || 'dulce',
    accent: body.accent || 'neutra',
    relationship: 'conociendose',
    traits: Array.isArray(body.traits) ? body.traits.slice(0, 4) : ['cariñosa'],
    appearance: {
      gender,
      ethnicity: body.appearance?.ethnicity || 'latina',
      hair: body.appearance?.hair || defaults.hair,
      body: body.appearance?.body || defaults.body,
      style: body.appearance?.style || defaults.style,
    },
    bio: String(body.bio || '').slice(0, 200),
  };

  await saveCharacter(character);
  await logEvent(user.id, 'character_created', { characterId: character.id });
  return NextResponse.json({ character });
}
