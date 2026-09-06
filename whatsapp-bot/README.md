# 🤖 Bot de pronósticos a WhatsApp

Envía a tu WhatsApp el pronóstico de cada partido **1 hora antes del pitazo inicial**, de forma automática. Usa la **API de Claude** (con búsqueda web para datos reales) para el análisis y **Twilio** para el envío.

```
┌────────────┐   cron cada 5 min   ┌─────────────┐   texto   ┌────────┐   WhatsApp
│ fixtures   │ ──────────────────► │  Claude API │ ────────► │ Twilio │ ──────────► 📱 tu celular
│ .json      │   ¿falta 1h?        │ + web_search│           │        │
└────────────┘                     └─────────────┘           └────────┘
```

## ⚠️ Lo que necesitas (requisitos reales)

1. **Node.js 18+** en un equipo o servidor **encendido 24/7** (tu PC, un Raspberry Pi, o un hosting como Railway/Render/Fly.io). Si el equipo se apaga, no se envía nada.
2. Una **API key de Anthropic** con saldo → [console.anthropic.com](https://console.anthropic.com/settings/keys).
3. Un proveedor de envío de WhatsApp (elige uno):
   - **Meta WhatsApp Cloud API** (recomendado, gratis) → [developers.facebook.com](https://developers.facebook.com).
   - **Twilio** (sandbox gratis) → [console.twilio.com](https://console.twilio.com).

> **Importante sobre WhatsApp (regla de Meta, no del código):** un número de empresa **no puede escribirte primero** con texto libre. Solo puede fuera de eso mediante **plantillas aprobadas**. En pruebas basta con que **tú le escribas primero** al número (abres una ventana de 24 h) o registres tu número como destinatario de prueba. Esto aplica tanto a Meta como a Twilio.

## 🟢 Ruta recomendada: Meta WhatsApp Cloud API (gratis)

1. Entra a [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App → Business**.
2. Agrega el producto **WhatsApp** a la app. Meta te da gratis:
   - un **número de prueba** (emisor),
   - un **Phone number ID** → ponlo en `META_PHONE_NUMBER_ID`,
   - un **token temporal** (24 h) → ponlo en `META_ACCESS_TOKEN` (para dejarlo fijo, genera un *System User token* permanente en Business Settings).
3. En la sección **API Setup**, agrega tu número (`+573183938822`) como **destinatario de prueba** y verifícalo con el código que te llega por WhatsApp.
4. En `.env`: `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TO=573183938822`.
5. Prueba: `npm run test-now -- colombia`. Si tu número está fuera de la ventana de 24 h, escríbele primero al número de prueba desde tu WhatsApp y reintenta.

## 🚀 Instalación

```bash
cd whatsapp-bot
npm install
cp .env.example .env
# edita .env con tus llaves
```

### Opción B: sandbox de Twilio (alternativa)
1. En `.env`: `WHATSAPP_PROVIDER=twilio`.
2. En Twilio Console → **Messaging → Try it out → Send a WhatsApp message**.
3. Verás un número (normalmente `+1 415 523 8886`) y un código tipo `join <palabra>`.
4. Desde tu WhatsApp (`+57 318 393 8822`), envía ese `join <palabra>` a ese número.
5. Pon ese número en `TWILIO_WHATSAPP_FROM`. `WHATSAPP_TO` puede ir como `573183938822`.

## ▶️ Uso

**Probar ahora mismo (envío inmediato de un partido):**
```bash
npm run test-now -- colombia     # busca "colombia" en fixtures.json y envía ya
```

**Dejarlo corriendo (envía solo, 1h antes de cada partido):**
```bash
npm start
```

Mantenlo vivo con un gestor de procesos:
```bash
npm i -g pm2
pm2 start src/index.js --name mundial-bot
pm2 save
```

## 🗓️ Agenda de partidos

Edita **`fixtures.json`**. Cada partido:
```json
{
  "league": "Mundial 2026 · Octavos",
  "home": "Colombia",
  "away": "Ghana",
  "kickoff": "2026-07-03T21:30:00-05:00"
}
```
`kickoff` en formato ISO 8601 **con tu zona horaria** (`-05:00` para Colombia). El bot enviará `LEAD_MINUTES` (60 por defecto) antes de esa hora. Los partidos ya enviados se registran en `sent.json` para no repetir.

## ⚙️ Variables (.env)

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` (rec.), `claude-opus-4-8` o `claude-haiku-4-5-20251001` |
| `WHATSAPP_PROVIDER` | `meta` (recomendado) o `twilio` |
| `WHATSAPP_TO` | Tu número, solo dígitos con país (`573183938822`) |
| `META_ACCESS_TOKEN` / `META_PHONE_NUMBER_ID` | Credenciales de Meta Cloud API (si provider=meta) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Credenciales de Twilio (si provider=twilio) |
| `LEAD_MINUTES` | Minutos antes del partido para enviar (60) |
| `CRON_SCHEDULE` | Frecuencia de revisión (`*/5 * * * *`) |

## 💸 Costo aproximado
Cada pronóstico ≈ **US$0.02–0.10** (tokens + búsquedas web) con Sonnet 5. Ponle un límite de gasto a tu key en la consola de Anthropic.

## ⚠️ Aviso
Los pronósticos son análisis con IA a partir de datos reales, **no garantías**. Apuesta solo lo que puedas permitirte perder.
