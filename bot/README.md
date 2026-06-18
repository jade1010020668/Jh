# 🤖 Rutina de avisos por WhatsApp (1 hora antes de cada partido)

Esta rutina te envía a **WhatsApp** el marcador probable de cada partido del
Mundial 2026 **una hora antes** de que empiece. Corre sola en **GitHub Actions**
(no necesitas tener tu PC encendido) y usa **CallMeBot** (gratis) para WhatsApp.

> ⚠️ El marcador es una **estimación probabilística**, NO una certeza. Ningún
> modelo acierta el 100 %. Apuesta solo lo que puedas permitirte perder.

---

## Cómo funciona

```
bot/predict.js       Orquesta el aviso: análisis híbrido + envío por WhatsApp
bot/llm-adjust.js    Capa Opus 4.8 + búsqueda web: ajuste por LESIONES/SUSPENSIONES
bot/fixtures.json    Calendario: 72 partidos de grupos (rellena tú las horas)
bot/sent.json        Estado interno para no enviar el mismo aviso dos veces
bot/gen-fixtures.js  Regenera los cruces de grupos (conserva las horas que pusiste)
.github/workflows/whatsapp-predictions.yml   El cron (cada 15 min)
```

Cada 15 min el cron mira `fixtures.json`; si un partido arranca dentro de la
ventana (~50–70 min), calcula la predicción y te la manda. Luego lo marca en
`sent.json` para no repetir.

### Análisis HÍBRIDO (math + Opus 4.8)
1. **Base matemática** (la misma de la web, `js/models.js`): Elo → goles
   esperados → Poisson/Dixon-Coles → marcador y mercados. Es **determinista**:
   con los mismos datos da siempre lo mismo.
2. **Ajuste MULTIFACTOR de Opus 4.8** (`bot/llm-adjust.js`): busca en la web y
   pondera, con un procedimiento fijo, **varios factores** de ambos equipos —
   🩹 lesiones/suspensiones, 📈 forma y alineaciones, 💱 cuotas del mercado,
   🏔️ contexto físico (altitud, clima, viajes) y otros indicadores — y aplica un
   ajuste **acotado a ±25 %** a los goles esperados de cada selección. La base
   matemática sigue mandando; el modelo solo "afina".
3. Si **no** defines `ANTHROPIC_API_KEY` (o algo falla), la rutina usa **solo el
   paso 1** y nunca se rompe.

> Detalle paso a paso del análisis: **`bot/COMO-ANALIZA-EL-PARTIDO.md`**.

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
| `ANTHROPIC_API_KEY` | *(Opcional, recomendado)* Tu clave de la API de Anthropic, para el ajuste **multifactor** con Opus 4.8. Sin ella, la rutina usa solo el modelo matemático. Consíguela en <https://console.anthropic.com> → API Keys. |

> 💸 **Coste**: el ajuste multifactor con Opus 4.8 + búsqueda web gasta unos
> **céntimos por partido** de tu cuenta de Anthropic. Como solo se llama 1 vez
> por partido (1 h antes), el gasto del Mundial es pequeño. Si no quieres coste
> alguno, no pongas el secret y tendrás el modelo matemático (gratis).

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
  npm install                                   # instala el SDK (una vez)
  DRY_RUN=1 TEST_MODE=1 node bot/predict.js     # muestra un mensaje de ejemplo
  ```
  Sin `ANTHROPIC_API_KEY` verás solo el modelo matemático. Para probar el
  ajuste multifactor, añade `ANTHROPIC_API_KEY=sk-ant-...` delante del comando
  (¡ojo: eso sí gasta unos céntimos, aunque sea DRY_RUN!).
- **En tu PC (enviando de verdad):**
  ```bash
  CALLMEBOT_PHONE=521556... CALLMEBOT_APIKEY=tuclave TEST_MODE=1 node bot/predict.js
  ```

---

## Verificar que todo funciona (tests + utilidades)

Hay una **red de seguridad** para no depender de "probar a mano":

```bash
npm test           # 35 tests: motor matemático, capa Opus (acotada), horario, validador
npm run validate   # revisa fixtures.json: equipos válidos, horas, duplicados, zona horaria
npm run doctor     # panel de estado: ¿secrets?, ¿SDK?, ¿calendario?, próximo partido y su predicción
npm run scoreboard # ¿acierta el modelo? Brier/RPS y % de acierto sobre resultados reales (bot/results.json)
```

- **CI:** el workflow `.github/workflows/ci.yml` corre `test + validate + doctor + dry-run + scoreboard`
  en cada push/PR, así el verde significa algo de verdad.
- **Calibración:** añade partidos jugados a `bot/results.json` (con su `actual`) y `npm run scoreboard`
  te dice si el modelo va mejor que el azar (Brier < 0.667).
- **Robustez en producción:** el envío reintenta (1s/2s/4s), si la rutina falla intenta **avisarte
  del fallo por WhatsApp**, y deja un resumen en el *Step Summary* del job de Actions.

---

## Ajustes
- `LEAD_MINUTES` (def. 60): minutos antes del partido para avisar.
- `WINDOW_MINUTES` (def. 20): ancho de la ventana de disparo.
- Los **ratings Elo** y la base de la predicción salen de `js/data.js` +
  `js/models.js` (la misma fuente que la web). Edita los Elo ahí para afinar.
- El **ajuste multifactor** (modelo, factores, tope de ±25 %, procedimiento)
  vive en `bot/llm-adjust.js`.

## Límites honestos
- CallMeBot es gratuito y **no oficial**: puede tener límites o caerse; es ideal
  para enviarte mensajes a ti mismo, no para difusión masiva.
- El cron no es exacto al minuto (de ahí la ventana de 20 min).
- Si cambian horarios de partidos, actualiza `fixtures.json`.
- El ajuste de Opus 4.8 depende de que **haya información pública** (bajas,
  forma, cuotas, etc.) y de la red; es **acotado a propósito** (±25 %) para no
  sobrerreaccionar. No garantiza acertar: sigue siendo una estimación.
