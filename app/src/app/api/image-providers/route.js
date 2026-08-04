import { NextResponse } from 'next/server';
import { availableImageProviders } from '../../../lib/image';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ providers: availableImageProviders() });
}
