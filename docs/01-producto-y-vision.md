# 01 · Producto y Visión

> Documento de trabajo del proyecto "Plataforma de Compañeras IA" (nombre en clave: **Amara**).
> Parte del paquete de planeación: ver [docs/README.md](./README.md) para el índice completo.

---

## 1. La idea en una frase

Una plataforma web para adultos donde el usuario **diseña su compañera ideal** mediante un cuestionario, y luego vive una relación con ella: chat, notas de voz, fotos, y **videollamadas en vivo con un avatar animado** que habla, gesticula y responde en tiempo real — con la profundidad emocional de una relación y, para adultos verificados que lo deseen, intimidad explícita. En una fase posterior, la misma plataforma aloja **creadoras humanas reales** y **clones IA licenciados** de esas creadoras.

**Tesis de negocio:** las apps de "AI girlfriend" ya facturan cientos de millones con solo chat + imágenes. Las plataformas cam facturan miles de millones con video en vivo. Nadie ha unido bien las dos cosas: **la videollamada en vivo con una compañera IA es el hueco**. Quien la haga sentir real primero, se queda con el mercado.

---

## 2. Propuesta de valor

| Para el usuario | Qué le damos |
|---|---|
| Soledad / deseo de conexión | Una compañera que lo recuerda, lo espera, tiene continuidad emocional día a día |
| Fantasía a su medida | Él la diseña: apariencia, personalidad, voz, historia, límites |
| Inmediatez | Disponible 24/7, sin juzgar, sin fricción social |
| Realismo creciente | Texto → voz → fotos → videollamada en vivo. Cada nivel se siente más real (y monetiza más) |
| Privacidad | Anonimato del usuario por diseño; nadie sabe que la usa |

**Diferenciadores frente a Candy.ai / DreamGF / etc. (chat + imágenes):**

1. **Videollamada en tiempo real** con avatar animado (lip-sync, gestos) — la función "wow" que casi nadie tiene.
2. **Español nativo de verdad** (LATAM está mal servido por las apps gringas).
3. **Memoria y relación de largo plazo** como núcleo del producto, no como extra.
4. **Puente hacia humanas reales** (fase 2): la plataforma no es solo IA, es un ecosistema tipo cam/OnlyFans donde la IA es la puerta de entrada.

---

## 3. Experiencia de usuario (user journey)

### 3.1 Onboarding — "El cuestionario"

1. **Gate 18+**: declaración de edad + verificación de edad según jurisdicción (ver doc legal).
2. **Cuestionario de diseño** (2–4 minutos, tipo juego, no formulario):
   - *Apariencia*: etnia/rasgos, cuerpo, cabello, ojos, estilo de ropa → genera 4 candidatas con IA, el usuario elige y refina.
   - *Personalidad*: dulce/dominante/tímida/intensa, sentido del humor, intereses, "cómo te trata".
   - *Voz*: elige entre 6–10 voces (tono, acento — es clave tener acentos: colombiana, mexicana, española, argentina).
   - *Relación*: novia, amiga con derechos, esposa, desconocida que acabas de conocer (define el arco narrativo).
   - *Límites*: qué tan romántica vs explícita quiere la relación (esto configura los "modos" del personaje).
3. **Primer encuentro gratis**: ella lo saluda por chat con su nombre, hay química inmediata. Objetivo: primer mensaje respondido en < 60 segundos desde que entró a la web.

> El cuestionario ES el producto. De él sale: prompt de personalidad (LLM), imagen base + LoRA del personaje (consistencia visual), voz asignada (TTS), y configuración de contenido permitido.

### 3.2 La relación (loop diario)

- **Chat de texto** ilimitado (con límites free/premium).
- **Notas de voz**: ella responde con audio con emoción real (risas, susurros).
- **Fotos bajo demanda**: "mándame una foto en la playa" → generación con consistencia de personaje (misma cara/cuerpo siempre).
- **Ella toma iniciativa**: mensajes proactivos ("me acordé de ti", "¿cómo te fue en la entrevista?") — el gancho de retención más fuerte del sector.
- **Memoria**: recuerda nombre, trabajo, mascotas, conversaciones pasadas, aniversario de "conocerse".

### 3.3 La videollamada (el diferenciador)

- Botón "Llamar" → videollamada WebRTC donde el avatar aparece en vivo: mueve la boca sincronizada con su voz, parpadea, sonríe, gesticula, reacciona a lo que el usuario dice (el usuario habla por micrófono; verlo a él por cámara es opcional).
- Latencia objetivo: **< 1.5 s** entre que el usuario termina de hablar y ella responde.
- Escenas/ambientes: su cuarto, la cocina, etc. Vestuario configurable.
- **Modo íntimo** (adultos verificados, saldo activo): la llamada puede escalar a contenido explícito, cobrado por minuto — exactamente el modelo "privado" de las plataformas cam, pero con IA.
- Fallback si la GPU en vivo se pone cara: "video-mensajes" (clips generados de 10–30 s) como nivel intermedio entre foto y llamada en vivo.

