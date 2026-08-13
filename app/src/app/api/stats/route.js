import { NextResponse } from 'next/server';
import { funnelStats } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Panel de validación: el embudo en números.
// signup -> message -> relationship_levelup -> paywall_shown -> upgrade_clicked
export async function GET() {
  const stats = await funnelStats();
  const signups = stats.signup || 0;
  const upgradeClicks = stats.upgrade_clicked || 0;
  return NextResponse.json({
    raw: stats,
    funnel: {
      usuarios: stats.users || 0,
      registros: signups,
      mensajes: stats.message || 0,
      subidas_de_nivel: stats.relationship_levelup || 0,
      paywalls_mostrados: stats.paywall_shown || 0,
      clicks_en_pagar: upgradeClicks,
      intencion_de_pago_pct: signups ? Math.round((upgradeClicks / signups) * 100) : 0,
    },
  });
}
