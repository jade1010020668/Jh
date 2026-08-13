// Fábrica de apariencia: convierte las elecciones del cuestionario en un prompt
// visual estable + una semilla fija por personaje. Esto da CONSISTENCIA:
// misma cara, mismo cuerpo en cada foto. Ver docs/06 M3 y docs/02 §3.
//
// Soporta compañeras y compañeros: cada opción se resuelve según el género.
//
// NOTA de producción: la consistencia REAL de nivel Candy.ai se logra entrenando
// un LoRA por personaje (docs/02 §3). Aquí, sin GPU de entrenamiento, la
// aproximamos con: semilla fija + prompt de apariencia detallado e inmutable.

export const GENDERS = {
  mujer: { noun: 'woman', label: 'Mujer' },
  hombre: { noun: 'man', label: 'Hombre' },
};

const ETHNICITY = {
  latina: 'warm tan skin, latin features',
  morena: 'brown skin, hispanic features',
  blanca: 'fair skin, european features',
  afro: 'dark skin, afro-latin features',
  asiatica: 'east asian features',
  arabe: 'middle eastern features, olive skin',
  mestiza: 'mixed features, golden skin',
};

const HAIR = {
  mujer: {
    negro_largo: 'long straight black hair',
    castano_ondulado: 'wavy brown hair, medium length',
    rubio: 'long blonde hair',
    rojo: 'auburn red hair',
    corto: 'short stylish dark hair',
    rizado: 'voluminous curly hair',
    trenzas: 'long braided hair',
    colorido: 'dyed pastel colored hair',
  },
  hombre: {
    corto_oscuro: 'short dark hair, neat fade',
    ondulado: 'wavy medium-length brown hair',
    largo: 'shoulder-length hair, tied back',
    rapado: 'buzz cut',
    rizado: 'short curly hair',
    barba: 'short dark hair with well-groomed beard',
    barba_larga: 'dark hair with full beard',
    canoso: 'salt and pepper hair, distinguished',
  },
};

const BODY = {
  mujer: {
    esbelta: 'slim figure',
    curvas: 'curvy hourglass figure',
    atletica: 'athletic toned body',
    voluptuosa: 'voluptuous figure',
    menuda: 'petite figure',
    plus: 'plus size, confident curves',
  },
  hombre: {
    atletico: 'athletic muscular build',
    delgado: 'slim lean build',
    fornido: 'broad muscular build, strong shoulders',
    normal: 'average build',
    fitness: 'very fit, defined muscles',
    grande: 'big and tall build',
  },
};

const STYLE = {
  mujer: {
    casual: 'casual outfit, jeans and fitted top',
    elegante: 'elegant dress',
    deportiva: 'sporty athleisure outfit',
    coqueta: 'flirty summer dress',
    oficina: 'business attire, blazer',
    urbana: 'streetwear, oversized jacket',
    playa: 'beachwear, sun dress',
  },
  hombre: {
    casual: 'casual outfit, t-shirt and jeans',
    elegante: 'tailored suit',
    deportivo: 'athletic wear, gym outfit',
    urbano: 'streetwear, hoodie and sneakers',
    oficina: 'business shirt, rolled sleeves',
    motero: 'leather jacket, rugged style',
    playa: 'open shirt, beach style',
  },
};

// Semilla determinística a partir del id del personaje (misma cara siempre).
export function seedFor(characterId) {
  let h = 0;
  const s = String(characterId || 'default');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

function genderOf(appearance = {}, character = {}) {
  const g = appearance.gender || character.gender || 'mujer';
  return GENDERS[g] ? g : 'mujer';
}

// Prompt base de identidad: SIEMPRE presente, define quién es visualmente.
// El "21+ adult" es un piso duro de seguridad (docs/07 §3.1): nunca menores.
export function identityPrompt(appearance = {}) {
  const g = genderOf(appearance);
  const noun = GENDERS[g].noun;
  const parts = [
    'RAW photo, professional portrait photography',
    `attractive 25 year old adult ${noun}`, // piso de edad, inamovible
    ETHNICITY[appearance.ethnicity] || ETHNICITY.latina,
    HAIR[g][appearance.hair] || Object.values(HAIR[g])[0],
    BODY[g][appearance.body] || Object.values(BODY[g])[0],
    'detailed face, natural skin texture, symmetric eyes',
    '85mm lens, soft natural lighting, high detail, photorealistic, 8k',
  ];
  return parts.join(', ');
}

// Prompt de escena: lo que el usuario pide para ESTA foto (filtrado aparte).
export function scenePrompt(appearance = {}, sceneRequest = '') {
  const g = genderOf(appearance);
  const outfit = STYLE[g][appearance.style] || Object.values(STYLE[g])[0];
  const scene = sceneRequest?.trim() || 'smiling at the camera in a cozy room';
  return `${outfit}, ${scene}`;
}

// Negative prompt: refuerza calidad Y seguridad (bloquea apariencia de menor).
export const NEGATIVE_PROMPT =
  'child, teen, minor, underage, young girl, young boy, loli, shota, deformed, bad anatomy, ' +
  'extra limbs, disfigured, low quality, blurry, watermark, text, cartoon, 3d render';

export function buildImageRequest(character, sceneRequest) {
  const appearance = { ...(character.appearance || {}), gender: genderOf(character.appearance, character) };
  return {
    prompt: `${identityPrompt(appearance)}, ${scenePrompt(appearance, sceneRequest)}`,
    negativePrompt: NEGATIVE_PROMPT,
    seed: seedFor(character.id || character.name),
    gender: appearance.gender,
  };
}

// Opciones que la interfaz muestra, ya filtradas por género.
export function optionsFor(gender = 'mujer') {
  const g = GENDERS[gender] ? gender : 'mujer';
  return {
    ethnicity: Object.keys(ETHNICITY),
    hair: Object.keys(HAIR[g]),
    body: Object.keys(BODY[g]),
    style: Object.keys(STYLE[g]),
  };
}

export const APPEARANCE_OPTIONS = optionsFor('mujer');
