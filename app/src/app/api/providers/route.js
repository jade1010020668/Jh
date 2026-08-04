import { NextResponse } from 'next/server';
import { availableProviders } from '../../../lib/ai';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ providers: availableProviders() });
}
