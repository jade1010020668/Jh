import { NextResponse } from 'next/server';
import { generateImage } from '../../../lib/image';
import { identityPrompt, scenePrompt, NEGATIVE_PROMPT, seedFor } from '../../../lib/appearance';
import { checkSafety, BLOCKED_RESPONSE } from '../../../lib/safety';
import { currentUser } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vista previa EN VIVO mientras se crea el personaje: se ve la cara cambiar
// al elegir opciones (docs/06 M3). Siempre retrato SFW — el creador no es el
// lugar del contenido íntimo, y así la previsualización es barata y rápida.
export async function POST(req) {
  try {
    const user = await currentUser(req);
    if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });

    const { appearance, name } = await req.json();

    // El nombre alimenta la semilla, así que pasa por el filtro de líneas rojas.
    const check = checkSafety(name || '');
    if (!check.ok) return NextResponse.json({ error: BLOCKED_RESPONSE, blocked: check.reason });

    // Semilla estable por combinación: la misma elección devuelve la misma cara,
    // y cambiar una opción la actualiza de forma predecible.
    const key = [
      name || 'preview',
      appearance?.gender, appearance?.ethnicity,
      appearance?.hair, appearance?.body, appearance?.style,
    ].join('|');

    const result = await generateImage({
      prompt: `${identityPrompt(appearance)}, ${scenePrompt(appearance, 'head and shoulders portrait, neutral background, natural smile')}`,
      negativePrompt: NEGATIVE_PROMPT,
      seed: seedFor(key),
    });

    return NextResponse.json({
      image: result.image,
      kind: result.kind,
      provider: result.provider,
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
