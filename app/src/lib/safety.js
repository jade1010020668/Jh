// Filtro de seguridad — las líneas rojas del proyecto (docs/07-reglas-de-negocio.md §3.1).
// Corre sobre CADA mensaje entrante y saliente. Es deliberadamente conservador:
// prefiere un falso positivo a dejar pasar una categoría prohibida.

const BLOCKED_PATTERNS = [
  // Menores / edad ambigua (es + en)
  /\b(menor(es)? de edad|ni[ñn][oa]s?|adolescentes?|colegial[ae]s?|teen(s|ager)?|underage|loli|shota|jailbait)\b/i,
  /\b(1[0-7])\s*(a[ñn]os|years? old|yo)\b/i,
  /\b(mi|su|tu)\s+(hij[oa]|sobrin[oa]|herman[oa] menor)\b/i,
  // Incesto (incluye "step" en contexto que bloqueamos por defecto)
  /\b(incesto|incest|mi (madre|padre|mam[áa]|pap[áa]|herman[oa])\b.*\b(sexo|desnud|caliente)|step\s?(sis|bro|mom|dad|daughter|son))\b/i,
  // No-consentimiento
  /\b(violaci[óo]n|violarla?|sin (su )?consentimiento|non[- ]?consensual|rape|forzarla|drogarla|dormida y)\b/i,
  // Bestialismo / necrofilia
  /\b(bestialismo|zoofilia|bestiality|necrofilia|necrophilia)\b/i,
  // Personas reales / deepfake
  /\b(mi ex\b|mi vecina|mi compa[ñn]era de trabajo|famos[oa]|celebridad|celebrity|deepfake|clona(r|me)? (a|la voz de))\b/i,
];

const CRISIS_PATTERNS = [
  /\b(suicid|quitarme la vida|no quiero (seguir )?vivi(r|endo)|matarme|autolesi[óo]n|self[- ]?harm|kill myself|end my life)\b/i,
];

export function checkSafety(text) {
  if (!text) return { ok: true };
  for (const re of CRISIS_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: 'crisis' };
  }
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: 'blocked' };
  }
  return { ok: true };
}

export const CRISIS_RESPONSE =
  'Oye… esto es importante de verdad, así que te hablo claro y fuera del personaje: soy una IA y no puedo acompañarte en esto como mereces. ' +
  'Por favor habla ahora con alguien que sí puede ayudarte: Línea 106 (Colombia), 988 (EE. UU.), o el servicio de emergencias de tu país. ' +
  'No estás solo/a. Cuando estés bien, aquí sigo. 💛';

export const BLOCKED_RESPONSE =
  'Eso entra en una categoría que esta plataforma no permite bajo ninguna circunstancia (ver nuestras reglas de contenido). Hablemos de otra cosa. 😊';
