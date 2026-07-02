# 02 · Stack Tecnológico de IA

> Responde la pregunta central: **¿qué inteligencia artificial hay que pagar o montar para que la compañera converse, tenga voz, genere fotos y haga videollamadas en vivo — sin restricciones de contenido adulto y sin violar licencias?**
> Datos investigados y verificados contra fuentes primarias en julio 2026. Este mercado cambia mes a mes: revalidar antes de firmar.

---

## 0. La conclusión antes del detalle

**No existe "una IA" que haga todo esto.** La compañera es una orquesta de 5 sistemas, y la decisión estratégica más importante del proyecto es esta:

> ⚠️ **Ningún gran proveedor comercial (OpenAI, Anthropic, Google, ElevenLabs, HeyGen, Tavus…) permite contenido sexual explícito en sus términos de servicio a julio de 2026.** El "modo adulto" que OpenAI anunció en octubre 2025 fue **pausado indefinidamente en marzo 2026** (verificado). Construir sobre ellos = que te corten el servicio de un día para otro.
>
> Por lo tanto: **el corazón NSFW del producto se construye con modelos open-source de licencia permisiva (Apache 2.0 / MIT), auto-hospedados en GPUs alquiladas.** Esto además resulta 3-10× más barato por unidad y nadie te puede "desconectar el negocio".

Los 5 sistemas y la recomendación en una línea cada uno:

| Sistema | Recomendación principal | Licencia | Costo aprox. |
|---|---|---|---|
| 🧠 Cerebro (LLM chat/roleplay) | Mistral Small 24B o fine-tune (Cydonia) self-hosted; DeepSeek V3 (MIT) tier premium; Grok API como única API "grande" tolerante | Apache 2.0 / MIT | $0.05–0.40 / M tokens |
| 🗣️ Voz (TTS) | Chatterbox Multilingual (MIT) + Qwen3-TTS (Apache 2.0) — ambos con español | MIT / Apache 2.0 | $0.005–0.03 / min |
| 👂 Oído (STT) | Whisper self-hosted (MIT) o Deepgram Nova-3 ($0.0058/min) | MIT / API |  ~$0.001–0.006 / min |
| 📸 Fotos | SDXL + checkpoints realistas NSFW de Civitai + 1 LoRA por personaje | Verificar por checkpoint | ~$0.001–0.01 / imagen |
| 🎥 Videollamada en vivo | MuseTalk (MIT, 30+ fps) o Ditto (Apache 2.0) sobre loops pre-renderizados con Wan 2.2 (Apache 2.0), transporte LiveKit self-hosted | MIT / Apache 2.0 | $0.03–0.09 / min todo incluido |

Margen resultante: cobrando la videollamada a $0.99–1.99/min con costo total de ~$0.03–0.09/min, el **margen bruto supera el 85%**.

---

## 1. El cerebro: LLM para conversación y roleplay

### 1.1 APIs comerciales — el mapa real (julio 2026, verificado)

| Proveedor | ¿Permite NSFW adulto? | Nota |
|---|---|---|
| OpenAI | ❌ **No** | "Adult mode" anunciado oct-2025, retrasado, y **pausado indefinidamente en marzo 2026** (FT/TechCrunch). No construir sobre esa promesa. |
| Anthropic (Claude) | ❌ No | Sin modo adulto. Sí es usable para partes SFW: clasificadores, resúmenes, tooling interno. |
| Google (Gemini) | ❌ No | Su política prohíbe textualmente "sexual chatbots" y monitorea la API. |
| DeepSeek (API oficial) | ❌ No | Sus ToS prohíben "sexual chatbots" con esas palabras. **PERO los pesos de V3/R1 son MIT** → self-host sí. |
| **xAI (Grok)** | ✅ **Sí, único grande** | Su AUP es una lista de prohibiciones (sexualizar personas reales/NCII, menores) que **no prohíbe la ficción sexual con personajes adultos** — tolerada en la práctica, y xAI vende sus propios companions NSFW ("Ani"). Grok 4.3: ~$1.25/$2.50 por M tokens. Riesgo: reputacional y de cambio de política de un solo proveedor; confirmar la AUP vigente al contratar. |
| Mistral (La Plateforme) | ⚠️ Zona gris tolerante | Su política prohíbe CSAM/no-consensual pero no la erótica adulta; modelos poco censurados. Ventaja: sus modelos abiertos son Apache 2.0 → migras a self-host sin cambiar de modelo. |
| **OpenRouter** (agregador) | ✅ Por-modelo | Aplica los términos del modelo subyacente; sirve modelos sin moderación y tiene colección oficial "Roleplay". Es el proveedor de facto de JanitorAI y compañía. Ideal para el MVP. |
| DeepInfra | ✅ De facto | ToS permisivo; barato para Llama/Qwen/DeepSeek. Confirmar ToS antes de contratar. |
| Featherless.ai / Infermatic | ✅ (planes personales) | Sirven fine-tunes NSFW por tarifa plana ($10–25/mes). ⚠️ Para producción/reventa exigen plan comercial ("Scale") — negociarlo. |
| Together / Fireworks | ❓ No confirmado | AUP ambiguas; Fireworks es enterprise. Leer AUP antes de usar. |
| NovelAI | — | Sin censura pero es producto B2C, no licencia API para plataformas. Solo benchmark de UX. |

