# 🤖 Rutina de avisos por WhatsApp (1 hora antes de cada partido)

Esta rutina te envía a **WhatsApp** el marcador probable de cada partido del
Mundial 2026 **una hora antes** de que empiece. Corre sola en **GitHub Actions**
(no necesitas tener tu PC encendido) y usa **CallMeBot** (gratis) para WhatsApp.

> ⚠️ El marcador es una **estimación probabilística**, NO una certeza. Ningún
> modelo acierta el 100 %. Apuesta solo lo que puedas permitirte perder.

---

## Cómo funciona

```
bot/predict.js       Calcula el marcador (mismo motor que la web) y envía el aviso
bot/fixtures.json    Calendario: 72 partidos de grupos (rellena tú las horas)
bot/sent.json        Estado interno para no enviar el mismo aviso dos veces
bot/gen-fixtures.js  Regenera los cruces de grupos (conserva las horas que pusiste)
.github/workflows/whatsapp-predictions.yml   El cron (cada 15 min)
```

Cada 15 min el cron mira `fixtures.json`; si un partido arranca dentro de la
ventana (~50–70 min), calcula la predicción y te la manda. Luego lo marca en
`sent.json` para no repetir.

---

## Puesta en marcha (3 pasos)

### 1) Consigue tu apikey de CallMeBot
Sigue la guía oficial: <https://www.callmebot.com/blog/free-api-whatsapp-messages/>
En resumen: agregas su número a tus contactos y le envías por WhatsApp el
mensaje de activación (`I allow callmebot to send me messages`). Te responde con
tu **apikey**. Verifica el número actual en esa página (puede cambiar).

### 2) Añade los *secrets* en GitHub
En tu repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `CALLMEBOT_PHONE` | Tu número con prefijo de país, sin `+` (p. ej. `521556...` para México) |
| `CALLMEBOT_APIKEY` | La apikey que te dio CallMeBot |

### 3) Rellena las horas en `bot/fixtures.json`
Cada partido necesita su `kickoff` en formato **ISO 8601**. Puedes usar UTC (`Z`)
o tu hora local con el desfase. Copia las horas de cualquier web del Mundial.

```json
{ "home": "México", "away": "Sudáfrica", "group": "A",
  "kickoff": "2026-06-11T19:00:00Z", "venue": "Estadio Azteca" }
```
- `kickoff` vacío (`""`) → ese partido se ignora.
- Para **eliminatorias** (octavos en adelante), añade entradas nuevas con los
  nombres reales de los equipos cuando se conozcan (mismos nombres que en
  `js/data.js`).

### 4) Activa el cron
Los cron de GitHub Actions **solo corren desde la rama `main`**. Fusiona el PR a
`main` y quedará activo. La pestaña **Actions** debe estar habilitada.

---

## Probarlo sin esperar

- **En GitHub:** pestaña **Actions → Avisos WhatsApp del Mundial 2026 → Run
  workflow**, marca la casilla *test* → te llega un mensaje de prueba con el
  próximo partido.
- **En tu PC (sin enviar nada):**
  ```bash
  DRY_RUN=1 TEST_MODE=1 node bot/predict.js     # muestra un mensaje de ejemplo
  ```
- **En tu PC (enviando de verdad):**
  ```bash
  CALLMEBOT_PHONE=521556... CALLMEBOT_APIKEY=tuclave TEST_MODE=1 node bot/predict.js
  ```

---

## Ajustes
- `LEAD_MINUTES` (def. 60): minutos antes del partido para avisar.
- `WINDOW_MINUTES` (def. 20): ancho de la ventana de disparo.
- Los **ratings Elo** y la predicción salen de `js/data.js` + `js/models.js`
  (la misma fuente que la web). Edita los Elo ahí si quieres afinar.

## Límites honestos
- CallMeBot es gratuito y **no oficial**: puede tener límites o caerse; es ideal
  para enviarte mensajes a ti mismo, no para difusión masiva.
- El cron no es exacto al minuto (de ahí la ventana de 20 min).
- Si cambian horarios de partidos, actualiza `fixtures.json`.
