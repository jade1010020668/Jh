// Cliente de voz (TTS) — mismo patrón intercambiable que ai.js e image.js.
//  - ElevenLabs si hay ELEVENLABS_API_KEY (prototipo; en producción el core NSFW
//    va con TTS self-hosted Chatterbox/Qwen3-TTS — docs/02 §2).
//  - Sin llave -> modo 'browser': el cliente habla el texto con la voz del
//    dispositivo (SpeechSynthesis) en español. Cuesta $0 y funciona ya.
//
// Cada personaje tiene una voz consistente según su acento y personalidad.

const ELEVEN_VOICES = {
  // voice_id de ejemplo de ElevenLabs (reemplazar por voces propias por acento).
  colombiana: process.env.VOICE_COLOMBIANA || 'EXAVITQu4vr4xnSDxMaL',
  mexicana: process.env.VOICE_MEXICANA || 'EXAVITQu4vr4xnSDxMaL',
  argentina: process.env.VOICE_ARGENTINA || 'EXAVITQu4vr4xnSDxMaL',
  espanola: process.env.VOICE_ESPANOLA || 'EXAVITQu4vr4xnSDxMaL',
  neutra: process.env.VOICE_NEUTRA || 'EXAVITQu4vr4xnSDxMaL',
};

// Parámetros de voz del navegador por género y personalidad (modo demo).
// El tono base cambia con el género; la personalidad lo matiza.
export function browserVoiceParams(character = {}) {
  const p = character.personality || 'dulce';
  const isMale = character.gender === 'hombre';
  const base = isMale ? 0.72 : 1.15; // tono base: grave vs agudo
  const map = {
    dulce: { rate: 0.98, shift: 0 },
    juguetona: { rate: 1.06, shift: 0.05 },
    intensa: { rate: 1.0, shift: -0.06 },
    timida: { rate: 0.92, shift: 0.03 },
    protectora: { rate: 0.95, shift: -0.04 },
    divertida: { rate: 1.08, shift: 0.06 },
  };
  const m = map[p] || map.dulce;
  return {
    lang: 'es-ES',
    rate: m.rate,
    pitch: Math.max(0.4, Math.min(1.6, base + m.shift)),
    gender: isMale ? 'male' : 'female',
  };
}

export function ttsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/**
 * Genera voz. Devuelve:
 *  - { mode: 'audio', audio: dataUri }  (ElevenLabs)
 *  - { mode: 'browser', text, params }  (el cliente habla con SpeechSynthesis)
 */
export async function synthesize({ text, character }) {
  if (!ttsConfigured()) {
    return { mode: 'browser', text, params: browserVoiceParams(character) };
  }
  // Voz por género (y acento). Configurables por variable de entorno.
  const isMale = character?.gender === 'hombre';
  const voiceId = isMale
    ? (process.env.VOICE_HOMBRE || ELEVEN_VOICES[character?.accent] || ELEVEN_VOICES.neutra)
    : (ELEVEN_VOICES[character?.accent] || ELEVEN_VOICES.neutra);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3 },
      }),
    });
    if (!res.ok) throw new Error(`elevenlabs ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { mode: 'audio', audio: 'data:audio/mpeg;base64,' + buf.toString('base64') };
  } catch (err) {
    // Falla -> no rompas la experiencia: cae al modo navegador.
    return { mode: 'browser', text, params: browserVoiceParams(character), note: String(err.message).slice(0, 80) };
  }
}
