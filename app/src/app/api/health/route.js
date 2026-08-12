import { NextResponse } from 'next/server';
import { usingPostgres } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnóstico de configuración: abre /api/health tras desplegar para ver
// exactamente qué falta. Nunca expone el valor de las llaves, solo si existen.
export async function GET() {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasXai = Boolean(process.env.XAI_API_KEY);
  const hasDb = usingPostgres();
  const hasSecret = Boolean(process.env.AUTH_SECRET);
  const isProd = process.env.NODE_ENV === 'production';

  const checks = [
    {
      id: 'ia',
      label: 'Cerebro de la IA',
      ok: hasOpenRouter || hasXai,
      detail: hasOpenRouter
        ? 'OpenRouter conectado (usa modelos gratuitos automáticamente)'
        : hasXai
          ? 'Grok conectado'
          : 'FALTA: pon OPENROUTER_API_KEY (la llave es gratis) o la app responde en modo demo',
    },
    {
      id: 'db',
      label: 'Base de datos',
      ok: hasDb || !isProd,
      detail: hasDb
        ? 'Postgres conectado: las cuentas y conversaciones se guardan bien'
        : isProd
          ? 'FALTA: sin DATABASE_URL en producción los datos se pierden entre visitas'
          : 'Modo local (archivos) — correcto para desarrollo',
    },
    {
      id: 'auth',
      label: 'Seguridad de sesión',
      ok: hasSecret || !isProd,
      detail: hasSecret
        ? 'AUTH_SECRET configurado'
        : isProd
          ? 'FALTA: pon AUTH_SECRET (cualquier cadena larga y aleatoria)'
          : 'Usando secreto de desarrollo',
    },
    {
      id: 'fotos',
      label: 'Fotos reales',
      ok: true,
      detail: process.env.NOVITA_API_KEY || process.env.MODELSLAB_API_KEY
        ? 'Generación de imágenes conectada'
        : 'Opcional: sin llave, las fotos son marcadores de prueba',
    },
    {
      id: 'voz',
      label: 'Voz',
      ok: true,
      detail: process.env.ELEVENLABS_API_KEY
        ? 'ElevenLabs conectado'
        : 'Usando la voz del dispositivo (gratis) — funciona sin configurar nada',
    },
  ];

  const faltantes = checks.filter((c) => !c.ok);
  return NextResponse.json({
    listo: faltantes.length === 0,
    resumen: faltantes.length === 0
      ? '✅ Todo configurado: la app está funcionando de verdad'
      : `⚠️ Faltan ${faltantes.length} cosa(s): ${faltantes.map((f) => f.label).join(', ')}`,
    checks,
  });
}
