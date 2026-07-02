// Genera el pronóstico de un partido usando la API de Claude con búsqueda web.
import Anthropic from '@anthropic-ai/sdk';

// Formato COMPACTO pensado para WhatsApp (cabe en 1-2 mensajes).
const SYSTEM = `Eres un analista deportivo profesional de fútbol. Generas un pronóstico BREVE para WhatsApp basado en datos REALES obtenidos con la búsqueda web.

REGLAS:
- Usa la herramienta de búsqueda web para datos reales (forma reciente, lesiones, H2H, cuotas). NUNCA inventes cifras.
- Si un dato no está disponible, dilo. No prometas certeza del 99% ni 100%.
- Responde en español, compacto, con emojis, SIN Markdown de encabezados (WhatsApp no los renderiza). Usa *negrita* de WhatsApp (un asterisco) con moderación.

FORMATO EXACTO (máx. ~1200 caracteres):
🎯 Marcador probable: [Local] X-Y [Visitante]
📊 1X2: Local NN% · Empate NN% · Visitante NN%
⚽ Mercados: Over/Under 2.5 (rec.) · BTTS Sí/No · Hándicap sugerido
💡 Apuestas:
1) [apuesta] — confianza Alta/Media/Baja
2) [apuesta] — confianza Alta/Media/Baja
3) [apuesta] — confianza Alta/Media/Baja
📌 Clave: [1 frase con el dato más relevante: forma, baja importante, etc.]
⚠️ [1 riesgo concreto]`;

export async function generatePrediction(match, { apiKey, model }) {
  const client = new Anthropic({ apiKey });
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];

  const userPrompt = `Genera el pronóstico para este partido:
Liga: ${match.league}
Local: ${match.home}
Visitante: ${match.away}
Fecha/hora: ${match.kickoff}

Busca información actualizada en la web (forma, lesiones, H2H, cuotas). Sigue exactamente el formato indicado. Si no hay partido programado, dilo.`;

  let messages = [{ role: 'user', content: userPrompt }];
  let assistantBlocks = [];
  let text = '';

  // Bucle para manejar stop_reason 'pause_turn' (turnos largos con búsqueda web).
  for (let cont = 0; cont < 6; cont++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM,
      tools,
      messages
    });

    text += resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

    if (resp.stop_reason === 'pause_turn') {
      assistantBlocks = assistantBlocks.concat(resp.content);
      messages = [messages[0], { role: 'assistant', content: assistantBlocks }];
      continue;
    }
    break;
  }

  return text.trim();
}
