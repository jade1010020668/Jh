// Fábrica de apariencia: convierte las elecciones del cuestionario en un prompt
// visual estable + una semilla fija por personaje. Esto da CONSISTENCIA:
// misma cara, mismo cuerpo en cada foto. Ver docs/06 M3 y docs/02 §3.
//
// NOTA de producción: la consistencia REAL de nivel Candy.ai se logra entrenando
// un LoRA por personaje (docs/02 §3). Aquí, sin GPU de entrenamiento, la
// aproximamos con: semilla fija + prompt de apariencia detallado e inmutable.
// Es suficiente para el MVP; el LoRA entra en la fase de fábrica real.

const ETHNICITY = {
  latina: 'beautiful latina woman, warm tan skin',
  morena: 'beautiful hispanic woman, brown skin, dark features',
  blanca: 'beautiful european woman, fair skin',
  afro: 'beautiful afro-latina woman, dark skin',
  asiatica: 'beautiful asian woman',
};

const HAIR = {
  negro_largo: 'long straight black hair',
  castano_ondulado: 'wavy brown hair, medium length',
  rubio: 'blonde hair',
  rojo: 'auburn red hair',
  corto: 'short stylish dark hair',
};

const BODY = {
  esbelta: 'slim figure',
  curvas: 'curvy hourglass figure',
  atletica: 'athletic toned body',
  voluptuosa: 'voluptuous figure',
};

const STYLE = {
  casual: 'casual outfit, jeans and top',
  elegante: 'elegant dress',
  deportiva: 'sporty athleisure outfit',
  coqueta: 'flirty summer dress',
};

// Semilla determinística a partir del id del personaje (misma cara siempre).
export function seedFor(characterId) {
  let h = 0;
  const s = String(characterId || 'default');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

// Prompt base de identidad: SIEMPRE presente, define quién es visualmente.
// El "21+ adult woman" es un piso duro de seguridad (docs/07 §3.1): nunca menores.
export function identityPrompt(appearance = {}) {
  const parts = [
    'RAW photo, professional portrait photography',
    '21 year old adult woman', // piso de edad, inamovible
    ETHNICITY[appearance.ethnicity] || ETHNICITY.latina,
    HAIR[appearance.hair] || HAIR.castano_ondulado,
    BODY[appearance.body] || BODY.curvas,
    'detailed face, natural skin texture, symmetric eyes',
    '85mm lens, soft natural lighting, high detail, photorealistic, 8k',
  ];
  return parts.join(', ');
}

// Prompt de escena: lo que el usuario pide para ESTA foto (filtrado aparte).
export function scenePrompt(appearance = {}, sceneRequest = '') {
  const outfit = STYLE[appearance.style] || STYLE.coqueta;
  const scene = sceneRequest?.trim() || 'smiling at the camera in a cozy room';
  return `${outfit}, ${scene}`;
}

// Negative prompt: refuerza calidad Y seguridad (bloquea apariencia de menor).
export const NEGATIVE_PROMPT =
  'child, teen, minor, underage, young girl, loli, deformed, bad anatomy, ' +
  'extra limbs, disfigured, low quality, blurry, watermark, text, cartoon, 3d render';

export function buildImageRequest(character, sceneRequest) {
  const appearance = character.appearance || {};
  return {
    prompt: `${identityPrompt(appearance)}, ${scenePrompt(appearance, sceneRequest)}`,
    negativePrompt: NEGATIVE_PROMPT,
    seed: seedFor(character.id || character.name),
  };
}

export const APPEARANCE_OPTIONS = {
  ethnicity: Object.keys(ETHNICITY),
  hair: Object.keys(HAIR),
  body: Object.keys(BODY),
  style: Object.keys(STYLE),
};
