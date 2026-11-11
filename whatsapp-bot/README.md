# 🤖 Bot de pronósticos a WhatsApp

Envía a tu WhatsApp el pronóstico de cada partido **antes del pitazo inicial** (60 minutos por defecto). Usa el **mismo motor estadístico que la app web** (`../pronosticos/engine.js` y `data.js`): lee solo el calendario, la tabla, los resultados y las cuotas de referencia, calcula las probabilidades y redacta el mensaje.

- **No hay que escribir la agenda a mano:** el bot consulta el calendario de las ligas que elijas.
- **No necesita IA ni API key.** La IA es un extra opcional que añade bajas y rotaciones confirmadas.
- El bot **no recomienda apuestas**: no conoce las cuotas de tu casa. Para eso está la app web.

Ejemplo de mensaje:

```
⚽ *Llaneros FC vs Boyacá Chicó FC*
Liga BetPlay Dimayor (Colombia) · jue, 12 de nov, 07:00 p. m.

📊 Llaneros FC 58% · Empate 25% · Boyacá Chicó FC 17%
🥅 Más de 2,5 goles: 46% · Ambos anotan: 47%
🎯 Marcador más probable: 1-0 (1 de cada 8)
🔎 mercado 57%/25%/18% · modelo 65%/23%/11%
📎 Calidad de los datos: Parcial

⚠️ Estimación estadística, no una garantía…
```

## Lo que necesitas

1. **Node.js 20+** en un equipo **encendido 24/7** (tu PC, un Raspberry Pi o un hosting). Si se apaga, no se envía nada.
2. **El repositorio completo** (el bot usa archivos de la carpeta `pronosticos/`).
3. Un proveedor de envío de WhatsApp: **Meta WhatsApp Cloud API** (recomendado, gratis) o **Twilio** (sandbox gratis).

> **Regla de WhatsApp (de Meta, no del código):** un número de empresa no puede escribirte primero con texto libre. En pruebas basta con que **tú le escribas primero** al número (abre una ventana de 24 h). Para envíos permanentes sin esa ventana hace falta una **plantilla de mensaje aprobada** por Meta.
>
> **Ojo: en ese caso el bot no siempre se entera.** Meta y Twilio pueden *aceptar* el mensaje y descartarlo después. Por eso el bot escribe "Aceptado por meta", no "entregado". Si dejas de recibir pronósticos, escríbele "hola" al número (hay que hacerlo al menos una vez cada 24 horas) o usa una plantilla aprobada.

## Instalación

```bash
git clone <este repositorio> && cd Jh/whatsapp-bot
npm install
cp .env.example .env    # y complétalo
```

### Opción A: Meta WhatsApp Cloud API
1. En [developers.facebook.com](https://developers.facebook.com): **My Apps → Create App → Business** y añade el producto **WhatsApp**.
2. Copia el **Phone number ID** a `META_PHONE_NUMBER_ID` y el **token** a `META_ACCESS_TOKEN` (el temporal dura 24 h; para dejarlo fijo crea un token de *System User*).
3. En **API Setup**, agrega tu número como destinatario de prueba y verifícalo.
4. En `.env`: `WHATSAPP_PROVIDER=meta` y `WHATSAPP_TO=57XXXXXXXXXX` (tu número, solo dígitos).

### Opción B: sandbox de Twilio
1. En `.env`: `WHATSAPP_PROVIDER=twilio`.
2. En Twilio Console → **Messaging → Try it out → Send a WhatsApp message**: envía desde tu WhatsApp el `join <palabra>` al número que te muestran.
3. Pon ese número en `TWILIO_WHATSAPP_FROM`.

## Uso

```bash
npm run test-now              # envía YA el pronóstico del próximo partido (prueba)
npm run test-now -- nacional  # ...del próximo partido de un equipo (sirve sin tildes: "medellin", "america")
npm start                     # queda corriendo y envía antes de cada partido
```

Para mantenerlo vivo: `npm i -g pm2 && pm2 start src/index.js --name pronosticos-bot && pm2 save`.

## Variables (`.env`)

| Variable | Descripción |
|---|---|
| `LEAGUES` | Ligas a seguir, separadas por coma (`col.1` por defecto) |
| `WHATSAPP_PROVIDER` | `meta` (recomendado) o `twilio` |
| `WHATSAPP_TO` | Tu número, solo dígitos con país |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` | Credenciales de Meta |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Credenciales de Twilio |
| `LEAD_MINUTES` | Minutos antes del partido (60) |
| `CRON_SCHEDULE` | Cada cuánto revisa el calendario (`*/5 * * * *`) |
| `TIMEZONE` | Zona horaria de la hora que aparece en el mensaje y del cron (`America/Bogota`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | **Opcional.** Contexto con IA (bajas y rotaciones con fuente) |

## Cómo se comporta cuando algo falla

- **La fuente de datos no responde completa:** el bot no envía un mensaje a medias; reintenta en cada revisión. Solo en los últimos 15 minutos envía lo que tenga.
- **El envío falla:** reintenta en cada revisión hasta la hora del partido (sin volver a pagar la consulta de IA).
- **Configuración incompleta o con los valores de ejemplo:** se niega a arrancar y dice qué variable corregir.

No se ha probado con credenciales reales de Meta ni de Twilio en este repositorio: haz `npm run test-now` antes de confiar en él.

## Aviso
Es una estimación estadística, **no una garantía**. No apuestes más de lo que puedas perder.
