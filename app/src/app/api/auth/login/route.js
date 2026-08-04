import { NextResponse } from 'next/server';
import { login, sessionCookie } from '../../../../lib/auth';
import { logEvent } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const user = await login(email, password);
    await logEvent(user.id, 'login', {});
    const res = NextResponse.json({ user });
    const c = sessionCookie(user.id);
    res.cookies.set(c.name, c.value, c.options);
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 401 });
  }
}
