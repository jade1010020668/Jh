import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { setAgeVerified, logEvent } from '../../../../lib/db';

export const runtime = 'nodejs';

// MVP: marca la edad como verificada (declarativo 18+).
// En producción esto lo hace un proveedor real (Yoti/Incode) — docs/03 §2.
export async function POST(req) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  await setAgeVerified(user.id, true);
  await logEvent(user.id, 'age_verified', {});
  return NextResponse.json({ ok: true });
}
