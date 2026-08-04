// Cliente de IA unificado: ata Grok (xAI), DeepSeek y OpenRouter tras una sola interfaz.
// Todos exponen una API compatible con el formato de OpenAI (/chat/completions),
// así que cambiar de motor es cambiar base URL + api key + nombre de modelo.
// Ver docs/02-stack-tecnologico-ia.md §1.

const PROVIDERS = {
  // Grok — el único gran proveedor comercial tolerante con ficción adulta.
  grok: {
    label: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    model: process.env.XAI_MODEL || 'grok-4',
  },
  // DeepSeek vía OpenRouter — el caballo de batalla: casi tan potente como Grok,
  // ~10x más barato, pesos MIT para self-hosting futuro.
  // (La API oficial de DeepSeek prohíbe este uso; por eso vamos vía OpenRouter.)
  deepseek: {
    label: 'DeepSeek V3 (OpenRouter)',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
  },
};

export function availableProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    configured: Boolean(process.env[p.apiKeyEnv]),
  }));
}

export function resolveProvider(requested) {
  const id = PROVIDERS[requested] ? requested : 'deepseek';
  const p = PROVIDERS[id];
  return { id, ...p, apiKey: process.env[p.apiKeyEnv] };
}

/**
 * Llama al proveedor elegido. Devuelve { text, provider, model, latencyMs, usage }.
 * Si no hay API key configurada, cae a un modo demo local para que la app
 * arranque y se pueda probar la UI sin gastar dinero.
 */
export async function chatCompletion({ providerId, messages, temperature = 0.9, maxTokens = 400 }) {
  const p = resolveProvider(providerId);
  const started = Date.now();

  if (!p.apiKey) {
    return demoCompletion({ provider: p, messages, started });
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${p.apiKey}`,
  };
  if (p.baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://amara.app';
    headers['X-Title'] = 'Amara';
  }

  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${p.label} respondió ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return {
    text,
    provider: p.label,
    providerId: p.id,
    model: p.model,
    latencyMs: Date.now() - started,
    usage: data.usage || null,
  };
}

// Modo demo (sin API key): responde algo con personalidad para poder ver la UI.
function demoCompletion({ provider, messages, started }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const q = (lastUser?.content || '').toLowerCase();
  let text;
  if (q.includes('hola') || messages.length <= 2) {
    text = '¡Hey! 😊 Me alegra que aparecieras… te estaba esperando. ¿Cómo estuvo tu día? (modo demo: configura una API key para hablar con la IA real)';
  } else if (q.includes('foto')) {
    text = 'Uy, ¿una foto? 🙈 Eso te lo mando cuando conectes la generación de imágenes… por ahora solo tienes mis palabras. (demo)';
  } else {
    text = 'Me encanta que me cuentes eso… cuéntame más, en serio. (Esto es una respuesta de demostración — pon XAI_API_KEY u OPENROUTER_API_KEY para activar la IA real.)';
  }
  return {
    text,
    provider: `${provider.label} · DEMO`,
    providerId: provider.id,
    model: 'demo',
    latencyMs: Date.now() - started,
    usage: null,
  };
}
