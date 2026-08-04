// Cliente de imagen unificado — mismo patrón que ai.js: proveedores intercambiables.
// Los proveedores aquí SÍ toleran contenido adulto legal (docs/02 §3):
// Novita.ai y ModelsLab. Midjourney/DALL-E/Ideogram lo prohíben (no van aquí).
//
// Sin API key -> modo DEMO: genera un retrato placeholder (SVG) determinístico
// por semilla, para que el flujo "pídele una foto" se vea en la UI sin gastar.

const PROVIDERS = {
  novita: {
    label: 'Novita.ai',
    apiKeyEnv: 'NOVITA_API_KEY',
    endpoint: 'https://api.novita.ai/v3/async/txt2img',
    model: process.env.NOVITA_MODEL || 'cyberrealistic_v40.safetensors',
  },
  modelslab: {
    label: 'ModelsLab',
    apiKeyEnv: 'MODELSLAB_API_KEY',
    endpoint: 'https://modelslab.com/api/v6/realtime/text2img',
    model: process.env.MODELSLAB_MODEL || 'realistic-vision-v6',
  },
};

export function availableImageProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    configured: Boolean(process.env[p.apiKeyEnv]),
  }));
}

function firstConfigured() {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (process.env[p.apiKeyEnv]) return id;
  }
  return null;
}

/**
 * Genera una imagen. Devuelve { image, kind, provider, latencyMs }.
 *  - kind: 'url' (http) | 'dataUri' (demo svg)
 * Si no hay proveedor configurado, cae a demo.
 */
export async function generateImage({ prompt, negativePrompt, seed, providerId }) {
  const started = Date.now();
  const id = PROVIDERS[providerId] ? providerId : firstConfigured();
  if (!id) {
    return { ...demoPortrait(seed, prompt), latencyMs: Date.now() - started };
  }
  const p = PROVIDERS[id];

  try {
    if (id === 'novita') {
      const out = await callNovita(p, { prompt, negativePrompt, seed });
      return { ...out, provider: p.label, latencyMs: Date.now() - started };
    }
    if (id === 'modelslab') {
      const out = await callModelsLab(p, { prompt, negativePrompt, seed });
      return { ...out, provider: p.label, latencyMs: Date.now() - started };
    }
  } catch (err) {
    // Falla del proveedor -> no rompas el chat: entrega placeholder + nota.
    return {
      ...demoPortrait(seed, prompt),
      provider: `${p.label} (falló: ${String(err.message).slice(0, 80)})`,
      latencyMs: Date.now() - started,
    };
  }
}

async function callNovita(p, { prompt, negativePrompt, seed }) {
  // Novita usa un flujo async (submit -> poll). Simplificado para el MVP.
  const submit = await fetch(p.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NOVITA_API_KEY}` },
    body: JSON.stringify({
      request: {
        model_name: p.model,
        prompt,
        negative_prompt: negativePrompt,
        width: 512,
        height: 768,
        sampler_name: 'DPM++ 2M Karras',
        steps: 25,
        guidance_scale: 6,
        seed,
        image_num: 1,
      },
    }),
  });
  if (!submit.ok) throw new Error(`novita submit ${submit.status}`);
  const { task_id } = await submit.json();
  // Poll (máx ~30s)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${task_id}`, {
      headers: { Authorization: `Bearer ${process.env.NOVITA_API_KEY}` },
    });
    const data = await res.json();
    if (data.task?.status === 'TASK_STATUS_SUCCEED' && data.images?.[0]?.image_url) {
      return { image: data.images[0].image_url, kind: 'url' };
    }
    if (data.task?.status === 'TASK_STATUS_FAILED') throw new Error('novita task failed');
  }
  throw new Error('novita timeout');
}

async function callModelsLab(p, { prompt, negativePrompt, seed }) {
  const res = await fetch(p.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: process.env.MODELSLAB_API_KEY,
      model_id: p.model,
      prompt,
      negative_prompt: negativePrompt,
      width: 512,
      height: 768,
      samples: 1,
      num_inference_steps: 25,
      seed,
    }),
  });
  if (!res.ok) throw new Error(`modelslab ${res.status}`);
  const data = await res.json();
  const url = data.output?.[0] || data.proxy_links?.[0];
  if (!url) throw new Error('modelslab sin imagen');
  return { image: url, kind: 'url' };
}

// Retrato demo determinístico: mismo seed => mismo "rostro" (mismo color).
// No es una persona; es un marcador para ver el flujo en la UI.
function demoPortrait(seed = 0, prompt = '') {
  const hue = seed % 360;
  const hue2 = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},60%,55%)"/>
    <stop offset="1" stop-color="hsl(${hue2},70%,40%)"/>
  </linearGradient></defs>
  <rect width="512" height="768" fill="url(#g)"/>
  <circle cx="256" cy="300" r="120" fill="hsla(${hue},40%,90%,0.9)"/>
  <rect x="156" y="430" width="200" height="260" rx="100" fill="hsla(${hue},40%,90%,0.9)"/>
  <text x="256" y="720" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle" opacity="0.85">foto demo</text>
  <text x="256" y="748" font-family="sans-serif" font-size="13" fill="#fff" text-anchor="middle" opacity="0.6">configura NOVITA_API_KEY</text>
</svg>`;
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  return { image: dataUri, kind: 'dataUri', provider: 'DEMO' };
}