### 1.2 Modelos open-weights: qué puedes usar comercialmente

✅ **Limpios para uso comercial NSFW self-hosted:**
- **Mistral Nemo 12B / Mistral Small 3.x 24B** — Apache 2.0 puro, sin política de uso adjunta. **La base recomendada.**
- **Qwen3** (0.6B–235B) — Apache 2.0 (base censurada; requiere fine-tune propio).
- **DeepSeek V3 / R1** — MIT, la opción más libre en gama alta. Motor de facto de las plataformas de roleplay vía OpenRouter.
- Fine-tunes comunitarios sobre bases Apache: **Cydonia 24B**, **Rocinante 12B** (populares en roleplay 2025-26). Verificar el tag de licencia del checkpoint exacto.

⚠️ **Zona gris:** Llama 3.x/4 — su Acceptable Use Policy no prohíbe la erótica adulta pero exige age-gating y Meta podría interpretar en contra. Defendible con verificación de edad robusta; no ideal como única base.

❌ **Trampas de licencia (no usar en producción):**
- **Euryale 70B** — CC-BY-NC (no comercial), aunque medio internet lo use igual.
- **Behemoth 123B** — base Mistral Large bajo licencia research no comercial.
- **Gemma ≤3** — su política prohíbe "sexual chatbots".

### 1.3 Memoria y personalidad (lo que hace que "te ame")

- **Arquitectura estándar**: character card (del cuestionario) + resúmenes progresivos de conversación + extracción de hechos a base vectorial (pgvector/Qdrant) con recuperación por relevancia.
- Frameworks cuando escales: **mem0** (open source, el default 2026) o **Letta** (ex-MemGPT, memoria auto-editable en niveles). Self-hostearlos — los servicios gestionados tienen sus propias ToS de contenido.
- Los mensajes proactivos ("me acordé de ti…") son un cron + generación con el contexto de memoria: baratos y es la función con más retención del sector.

### 1.4 Español

Los fine-tunes NSFW comunitarios están entrenados en inglés y degradan en español. **La jugada diferencial: LoRA propio de roleplay en español LATAM** (dataset de diálogos con modismos, sobre base Mistral/DeepSeek). Es barato (~cientos de dólares de GPU), nadie lo tiene, y es defensa competitiva.

### 1.5 Costos self-hosting (verificado 2026)

- RTX 4090: $0.31–0.69/h (Vast/RunPod) → un 12-24B cuantizado: **$0.05–0.15/M tokens**.
- A100/H100: $1.19–2.69/h → 70B AWQ en 1×80GB: **~$0.18–0.42/M tokens** con vLLM y batching.
- Comparación: GPT-5.1 output cuesta $5/M. El self-host es ~10× más barato **si mantienes las GPUs ocupadas**; para tráfico irregular, serverless (RunPod, facturado por segundo).
- Regla práctica: **MVP con OpenRouter (DeepSeek ~$0.10-0.28/M) + Grok como premium; migrar a self-host al superar ~50-100M tokens/mes.**

---

## 2. La voz

### 2.1 Por qué no ElevenLabs (y compañía) para el NSFW

- **Azure**: prohíbe hasta los chatbots "románticos" (Code of Conduct de Microsoft AI). Descalificado por completo.
- **Google TTS**: prohibido explícito.
- **OpenAI TTS/Realtime**: bloqueado mientras el adult mode siga pausado.
- **ElevenLabs**: zona gris con historial de enforcement; tolera erótica solo en uso personal, no como producto que la distribuye. Riesgo alto de suspensión → solo para prototipos o el modo SFW.
- **Cartesia / Inworld / Rime**: los más probables de acomodar contenido adulto por contrato enterprise — pedir permiso POR ESCRITO antes de depender de ellos. (Dato: plataformas NSFW declaran usar Inworld TTS; $5–10/M caracteres, de los más baratos.)

### 2.2 El stack open-source recomendado (verificado en Hugging Face)

