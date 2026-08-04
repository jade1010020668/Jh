import { NextResponse } from 'next/server';
import { chatCompletion } from '../../../lib/ai';
import { buildSystemPrompt, DEFAULT_CHARACTER } from '../../../lib/persona';
import { loadSession, saveSession, extractFacts, memoryContext } from '../../../lib/memory';
import { checkSafety, CRISIS_RESPONSE, BLOCKED_RESPONSE } from '../../../lib/safety';

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

    // 2) Cargar sesión + memoria.
    const session = await loadSession(sessionId);
    if (character) session.character = character;
    const char = session.character || DEFAULT_CHARACTER;

    const newFacts = extractFacts(message, session.facts);
    session.facts.push(...newFacts);

    // 3) Construir el prompt: personalidad + memoria + historial reciente.
    const system = buildSystemPrompt(char, memoryContext(session));
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
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
