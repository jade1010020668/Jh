# ⚽ Pronósticos de Fútbol con IA

App web que genera pronósticos de partidos de fútbol usando la API de Claude con búsqueda web en tiempo real. Incluye **Liga BetPlay Dimayor (Colombia)** y las grandes ligas: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League y Copa Libertadores.

## ✨ Cómo funciona

1. Eliges la liga.
2. Eliges equipo local y visitante.
3. La app llama a la API de Anthropic con la herramienta `web_search` activada.
4. Claude busca en la web datos reales (forma reciente, lesiones, H2H, posición, cuotas) y genera:
   - Marcador más probable
   - Probabilidades 1X2
   - Mercados adicionales (Over/Under, BTTS, hándicap, córners, tarjetas)
   - Análisis fundamentado
   - Apuestas sugeridas con nivel de confianza
   - Fuentes consultadas

## 🚀 Uso

1. Abre `index.html` en tu navegador (no necesita servidor — sólo doble clic, o `python3 -m http.server`).
2. Pulsa **⚙️ Configurar API key** y pega tu Anthropic API key (obténla en [console.anthropic.com](https://console.anthropic.com/settings/keys)).
3. Selecciona liga → local → visitante → **Generar pronóstico**.

> La API key se guarda **únicamente en `localStorage`** de tu navegador. No se envía a ningún servidor de terceros: la petición va directa de tu navegador a `api.anthropic.com`.

## 🧠 Modelos disponibles

- **Claude Sonnet 4.6** (recomendado, equilibrio calidad/coste)
- **Claude Opus 4.7** (análisis más profundo, más caro)
- **Claude Haiku 4.5** (rápido y económico)

## ⚠️ Aviso importante

**Ningún modelo, ni Claude ni ningún otro, puede pronosticar fútbol con 99-100% de certeza.** Esta app es una **herramienta analítica de apoyo**: recopila datos reales y los sintetiza en un pronóstico fundamentado, pero el fútbol siempre tiene factores impredecibles (lesiones de último minuto, decisiones arbitrales, clima, motivación).

- Apuesta **solo lo que puedas permitirte perder**.
- Trata las recomendaciones como **una opinión más**, no como verdad absoluta.
- Si sientes que el juego se está volviendo un problema, busca ayuda profesional.

## 📁 Estructura

```
index.html    UI principal
leagues.js    Datos de equipos por liga (temporada 2025-26)
app.js        Lógica de UI + llamada a API de Claude con web_search
```

## 🛠️ Desarrollo

Es una SPA estática sin build. Para servirla localmente:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```
