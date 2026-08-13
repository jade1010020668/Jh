import { NextResponse } from 'next/server';
import { currentUser, clearCookie } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(req) {
  const user = await currentUser(req);
  return NextResponse.json({ user: user ? { id: user.id, email: user.email, ageVerified: user.ageVerified } : null });
}

// Logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const c = clearCookie();
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