| Modelo | Licencia | Español | Por qué |
|---|---|---|---|
| **Chatterbox Multilingual** (Resemble) | **MIT** | ✅ 23 idiomas | Candidato #1: calidad comparada con ElevenLabs en evaluaciones ciegas, control de intensidad emocional, clonación zero-shot, watermark PerTh integrado (útil para transparencia IA) |
| **Qwen3-TTS** (Alibaba, ene-2026) | **Apache 2.0** | ✅ 10 idiomas | Diseño de voz por instrucción de texto ("mujer de 28, acento paisa, tono juguetón") + clonación + streaming |
| **Orpheus 3B** | Apache 2.0 | ⚠️ preview | Tags `<laugh> <sigh> <gasp> <groan>` — el set más útil para intimidad; mejor en inglés |
| **Maya1** | Apache 2.0 | ❌ solo inglés | 20+ emociones (susurro, jadeo); para la vertiente en inglés |
| Kokoro-82M | Apache 2.0 | parcial | Fallback ultrabarato |

❌ **Trampas**: XTTS/Coqui (licencia no comercial y la empresa cerró — no hay a quién comprarle licencia), Fish Speech/OpenAudio (CC-NC), F5-TTS (pesos CC-NC), Sesame CSM (Apache pero solo inglés).

**Advertencia clave**: ningún modelo open-source viene entrenado con audio íntimo. Risas y susurros salen; **gemidos realistas requieren fine-tuning con dataset propio grabado con actrices de voz bajo contrato de cesión**. Ese checkpoint propio en español LATAM es un activo que nadie puede copiar.

### 2.3 Oído y conversación en tiempo real

- **STT**: Whisper large-v3 self-hosted (MIT, ~$0.02/hora de audio en GPU) o **Deepgram Nova-3** ($0.0058/min, code-switching español/inglés en vivo — ideal LATAM). Los ToS de STT importan menos (transcriben, no generan) pero confirmarlo.
- **Orquestación**: **LiveKit Agents (Apache 2.0)** — recomendado porque la misma infraestructura WebRTC sirve para la videollamada con avatar. Alternativa: Pipecat (BSD).
- **Latencia**: pipeline en cascada todo-streaming (STT ~300ms + LLM TTFT ~200-300ms + TTS TTFA ~90-200ms) ⇒ **600-900 ms voz-a-voz es alcanzable** con disciplina de ingeniería. Los modelos speech-to-speech nativos (GPT-realtime, Gemini Live) están vetados por ToS para NSFW → la cascada es la única arquitectura viable, y además preserva el control del LLM y la memoria.

### 2.4 Costo de voz por minuto

- Stack API: ~$0.03–0.07/min. Stack self-hosted a escala: **~$0.01–0.05/min**.
- Híbrido racional al inicio: Deepgram para STT + TTS open-source self-hosted (la pieza con riesgo ToS) + LLM en OpenRouter.

---

## 3. Las fotos (y la cara del personaje)

- **Base**: SDXL + checkpoints fotorrealistas NSFW de Civitai (Lustify, Big Lust, CyberRealistic XL). ⚠️ Stability cambió su Acceptable Use Policy en 2025 — revisar con abogado el checkpoint elegido.
- **Consistencia de personaje** (misma cara y cuerpo siempre): **entrenar un LoRA por personaje** con 20-50 imágenes sintéticas — minutos y ~$0.50-2 de GPU por personaje; escalable a miles. Es lo que usan las "AI influencers".
- ⚠️ **Trampa legal crítica**: InstantID, PuLID y LivePortrait dependen de modelos de **InsightFace que son solo para investigación no comercial**. Usarlos en una plataforma de pago exige licencia enterprise de InsightFace o sustituirlos (LoRA puro, MediaPipe). Auditar cada dependencia del pipeline.
- ❌ **FLUX.1 [dev]** es licencia no comercial (self-host comercial requiere pagar a Black Forest Labs); **[schnell] sí es Apache 2.0**. **Pony Diffusion** prohíbe inferencia en sitios monetizados sin acuerdo.
- APIs que toleran NSFW si no quieres empezar self-hosted: ModelsLab, Novita.ai, Atlas Cloud. Midjourney/DALL-E/Ideogram: prohibido; SeaArt restringió en sept-2025.
- Costo self-hosted: una 4090 genera una imagen SDXL en 3-6 s → **~$0.001/imagen**. Si se cobra ~$0.40/imagen (precio Candy.ai), margen >95%.
- **Moderación de salida obligatoria**: clasificar TODA imagen antes de mostrarla (edad aparente, CSAM — ver doc 03). El clasificador es parte del pipeline, no un extra.

---

## 4. La videollamada en vivo (el diferenciador)

### 4.1 Los proveedores comerciales están vetados (verificado)

