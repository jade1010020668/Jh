# Amara — App (MVP funcional)

Prototipo **instalable en iOS y Android** (PWA) de la plataforma de compañeras IA descrita en [`../docs`](../docs). Ata **Grok (xAI)** y **DeepSeek (vía OpenRouter)** tras una interfaz única para poder compararlos en vivo, con **memoria**, **filtros de seguridad** y **protocolo de crisis** funcionando.

> ⚠️ Es un MVP de la capa de chat (semana 1–4 del roadmap, doc 05). Aún no incluye generación de imagen/voz/video, pagos ni verificación de edad real — están especificados en `../docs/06` y `../docs/07`.

## Por qué es una PWA y no una app de tienda

Apple App Store y Google Play **prohíben el contenido adulto**. Por eso Amara (como Candy.ai y todas las del sector) es una **PWA**: una app web que el usuario **instala** en su teléfono sin pasar por las tiendas.

- **Android (Chrome)**: menú ⋮ → "Instalar app" / "Añadir a pantalla de inicio".
- **iOS (Safari)**: botón Compartir → "Añadir a pantalla de inicio".

Queda con ícono, a pantalla completa y arranque offline del shell — indistinguible de una app nativa, pero fuera del control de las tiendas.

## Cómo correrla

```bash
cd app
npm install
cp .env.example .env.local   # opcional: pon tus API keys
npm run dev                  # http://localhost:3000
```

**Sin API keys** funciona en modo DEMO (respuestas locales) para ver la UI.
**Con API keys** habla con la IA real; el selector de arriba a la derecha cambia entre Grok y DeepSeek en vivo.

### Conseguir las claves
- **DeepSeek** (recomendado para empezar: potente y barato): https://openrouter.ai/keys → `OPENROUTER_API_KEY`
- **Grok** (el más potente tolerante): https://x.ai/api → `XAI_API_KEY`

## Cómo está atado (arquitectura)

```
PWA (React/Next) ── POST /api/chat ──▶  pipeline:
                                        1. safety.js   (filtro de ENTRADA + crisis)
                                        2. memory.js   (carga sesión + hechos)
                                        3. persona.js  (system prompt del personaje)
                                        4. ai.js       (Grok | DeepSeek, intercambiable)
                                        5. safety.js   (filtro de SALIDA)
                                        6. memory.js   (guarda + aprende hechos)
```

- `src/lib/ai.js` — **el pegamento de los modelos**: Grok, DeepSeek y OpenRouter comparten API estilo OpenAI, así que cambiar de motor = cambiar URL+key+modelo. Añadir otro proveedor es añadir una entrada.
- `src/lib/persona.js` — convierte el personaje (del cuestionario) en el system prompt: personalidad, acento, marco de relación y las reglas inquebrantables.
- `src/lib/memory.js` — memoria v1 (JSON por sesión + extracción de hechos con regex). En producción: Postgres + pgvector.
- `src/lib/safety.js` — las líneas rojas del doc 07 §3.1 como filtros que corren siempre, en entrada y salida.

## Probado (verificado en build local)

- ✅ Compila (`npm run build`) y sirve.
- ✅ Chat con memoria: aprende hechos ("Se llama Juan") y los recuerda entre mensajes.
- ✅ Filtro de seguridad bloquea categorías prohibidas.
- ✅ Protocolo de crisis deriva a líneas de ayuda.
- ✅ Selector Grok/DeepSeek en vivo.
- ✅ Instalable (manifest + service worker + íconos).

## Cuentas, base de datos y validación

Ahora la app tiene **cuentas reales** y **base de datos**, pensada para un **piloto que mide demanda antes de gastar** en pagos/legal:

- **Auth** (`src/lib/auth.js`): registro/login con contraseña (scrypt) + sesión firmada (HMAC), sin dependencias externas. Cookie httpOnly.
- **Base de datos** (`src/lib/db.js`): dos drivers, mismo patrón que la IA:
  - **Postgres** si defines `DATABASE_URL` (producción: Neon/Supabase gratis, funciona en Vercel).
  - **Local** (archivos en `.data/`) si no — para sandbox/desarrollo.
- **Memoria persistente por usuario+personaje**: la relación y lo que ella recuerda sobreviven entre sesiones y dispositivos (la clave del "ella me recuerda").
- **Analítica de embudo** (`/api/stats`): signup → mensajes → subidas de nivel → paywall → **intención de pago**. Es tu tablero de validación.
- **Paywall de intención** (`/api/checkout-intent`): tras 40 mensajes gratis, mide cuántos **querrían** pagar — sin cobrar todavía. Cuando validas demanda, aquí entra el procesador real (docs/03).

### Flujo verificado (build local + curl)
- ✅ Registro → verificación de edad → chat (auth obligatoria; sin login = 401).
- ✅ Memoria persiste en DB por usuario ("Se llama Juan" recordado).
- ✅ Relación avanza y sube de nivel; contenido explícito gateado por nivel + edad + premium.
- ✅ Paywall a los 40 mensajes; intención de pago registrada.
- ✅ Embudo: `{usuarios, registros, mensajes, clicks_en_pagar, intencion_de_pago_pct}`.

## Desplegar el piloto (para probar demanda)

1. Crea una base Postgres gratis en [Neon](https://neon.tech) → copia la `DATABASE_URL`.
2. Despliega en [Vercel](https://vercel.com) (importa el repo, root = `app/`).
3. Variables: `DATABASE_URL`, `AUTH_SECRET` (cadena larga aleatoria), `OPENROUTER_API_KEY`.
4. Comparte la URL, mira `/api/stats`. Si la intención de pago es sana, toca montar pagos reales (docs/03).

## Siguiente paso del roadmap

Notas de voz (TTS español), creación de personaje (desde cero / referencia), y — fase 3 — videollamada.
