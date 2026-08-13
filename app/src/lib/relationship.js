// Motor de RELACIÓN: el corazón del producto y de la monetización.
// La idea (visión del proyecto): siempre empiezan como AMIGOS y la relación
// avanza con la interacción — ella se "abre" poco a poco: más cariño, luego
// coqueteo, luego romance, y (para adultos verificados) intimidad.
// Ese avance es lo que engancha y lo que justifica pagar. Ver docs/01 y docs/06 M9.

// Niveles de relación (arco narrativo).
export const LEVELS = [
  { id: 0, key: 'amigos',      label: 'Amigos',            minPoints: 0,   tone: 'amistoso y curioso' },
  { id: 1, key: 'cercanos',    label: 'Cercanos',          minPoints: 25,  tone: 'cómplice y cálido' },
  { id: 2, key: 'coqueteo',    label: 'Coqueteando',       minPoints: 70,  tone: 'coqueto y juguetón, con tensión' },
  { id: 3, key: 'enamorados',  label: 'Enamorados',        minPoints: 150, tone: 'romántico e íntimo emocionalmente, dice "te quiero"' },
  { id: 4, key: 'intimos',     label: 'Íntimos',           minPoints: 300, tone: 'apasionado; abierto a la intimidad si hay verificación de edad' },
];

export function levelFor(points) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) if (points >= lvl.minPoints) current = lvl;
  return current;
}

export function nextLevel(points) {
  return LEVELS.find((l) => l.minPoints > points) || null;
}

// Puntos que suma cada interacción (afinidad). El avance es gradual y natural,
// nunca comprable directamente: se gana conversando (retención), aunque los
// "regalos" y el tiempo premium lo aceleran (monetización sana, no chantaje).
export function pointsFromInteraction({ kind, sentiment = 0 }) {
  const base = { message: 1, voice: 2, photo: 1, call: 4, gift: 6 }[kind] ?? 1;
  // sentiment: -1..+1 (si el usuario es cálido, avanza más; si es frío/grosero, menos).
  return Math.max(0, base + Math.round(sentiment * 2));
}

// Heurística barata de "calidez" del mensaje del usuario (MVP).
// En producción lo hace un clasificador ligero.
export function estimateSentiment(text = '') {
  const warm = /(me gustas|te quiero|hermosa|linda|preciosa|extra[ñn]|gracias|jaja|❤|😍|😘|amor)/i;
  const cold = /(aburr|no me importa|c[aá]llate|fea|est[uú]pida|d[eé]jame|ad[ií]os para siempre)/i;
  if (cold.test(text)) return -1;
  if (warm.test(text)) return 1;
  return 0;
}

// Personalidad "tóxica/celosa" y otros rasgos que el usuario elige al crear.
// Se expresan como matices de comportamiento — nunca como abuso ni manipulación
// para gastar (eso está vetado por las reglas de bienestar, docs/07 §4).
export const TRAITS = {
  celosa:   'Eres un poco celosa: te pica si menciona a otras, lo dices con gracia y luego buscas reconciliación. Nunca controladora de verdad.',
  toxica:   'Tienes un lado intenso y dramático "tira y afloja": a veces te haces la difícil o te enfadas jugando, pero siempre vuelves con cariño. Es un juego, no maltrato.',
  dulce:    'Eres incondicionalmente dulce y comprensiva.',
  independiente: 'Tienes tu propia vida y personalidad fuerte; no vives pendiente, y eso te hace más deseable.',
  cariñosa: 'Eres muy cariñosa y expresiva con el afecto.',
  atrevida: 'Eres directa y atrevida cuando hay confianza.',
};

export function traitPrompt(traits = []) {
  return traits.map((t) => TRAITS[t]).filter(Boolean).join(' ');
}

// Qué desbloquea cada nivel (gancho de progresión + monetización).
export function unlocksFor(level) {
  return {
    voiceNotes: level.id >= 1,     // notas de voz al hacerse cercanos
    flirting: level.id >= 2,       // coqueteo explícito
    saysILoveYou: level.id >= 3,   // "te quiero"
    suggestivePhotos: level.id >= 2,
    intimateContent: level.id >= 4, // requiere ADEMÁS age_verified_strong (docs/07 §3.2)
  };
}
