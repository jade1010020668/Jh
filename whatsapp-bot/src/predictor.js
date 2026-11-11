// Arma el pronóstico de un partido con el MISMO motor que la app web (pronosticos/engine.js y data.js),
// y redacta el mensaje de WhatsApp. La IA es opcional y solo aporta contexto con fuente comprobable.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Engine = require('../../pronosticos/engine.js');
const Data = require('../../pronosticos/data.js');
const { LEAGUES } = require('../../pronosticos/leagues.js');

const TZ = process.env.TIMEZONE || 'America/Bogota';
const TZ_LABEL = TZ === 'America/Bogota' ? 'hora de Colombia' : `hora de ${TZ}`;
export { Data, Engine, LEAGUES, TZ };

const pct = (x) => Math.round(x * 100) + '%';
// Con datos pobres no se finge precisión: se redondea al 5%, igual que en la app
const pct5 = (x) => { const v = Math.round(x * 20) * 5; return v < 5 ? 'menos de 5%' : v > 95 ? 'más de 95%' : '≈' + v + '%'; };

// Contexto con IA (opcional). Devuelve { items, notes } y nunca lanza: si falla, el pronóstico sigue sin contexto.
async function aiContext({ apiKey, model }, cfg, event, input, fc) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const longDate = { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const userPrompt = Data.contextUserPrompt({
      cfg, event, input, fc,
      todayText: new Date().toLocaleDateString('es-CO', longDate),
      kickoffText: new Date(event.date).toLocaleString('es-CO', { ...longDate, hour: '2-digit', minute: '2-digit' }) + ` (${TZ_LABEL})`
    });
    // La variante básica de la búsqueda devuelve cada resultado con su URL: así se comprueba la fuente.
    const tool = { type: 'web_search_20250305', name: 'web_search', max_uses: 6 };
    if (cfg.country === 'CO') tool.user_location = { type: 'approximate', city: 'Bogotá', region: 'Bogotá', country: 'CO', timezone: TZ };
    let messages = [{ role: 'user', content: userPrompt }];
    const blocks = [];
    let stop = null;
    for (let i = 0; i < 6; i++) {
      const msg = await client.messages.stream({ model, max_tokens: 16000, system: Data.CONTEXT_SYSTEM, tools: [tool], messages }).finalMessage();
      blocks.push(...msg.content);
      stop = msg.stop_reason;
      if (stop !== 'pause_turn') break;
      messages = [{ role: 'user', content: userPrompt }, { role: 'assistant', content: blocks.slice() }];
    }
    if (stop !== 'end_turn') return { items: [], notes: [`Contexto con IA incompleto (${stop}): no se usó.`] };
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const seen = [];
    for (const b of blocks) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r && typeof r.url === 'string') seen.push({ url: r.url, age: r.page_age || null });
    const items = Data.verifyContext(Data.extractContext(text).contexto, seen);
    return { items, notes: [] };
  } catch (e) {
    // El detalle técnico queda en el registro del bot; al WhatsApp va una frase corta
    console.error('IA:', e && e.message);
    const st = e && e.status;
    return { items: [], notes: [st === 401 || st === 403 ? 'No se consultó la IA: la clave de Anthropic no es válida.' : st === 429 || st === 529 ? 'No se consultó la IA: el servicio está saturado.' : /credit balance/i.test(String(e && e.message)) ? 'No se consultó la IA: la cuenta de Anthropic no tiene saldo.' : 'No se pudo consultar la IA esta vez.'] };
  }
}