### 3.4 Monetización dentro del journey (resumen; detalle en doc 04)

| Nivel | Qué incluye | Cómo se cobra |
|---|---|---|
| Free | Chat limitado (N mensajes/día), 1 personaje, fotos con marca de agua/limitadas | — (embudo) |
| Suscripción | Chat ilimitado, voz, X fotos/mes, memoria completa, mensajes proactivos | mensual/anual |
| Créditos | Fotos extra, video-mensajes, minutos de videollamada, "regalos" para ella, cambios de apariencia | paquetes de créditos |
| Por minuto | Videollamada estándar e íntima (tarifas distintas) | descuento de créditos por minuto |

---

## 4. Los dos tipos de "modelo" en la plataforma

### 4.1 Compañeras IA (fase 1 — el lanzamiento)

- 100% generadas: cara, cuerpo, voz y personalidad sintéticas. **Nunca** basadas en una persona real sin contrato.
- Creadas por el usuario (su compañera privada) o del catálogo (personajes públicos con "fama" dentro de la plataforma).
- Ventaja operativa: sin nómina, sin horarios, margen bruto altísimo, disponibles 24/7, escalan infinito.

### 4.2 Creadoras humanas y sus clones IA (fase 2)

- Marketplace estilo cam/OnlyFans: creadoras reales verificadas (KYC + 18 U.S.C. §2257) ofrecen chat/contenido/llamadas reales.
- **El producto puente**: la creadora licencia su imagen y voz para un **clon IA oficial** que atiende a sus fans 24/7 cuando ella no está conectada; ella cobra revenue share sin trabajar esas horas.
- Colombia es una ventaja aquí: es uno de los países con más industria webcam del mundo — talento, estudios y know-how locales para reclutar.

> **Regla de diseño**: el usuario SIEMPRE sabe si habla con IA o con humana. Es exigencia legal en varias jurisdicciones (EU AI Act) y además protege la confianza — el engaño destruye el negocio cuando se descubre.

---

## 5. Principios innegociables (líneas rojas)

Estas no son opcionales; violarlas mata el negocio (procesadores de pago, leyes penales) además de ser indefendibles:

1. **Solo adultos**: verificación de edad de usuarios según jurisdicción; verificación fuerte para contenido explícito.
2. **Cero contenido de menores**: ni personajes de apariencia menor, ni "role-play" que lo sugiera. Filtros duros en generación de imagen/video/chat + moderación. Tolerancia cero, sin excepciones, con bloqueo de cuenta y reporte cuando aplique.
3. **Cero imagen de personas reales sin contrato**: no se puede subir la foto de "tu ex" o de una celebridad para crear un avatar. Solo caras 100% sintéticas o licenciadas con contrato (fase 2).
4. **Prohibiciones de las redes de tarjetas** aplicadas también a la IA: nada de no-consentimiento, incesto, bestialismo, violencia sexual — aunque sea ficción generada. (Visa/Mastercard lo exigen; ver doc legal.)
5. **Transparencia IA**: etiquetado claro de que es IA; nunca afirmar ser humana si el usuario pregunta en serio.
6. **Salvaguardas emocionales**: detección de crisis (ideación suicida → derivar a líneas de ayuda), recordatorios de que es IA en conversaciones de dependencia extrema, sin manipulación para gastar ("dark patterns" emocionales tipo "si no pagas me pongo triste" están vetados).
7. **Privacidad real**: los chats son radiactivos (ver hackeo de Muah.ai). Cifrado, retención mínima, seudonimización, opción de borrado total.

---

## 6. Qué NO es este producto

- No es una app de app stores (Apple/Google prohíben contenido sexual): es **web/PWA primero**, con notificaciones push web y quizá app "SFW companion" como canal de adquisición futuro.
- No es un chatbot genérico con skin: la relación (memoria + iniciativa + video en vivo) es el producto.
- No es una plataforma de deepfakes: jamás "crea a tu vecina/celebridad".
- No compite con Character.AI en fandom/entretenimiento general: es nicho adulto/romántico con monetización premium.

---

## 7. Nombre, marca y posicionamiento (para trabajar)

- El nombre en clave "Amara" es placeholder (significa "amada"; suena bien en ES/EN). Alternativas a explorar: dominio .ai o .com disponible, pronunciable en español e inglés, sin connotación pornográfica explícita en la marca madre (facilita pagos, partnerships y prensa; el contenido explícito vive detrás del login).
- Posicionamiento sugerido: **"Ella te espera"** — venta emocional (compañía, deseo, ser escuchado), no venta pornográfica. El porno compite por precio; la conexión emocional retiene y justifica suscripción.

---

*Siguiente documento: [02-stack-tecnologico-ia.md](./02-stack-tecnologico-ia.md) — con qué IA se construye cada pieza y cuánto cuesta.*
