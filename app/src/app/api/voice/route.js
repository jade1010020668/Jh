import { NextResponse } from 'next/server';
import { synthesize } from '../../../lib/tts';
import { checkSafety } from '../../../lib/safety';
import { currentUser } from '../../../lib/auth';
import { logEvent } from '../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const user = await currentUser(req);
    if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });

    const { text, character } = await req.json();
    if (!text) return NextResponse.json({ error: 'Falta el texto' }, { status: 400 });

    // Seguridad: el texto ya salió del chat filtrado, pero re-chequeamos.
    const check = checkSafety(text);
    if (!check.ok) return NextResponse.json({ error: 'bloqueado' }, { status: 200 });

    const result = await synthesize({ text, character });
    await logEvent(user.id, 'voice', { mode: result.mode, characterId: character?.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
