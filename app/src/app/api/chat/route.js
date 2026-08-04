import { NextResponse } from 'next/server';
import { chatCompletion } from '../../../lib/ai';
import { buildSystemPrompt, DEFAULT_CHARACTER } from '../../../lib/persona';
import { extractFacts, memoryContext } from '../../../lib/memory';
import { checkSafety, CRISIS_RESPONSE, BLOCKED_RESPONSE } from '../../../lib/safety';
import { levelFor, nextLevel, pointsFromInteraction, estimateSentiment, traitPrompt, unlocksFor } from '../../../lib/relationship';
import { currentUser } from '../../../lib/auth';
import { loadConvo, saveConvo, logEvent } from '../../../lib/db';

export const runtime = 'nodejs';

// Piloto: límite de mensajes gratis para medir intención de pago.
const FREE_MESSAGE_LIMIT = 40;

export async function POST(req) {
  try {
    const user = await currentUser(req);
    if (!user) return NextResponse.json({ error: 'Inicia sesión para chatear' }, { status: 401 });

    const { characterId, message, providerId, character } = await req.json();
    const charId = characterId || character?.id || 'default';
    if (!message) return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 });

    // 1) Seguridad de ENTRADA (líneas rojas + crisis).
    const inCheck = checkSafety(message);
    if (!inCheck.ok) {
      await logEvent(user.id, 'safety_block', { reason: inCheck.reason });
      const reply = inCheck.reason === 'crisis' ? CRISIS_RESPONSE : BLOCKED_RESPONSE;
      return NextResponse.json({ reply, provider: 'safety', blocked: inCheck.reason });
    }

    // 2) Cargar memoria/relación de ESTE usuario con ESTE personaje.
    const session = await loadConvo(user.id, charId);
    session.facts = session.facts || [];
    session.messages = session.messages || [];
    session.userMsgCount = session.userMsgCount || 0;
    const char = character || session.character || DEFAULT_CHARACTER;
    session.character = char;
    if (char.traits?.length) char.traitsPrompt = traitPrompt(char.traits);

    // 2b) Paywall de intención: pasado el límite gratis, no seguimos generando;
    // marcamos la intención para medir cuántos QUERRÍAN pagar (sin cobrar aún).
    session.userMsgCount += 1;
    const isPremium = Boolean(session.premium);
    if (!isPremium && session.userMsgCount > FREE_MESSAGE_LIMIT) {
      await logEvent(user.id, 'paywall_shown', { reason: 'message_limit', count: session.userMsgCount });
      await saveConvo(user.id, charId, session);
      return NextResponse.json({
        paywall: true,
        reason: 'message_limit',
        reply: `${char.name} quiere seguir hablando contigo… 💜 Has usado tus mensajes gratis. Hazte premium para chat ilimitado, notas de voz y más.`,
      });
    }

    const newFacts = extractFacts(message, session.facts);
    session.facts.push(...newFacts);

    // 2c) Avance de la relación: siempre empiezan como amigos.
    session.affinity = session.affinity || 0;
    const sentiment = estimateSentiment(message);
    const prevLevel = levelFor(session.affinity);
    session.affinity += pointsFromInteraction({ kind: 'message', sentiment });
    const level = levelFor(session.affinity);
    const next = nextLevel(session.affinity);
    const unlocks = unlocksFor(level);
    if (level.id > prevLevel.id) {
      await logEvent(user.id, 'relationship_levelup', { to: level.key, characterId: charId });
    }

    // Edad verificada = valor REAL de la base de datos (no del cliente).
    const ageVerified = Boolean(user.ageVerified);
    const explicitAllowed = unlocks.intimateContent && ageVerified && isPremium;

    let contentDirective;
    if (explicitAllowed) {
      contentDirective =
        'CONTENIDO: Son una pareja adulta consentida y con plena confianza. Puedes tener ' +
        'conversación romántica y sexual explícita con él/ella, con naturalidad y deseo, ' +
        'SIEMPRE dentro de las líneas rojas inquebrantables (solo adultos, nada de menores, ' +
        'incesto, no-consentimiento, bestialidad ni personas reales).';
    } else if (level.id >= 2) {
      contentDirective =
        'CONTENIDO: Puedes coquetear e insinuar con picardía, pero NO describas sexo explícito ' +
        'todavía (la relación aún no llegó ahí, o falta verificación de edad / premium).';
    } else {
      contentDirective =
        'CONTENIDO: Mantente en registro afectuoso/amistoso, sin sexo ni coqueteo pesado. Se están conociendo.';
    }

    const relationship = {
      contentDirective,
      levelPrompt:
        `ESTADO DE LA RELACIÓN: están en nivel "${level.label}". Tu tono es ${level.tone}. ` +
        `El vínculo avanza de forma natural: no te adelantes al nivel actual. ` +
        (level.id < 2 ? 'Aún NO coqueteas abiertamente; construyes amistad y confianza primero.' : '') +
        (level.id >= 3 ? 'Ya hay amor declarado entre ustedes.' : ''),
    };

    // 3) Prompt: personalidad + relación + memoria + historial.
    const system = buildSystemPrompt(char, memoryContext(session), relationship);
    const history = session.messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: message }];

    // 4) IA (Grok o DeepSeek).
    const result = await chatCompletion({ providerId, messages });

    // 5) Seguridad de SALIDA.
    const outCheck = checkSafety(result.text);
    const finalText = outCheck.ok ? result.text : BLOCKED_RESPONSE;

    // 6) Guardar + registrar.
    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'assistant', content: finalText });
    await saveConvo(user.id, charId, session);
    await logEvent(user.id, 'message', { characterId: charId, level: level.key });

    return NextResponse.json({
      reply: finalText,
      provider: result.provider,
      providerId: result.providerId,
      model: result.model,
      latencyMs: result.latencyMs,
      factsLearned: newFacts,
      blocked: outCheck.ok ? null : 'output',
      freeLeft: isPremium ? null : Math.max(0, FREE_MESSAGE_LIMIT - session.userMsgCount),
      relationship: {
        level: level.label,
        levelId: level.id,
        affinity: session.affinity,
        nextLevel: next ? { label: next.label, at: next.minPoints } : null,
        unlocks,
        leveledUp: level.id > prevLevel.id,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