// Pronóstico completo de un partido. ai = { apiKey, model } o null.
// opts.strict: si la fuente no entregó todos los datos (fallo pasajero), lanza un error en vez de devolver un pronóstico a medias.
export async function buildForecast(slug, event, ai, opts) {
  const cfg = LEAGUES[slug];
  if (!cfg) throw new Error(`Liga desconocida: ${slug}`);
  const parts = await Data.loadMatch(slug, cfg, event);
  let input = Data.buildInput(parts);
  const incomplete = !parts.summary || (cfg.kind === 'liga' && !!cfg.group && !input.model);
  if (incomplete && opts && opts.strict) throw new Error('la fuente de datos no devolvió todo lo del partido; se reintenta en la próxima revisión');
  let fc = Engine.forecast(input);
  let context = [], notes = [];
  if (ai && ai.apiKey && fc.final) {
    const r = await aiContext(ai, cfg, event, input, fc);
    context = r.items; notes = r.notes;
    const used = context.filter((c) => c.used);
    if (used.length) { input = Data.buildInput({ ...parts, context: used }); fc = Engine.forecast(input); }
  }
  return { cfg, event, fc, context, notes, incomplete };
}

// Busca un partido por el nombre de un equipo, sin importar tildes ni mayúsculas.
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function findFixture(fixtures, query) {
  const q = norm(query);
  const names = (x) => [x.home.name, x.away.name].map((n) => ` ${norm(n)} `);
  // primero la palabra completa ("nacional" no debe encontrar a "Internacional"), luego cualquier coincidencia
  return fixtures.find((x) => !q || names(x).some((n) => n.includes(` ${q} `))) || fixtures.find((x) => names(x).some((n) => n.includes(q))) || null;
}

// Mensaje de WhatsApp (texto plano con *negritas*). Función pura: se prueba sin red.
export function formatMessage({ cfg, event, fc, context, notes }) {
  const when = new Date(event.date).toLocaleString('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const L = [`⚽ *${event.home.name} vs ${event.away.name}*`, `${cfg.name} · ${when}`, ''];
  if (!fc.final) {
    L.push('No hay datos suficientes para pronosticar este partido.');
    return L.join('\n');
  }
  const top = fc.topScores[0];
  const P = fc.quality.level === 'Pobre' ? pct5 : pct;
  L.push(`📊 ${event.home.name} ${P(fc.final.home)} · Empate ${P(fc.final.draw)} · ${event.away.name} ${P(fc.final.away)}`);
  L.push(`🥅 Más de 2,5 goles: ${P(fc.final.over25)} · Ambos anotan: ${P(fc.btts)}`);
  L.push(`🎯 Marcador más probable: ${top.home}-${top.away} (1 de cada ${Math.max(2, Math.round(1 / top.p))})`);
  const parts = [];
  if (fc.market.x) parts.push(`mercado ${fc.market.x.map(pct).join('/')}`);
  if (fc.model.ok) parts.push(`modelo ${fc.model.probs.map(pct).join('/')}`);
  if (parts.length) L.push(`🔎 ${parts.join(' · ')}`);
  // Las razones que hablan de las cuotas escritas por el usuario no aplican al bot
  const why = fc.quality.reasons.find((r) => !/usted|sus casas|sus cuotas/i.test(r)) || (fc.quality.level === 'Parcial' ? 'solo hay una casa de referencia; compare las cuotas de su casa en la app' : '');
  L.push(`📎 Calidad de los datos: ${fc.quality.level}` + (why ? ` — ${why}` : '') + ' (indica qué tan respaldado está el número, no qué tan probable es acertar)');
  const used = (context || []).filter((c) => c.used);
  if (used.length) {
    L.push('', '📰 Novedades confirmadas:');
    for (const c of used) {
      const who = c.team === 'home' ? event.home.name : c.team === 'away' ? event.away.name : 'Partido';
      L.push(`• ${who}: ${c.type === 'baja' ? 'baja de ' + (c.player || 'un jugador') : c.type === 'rotacion' ? 'rotación de titulares' : 'sin público'}`);
    }
  }
  for (const n of (notes || [])) L.push(`(${n})`);
  L.push('', '⚠️ Estimación estadística, no una garantía: 60% significa que falla 4 de cada 10 veces. Para saber si una cuota vale la pena, compárela en la app.');
  return L.join('\n');
}
