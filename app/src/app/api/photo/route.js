import { NextResponse } from 'next/server';
import { generateImage } from '../../../lib/image';
import { buildImageRequest } from '../../../lib/appearance';
import { checkSafety, BLOCKED_RESPONSE } from '../../../lib/safety';
import { DEFAULT_CHARACTER } from '../../../lib/persona';
import { currentUser } from '../../../lib/auth';
import { logEvent } from '../../../lib/db';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const user = await currentUser(req);
    if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });

    const { character, scene, providerId } = await req.json();
    const char = character || DEFAULT_CHARACTER;

    // 1) Seguridad del PROMPT de la escena (líneas rojas, docs/07 §3.1).
    const check = checkSafety(scene || '');
    if (!check.ok) {
      await logEvent(user.id, 'safety_block', { reason: check.reason, kind: 'photo' });
      return NextResponse.json({ error: BLOCKED_RESPONSE, blocked: check.reason }, { status: 200 });
    }

    // 2) Construir prompt de identidad (semilla fija = misma persona) + escena.
    const request = buildImageRequest(char, scene);

    // 3) Generar.
    const result = await generateImage({ ...request, providerId });
    await logEvent(user.id, 'photo', { characterId: char.id });

    // NOTA de producción: aquí va OBLIGATORIO un clasificador de imagen
    // (edad aparente >=21, CSAM hash+predictivo) antes de devolverla —
    // docs/03 §5. En el MVP forzamos seguridad a nivel de prompt (arriba)
    // + piso de edad en identityPrompt + negative prompt anti-menores.

    return NextResponse.json({
      image: result.image,
      kind: result.kind,
      provider: result.provider,
      latencyMs: result.latencyMs,
      seed: request.seed,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
