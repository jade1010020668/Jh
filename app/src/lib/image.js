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

// Retrato demo determinístico: mismo seed => misma figura.
// No es una persona: es un marcador que REFLEJA las elecciones (género, piel,
// cabello, complexión) para que la vista previa en vivo se sienta real aunque
// todavía no haya llave de generación de imágenes.
function demoPortrait(seed = 0, prompt = '') {
  const p = String(prompt).toLowerCase();
  const isMale = /\bman\b/.test(p);

  // Tono de piel según la etnia del prompt.
  const skin =
    /dark skin/.test(p) ? '#5c3826' :
    /brown skin/.test(p) ? '#8a5a3b' :
    /fair skin/.test(p) ? '#e8c4a8' :
    /olive/.test(p) ? '#c99b6e' :
    /east asian/.test(p) ? '#e3bf9a' : '#c98d63';

  // Color de cabello.
  const hair =
    /blonde/.test(p) ? '#d9ab52' :
    /red|auburn/.test(p) ? '#8f3b21' :
    /salt and pepper/.test(p) ? '#9a9a9a' :
    /pastel|dyed/.test(p) ? `hsl(${seed % 360},70%,62%)` :
    /brown|wavy brown/.test(p) ? '#5a3620' : '#221a16';

  // Complexión → ancho de hombros.
  const w =
    /voluptuous|plus size|big and tall|broad muscular/.test(p) ? 230 :
    /petite|slim|lean/.test(p) ? 168 : 200;

  const bg = seed % 360;
  const beard = /beard/.test(p);
  const longHair = /long|shoulder-length|braided/.test(p);

  // Silueta del cabello: distinta por género y largo.
  const hairShape = longHair
    ? `<path d="M136 300 q0 -150 120 -150 q120 0 120 150 l0 190 q-30 -120 -50 -150 q-70 40 -140 0 q-20 30 -50 150 z" fill="${hair}"/>`
    : isMale
      ? `<path d="M142 296 q0 -142 114 -142 q114 0 114 142 q-30 -74 -114 -74 q-84 0 -114 74 z" fill="${hair}"/>`
      : `<path d="M136 300 q0 -150 120 -150 q120 0 120 150 q-34 -86 -120 -86 q-86 0 -120 86 z" fill="${hair}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${bg},42%,32%)"/>
    <stop offset="1" stop-color="hsl(${(bg + 45) % 360},48%,20%)"/>
  </linearGradient></defs>
  <rect width="512" height="768" fill="url(#g)"/>
  <rect x="${256 - w / 2}" y="470" width="${w}" height="300" rx="${w / 2.4}" fill="${skin}"/>
  <ellipse cx="256" cy="316" rx="118" ry="${isMale ? 140 : 134}" fill="${skin}"/>
  ${beard ? `<path d="M150 330 q6 128 106 140 q100 -12 106 -140 q-40 96 -106 96 q-66 0 -106 -96 z" fill="${hair}" opacity=".92"/>` : ''}
  ${hairShape}
  <ellipse cx="212" cy="318" rx="13" ry="9" fill="#2a2018" opacity=".85"/>
  <ellipse cx="300" cy="318" rx="13" ry="9" fill="#2a2018" opacity=".85"/>
  <path d="M228 386 q28 20 56 0" stroke="#2a2018" stroke-width="6" fill="none" opacity=".6" stroke-linecap="round"/>
  <text x="256" y="726" font-family="sans-serif" font-size="19" fill="#fff" text-anchor="middle" opacity="0.9">vista previa · ${isMale ? 'él' : 'ella'}</text>
  <text x="256" y="750" font-family="sans-serif" font-size="12" fill="#fff" text-anchor="middle" opacity="0.55">conecta NOVITA_API_KEY para fotos reales</text>
</svg>`;
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  return { image: dataUri, kind: 'dataUri', provider: 'DEMO' };
}
