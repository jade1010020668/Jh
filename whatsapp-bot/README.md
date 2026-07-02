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
3. Una cuenta de **Twilio** → [console.twilio.com](https://console.twilio.com). El **sandbox de WhatsApp** es gratis para pruebas.

> **Importante sobre WhatsApp:** por reglas de Meta, un número de empresa **no puede escribirte primero** libremente. En el *sandbox* de Twilio tú debes **unirte** enviando un código (ver abajo). Para envío en producción a tu número sin unirte, necesitas un **remitente de WhatsApp Business API aprobado** por Meta y **plantillas de mensaje** aprobadas. Esto es un requisito de WhatsApp, no del código.

## 🚀 Instalación

```bash
cd whatsapp-bot
npm install
cp .env.example .env
# edita .env con tus llaves
```

### Configurar el sandbox de WhatsApp (para probar gratis)
1. En Twilio Console → **Messaging → Try it out → Send a WhatsApp message**.
2. Verás un número (normalmente `+1 415 523 8886`) y un código tipo `join <palabra>`.
3. Desde tu WhatsApp (`+57 318 393 8822`), envía ese `join <palabra>` a ese número.
4. Pon ese número en `TWILIO_WHATSAPP_FROM` y tu número en `WHATSAPP_TO` (formato `whatsapp:+57...`).

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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Credenciales de Twilio |
| `TWILIO_WHATSAPP_FROM` | Número emisor (`whatsapp:+14155238886` en sandbox) |
| `WHATSAPP_TO` | Tu número (`whatsapp:+573183938822`) |
| `LEAD_MINUTES` | Minutos antes del partido para enviar (60) |
| `CRON_SCHEDULE` | Frecuencia de revisión (`*/5 * * * *`) |

## 💸 Costo aproximado
Cada pronóstico ≈ **US$0.02–0.10** (tokens + búsquedas web) con Sonnet 5. Ponle un límite de gasto a tu key en la consola de Anthropic.

## ⚠️ Aviso
Los pronósticos son análisis con IA a partir de datos reales, **no garantías**. Apuesta solo lo que puedas permitirte perder.
