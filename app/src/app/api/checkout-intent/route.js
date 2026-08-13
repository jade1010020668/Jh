import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { loadConvo, saveConvo, logEvent } from '../../../lib/db';

export const runtime = 'nodejs';

// PAYWALL DE INTENCIÓN (validación sin gastar): no cobra nada.
// Registra que el usuario QUISO pagar — la métrica clave para decidir si vale
// la pena montar el procesador de pagos real (docs/03). Para poder seguir
// probando, concede "premium" en el piloto.
export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { plan, characterId } = await req.json().catch(() => ({}));

  await logEvent(user.id, 'upgrade_clicked', { plan: plan || 'premium' });

  // Piloto: activa premium para el personaje en curso y así seguir la prueba.
  if (characterId) {
    const convo = await loadConvo(user.id, characterId);
    convo.premium = true;
    await saveConvo(user.id, characterId, convo);
  }

  return NextResponse.json({
    ok: true,
    pilot: true,
    message:
      'En el piloto no se cobra: registramos tu interés y te activamos premium para seguir probando. ' +
      'En producción aquí va el checkout con el procesador high-risk (docs/03).',
  });
}