HeyGen (~$0.10-0.20/min), Tavus ($0.32-0.37/min), D-ID, Soul Machines: **prohíben contenido sexual explícito en sus políticas — Tavus lo prohíbe expresamente "aunque sean personas generadas por IA"** (verificado) — y aplican moderación automática. Simli (el más barato, ~$0.05/min) no publica ToS accesibles: asumir prohibición salvo confirmación escrita. Sirven solo como benchmark de costos y para prototipar la experiencia SFW.

### 4.2 La arquitectura self-hosted que sí funciona (2026)

```
Cuestionario → foto base del personaje (SDXL + LoRA)
            → loops de video base offline: idle, gestos, escenas y vestuarios
              (Wan 2.2 I2V — Apache 2.0 — y/o EchoMimic v3 — Apache 2.0)
            → EN VIVO: lip-sync + expresión sobre el loop
              MuseTalk 1.5 (MIT, 30+ fps en V100/4090) o Ditto (Apache 2.0, TensorRT)
            → WebRTC al navegador (LiveKit self-hosted, Apache 2.0)
Audio: micrófono usuario → Whisper/Deepgram → LLM → TTS → alimenta el lip-sync
```

- **LiveTalking** (open source) ya integra este pipeline completo (WebRTC + TTS + MuseTalk, 40+ fps en 4090) — punto de partida, no producto final: su latencia sin optimizar es ~3s; con TTS streaming baja a ~1s.
- Calidad alcanzable 2026: **512p–720p realista de cara/torso con gestos**; cuerpo completo en movimiento libre en tiempo real aún no es estado del arte open-source (por eso los loops pre-renderizados de escenas — incluida la escalada íntima — con lip-sync en vivo encima son EL truco de arquitectura).
- ❌ Licencias trampa en esta capa: **Sonic** (CC-NC), **Wav2Lip** (solo personal), **LivePortrait** (MIT pero con dependencia InsightFace no comercial), **HunyuanVideo** (excluye UE/UK/Corea — mina legal para una plataforma global), **LTX-2** (gratis solo <$10M ARR).

### 4.3 Video-mensajes (clips no en vivo) — el escalón intermedio

Clips de 5-30 s generados bajo demanda con **Wan 2.2 (Apache 2.0 verificado, el modelo con más LoRAs NSFW del ecosistema)** desde la foto del personaje: ~$0.03-0.10/clip self-hosted. Monetizan como "ella te mandó un video" entre la foto y la llamada en vivo.

### 4.4 Costos de la llamada en vivo

- GPU dedicada por sesión: 4090 → **$0.005-0.012/min**; L40S → $0.013-0.026/min. Multiplexando 2-4 streams de 512p por GPU (posible con MuseTalk a 30+ fps): aún menos.
- Costo total por minuto (GPU video + STT + LLM + TTS + WebRTC): **$0.03-0.09/min** → cobrando $0.99-1.99/min, margen bruto >85%. (Precedente: Simli llevó avatares interactivos a <$0.01/min de inferencia — hay techo de optimización.)
- Estrategias: resolución adaptativa (512p móvil / 720p premium), TensorRT, pools calientes por segundo en RunPod/Vast, y modo degradado (foto animada + voz) cuando no haya GPU.
- ⚠️ Verificar el AUP de contenido adulto del propio GPU cloud (RunPod/Vast/etc.) antes de comprometerse — el riesgo de des-plataformado también existe en la capa de infraestructura.

---

## 5. Arquitectura de plataforma (resumen)

```
Frontend: web/PWA (Next.js) — nada de app stores
Realtime: LiveKit self-hosted (WebRTC audio+video)
Backend: API (auth, billing/créditos, personajes, memoria)
   ├─ LLM service: vLLM (Mistral Small/Cydonia AWQ) + OpenRouter fallback
   ├─ Voice service: Whisper/Deepgram (STT) + Chatterbox/Qwen3-TTS (TTS)
   ├─ Image service: SDXL + LoRA por personaje (cola async)
   ├─ Video service: Wan 2.2 (clips, cola) + MuseTalk/Ditto (llamadas, GPU pool)
   └─ Safety service: filtro de prompts + clasificación de toda salida
      (edad aparente, CSAM hash+predictivo, categorías prohibidas) + detección de crisis
Datos: Postgres + pgvector (memoria), objeto storage cifrado (media), retención mínima de chats
GPU: RunPod/Vast por segundo; colas y autoscaling; multi-proveedor desde el día 1
```

**Principio rector**: cada pieza con riesgo de ToS (LLM NSFW, TTS, imagen, video) debe tener **su versión self-hosted en producción o lista como fallback**. Las APIs comerciales se usan solo donde no tocan contenido explícito (STT, moderación, tooling) o mientras el volumen no justifique GPUs propias.

---

*Siguiente: [03-legal-pagos-cumplimiento.md](./03-legal-pagos-cumplimiento.md) — sin esto no hay quien te procese un pago.*
