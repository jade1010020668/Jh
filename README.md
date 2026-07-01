# ⚽ Pronósticos de Fútbol con IA

App web que genera pronósticos de partidos de fútbol usando la API de Claude con búsqueda web en tiempo real. Incluye **Liga BetPlay Dimayor (Colombia) 2026** y las grandes ligas europeas (temporada 2026-27): Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, además de Champions League, Europa League y Copa Libertadores.

## ✨ Cómo funciona

1. Eliges la liga.
2. Eliges equipo local y visitante (o los escribes libremente con "✏️ Otro equipo…"), y opcionalmente una fecha.
3. La app llama a la API de Anthropic con la herramienta `web_search` activada y **transmite la respuesta en vivo** (streaming).
4. Claude busca en la web datos reales (forma reciente, lesiones, H2H, posición, cuotas) y genera:
   - Marcador más probable
   - Probabilidades 1X2
   - Mercados adicionales (Over/Under, BTTS, hándicap, córners, tarjetas)
   - Análisis fundamentado
   - Apuestas sugeridas con nivel de confianza
   - Fuentes consultadas

## 🚀 Uso

1. Sirve la carpeta con un servidor local (recomendado para que la CSP y el `fetch` funcionen sin fricción):
   ```bash
   python3 -m http.server 8000
   # luego abre http://localhost:8000
   ```
   (También funciona abriendo `index.html` con doble clic, pero servirlo por HTTP es más fiable.)
2. Pulsa **⚙️ Configurar API key** y pega tu Anthropic API key (obténla en [console.anthropic.com](https://console.anthropic.com/settings/keys)).
3. Selecciona liga → local → visitante → **Generar pronóstico**.

> La API key se guarda **únicamente en `localStorage`** de tu navegador. No se envía a ningún servidor de terceros: la petición va directa de tu navegador a `api.anthropic.com`. Puedes borrarla en cualquier momento con **🗑 Borrar clave** en el modal de configuración. En un computador compartido, bórrala al terminar.

## 🧠 Modelos disponibles

- **Claude Sonnet 5** (recomendado, equilibrio calidad/coste)
- **Claude Opus 4.8** (análisis más profundo, más caro)
- **Claude Haiku 4.5** (rápido y económico)

Cada consulta muestra su **costo estimado** (tokens + búsquedas web) en USD y COP aproximado.

## 🔒 Seguridad

- Renderizador Markdown propio que **escapa el HTML y valida las URLs** de los enlaces, evitando inyección de código desde las páginas web consultadas.
- **Content-Security-Policy** restrictiva (`script-src 'self'`, `connect-src https://api.anthropic.com`).
- El *system prompt* trata el contenido web como **dato no confiable** e ignora instrucciones incrustadas (defensa contra *prompt injection*).

## 🗂️ Funciones

- **Streaming** en vivo del análisis con progreso de búsquedas.
- **Historial** de pronósticos (localStorage) con reapertura y borrado.
- **Copiar** y **compartir por WhatsApp** el pronóstico.
- **Cancelar** una consulta en curso; reintentos automáticos ante saturación (429/529).
- Accesible: diálogo nativo con foco/Escape, regiones `aria-live`, `focus-visible`.

## ⚠️ Aviso importante

**Ningún modelo, ni Claude ni ningún otro, puede pronosticar fútbol con 99-100% de certeza.** Esta app es una **herramienta analítica de apoyo**: recopila datos reales y los sintetiza en un pronóstico fundamentado, pero el fútbol siempre tiene factores impredecibles (lesiones de último minuto, decisiones arbitrales, clima, motivación).

- Apuesta **solo lo que puedas permitirte perder**.
- Trata las recomendaciones como **una opinión más**, no como verdad absoluta.
- Si sientes que el juego se está volviendo un problema, busca ayuda profesional.

## 📁 Estructura

```
index.html    UI (selectores, fecha, historial, modal de configuración)
leagues.js    Datos de equipos por liga (temporada 2026 / 2026-27)
app.js        Lógica de UI, renderizador Markdown seguro y llamada a la API con streaming
```

## 🔄 Mantenimiento de datos

Las plantillas de las ligas domésticas se actualizan por temporada (ascensos/descensos). Las competiciones continentales (Champions, Europa League, Libertadores) usan **entrada de texto libre** porque sus participantes cambian cada edición y el sorteo puede no haberse realizado; la búsqueda web valida cualquier equipo escrito.
