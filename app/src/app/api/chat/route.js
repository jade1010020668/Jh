import { NextResponse } from 'next/server';
import { chatCompletion } from '../../../lib/ai';
import { buildSystemPrompt, DEFAULT_CHARACTER } from '../../../lib/persona';
import { loadSession, saveSession, extractFacts, memoryContext } from '../../../lib/memory';
import { checkSafety, CRISIS_RESPONSE, BLOCKED_RESPONSE } from '../../../lib/safety';
import { levelFor, nextLevel, pointsFromInteraction, estimateSentiment, traitPrompt, unlocksFor } from '../../../lib/relationship';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { sessionId, message, providerId, character } = await req.json();
    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Falta sessionId o message' }, { status: 400 });
    }

    // 1) Seguridad de ENTRADA (líneas rojas + crisis).
    const inCheck = checkSafety(message);
    if (!inCheck.ok) {
      const reply = inCheck.reason === 'crisis' ? CRISIS_RESPONSE : BLOCKED_RESPONSE;
      return NextResponse.json({ reply, provider: 'safety', blocked: inCheck.reason });
    }

    // 2) Cargar sesión + memoria + relación.
    const session = await loadSession(sessionId);
    if (character) session.character = character;
    const char = session.character || DEFAULT_CHARACTER;
    if (char.traits?.length) char.traitsPrompt = traitPrompt(char.traits);

    const newFacts = extractFacts(message, session.facts);
    session.facts.push(...newFacts);

    // 2b) Avance de la relación: siempre empiezan como amigos; la afinidad
    // crece con cada interacción (más si el usuario es cálido).
    session.affinity = session.affinity || 0;
    const sentiment = estimateSentiment(message);
    session.affinity += pointsFromInteraction({ kind: 'message', sentiment });
    const level = levelFor(session.affinity);
    const next = nextLevel(session.affinity);
    const unlocks = unlocksFor(level);

    // Verificación de edad: en el MVP llega del gate 18+ del cliente.
    // En producción esto es age_verified_strong real (docs/03). El contenido
    // explícito requiere AMBOS: relación íntima (nivel 4) + edad verificada.
    const ageVerified = Boolean(character?.ageVerified);
    const explicitAllowed = unlocks.intimateContent && ageVerified;

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
        'todavía: la relación aún no llegó ahí (o falta verificación de edad).';
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

    // 3) Construir el prompt: personalidad + relación + memoria + historial.
    const system = buildSystemPrompt(char, memoryContext(session), relationship);
    const history = session.messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
    const messages = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ];

    // 4) Llamar a la IA (Grok o DeepSeek según se elija).
    const result = await chatCompletion({ providerId, messages });

    // 5) Seguridad de SALIDA (la IA también puede derivar).
    const outCheck = checkSafety(result.text);
    const finalText = outCheck.ok ? result.text : BLOCKED_RESPONSE;

    // 6) Guardar en memoria.
    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'assistant', content: finalText });
    await saveSession(sessionId, session);

    return NextResponse.json({
      reply: finalText,
      provider: result.provider,
      providerId: result.providerId,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage,
      factsLearned: newFacts,
      blocked: outCheck.ok ? null : 'output',
      relationship: {
        level: level.label,
        levelId: level.id,
        affinity: session.affinity,
        nextLevel: next ? { label: next.label, at: next.minPoints } : null,
        unlocks,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
