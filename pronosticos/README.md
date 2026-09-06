# ⚽ Pronósticos de Fútbol con IA + análisis de valor

App web que genera pronósticos de partidos con la API de Claude (búsqueda web en tiempo real) y —lo importante para apostar con criterio— **calcula si hay VALOR frente a las cuotas de tu casa y cuánto apostar según tu banca**. Enfocada en la **Liga BetPlay Dimayor (Colombia)**, con Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 (2026-27), Champions, Europa League y Libertadores.

En línea: **https://fabulous-unicorn-235c34.netlify.app/pronosticos/** (cuando el PR esté fusionado en `main`; mientras tanto, en la *deploy preview* del PR).

> **Léelo antes de apostar:** ninguna app ni modelo garantiza ganar. Las casas cobran un margen (~5-8%) en cada cuota; a largo plazo la mayoría pierde. Lo único que funciona es apostar **solo cuando hay valor** (la probabilidad real supera la implícita en la cuota), con **stakes pequeños** y **registrando resultados**. Eso es exactamente lo que esta app te ayuda a hacer.

## 🚀 Uso rápido

1. Abre la app (URL de arriba) o sírvela localmente desde la raíz del repo:
   ```bash
   python3 -m http.server 8000   # http://localhost:8000/pronosticos/
   ```
2. **⚙️ Configurar API key** → pega tu key de [console.anthropic.com](https://console.anthropic.com/settings/keys). Se guarda solo en tu navegador.
3. Elige la liga. En **Liga BetPlay** pulsa **📅 Ver próxima fecha** para traer los partidos reales y ponerlos con un clic.
4. Abre **💰 Cuotas y banca**, copia las cuotas decimales de tu casa (Wplay, BetPlay, Rushbet, Codere, Betsson…) y tu banca en COP.
5. **🔮 Generar pronóstico y valor**. Verás:
   - **Panel de decisión**: ✅ hay valor (en qué mercados, con stake sugerido) o ⛔ no apostar.
   - **Tabla de valor**: probabilidad del análisis, cuota justa, cuota de la casa, probabilidad implícita (sin margen), EV, veredicto y stake.
   - El análisis completo con fuentes.
6. Si apuestas, regístralo en **🕑 Historial** (mercado, cuota, monto) y marca el resultado después. La app calcula aciertos, ganancia y **ROI**.

## 🧮 Cómo se calcula el valor

- **Probabilidad implícita sin margen**: `(1/cuota) / Σ(1/cuotas del mercado)`. Así se descuenta el margen de la casa.
- **EV** (valor esperado por unidad): `probabilidad × cuota − 1`. Solo se considera valor real si **EV ≥ +3%**.
- **Stake** (Kelly fraccionado 1/4): `f = (b·p − q)/b`, con `b = cuota − 1`, `q = 1 − p`; se usa `f/4` con **tope del 3%** de la banca. Sin valor → stake 0.
- Las probabilidades salen del análisis del modelo (bloque de datos estructurado); si no llegan, la app lo indica en vez de inventar.
- Si no ingresas cuotas, se usan las que el análisis encuentre en la web (marcadas como "web": verifícalas).

## 🇨🇴 Enfoque Liga BetPlay

El análisis incorpora contexto colombiano: **altura** (Bogotá, Tunja, Pasto, Manizales vs. tierra caliente), **tendencia de empates** del II-2026, promedio de ~2.5 goles, **tabla del descenso**, cuadrangulares y reclasificación, y busca cuotas en casas colombianas. La búsqueda se localiza en Colombia (`user_location`).

## 🧠 Modelos

- **Claude Sonnet 5** (recomendado) · **Claude Opus 4.8** (más profundo, más caro) · **Claude Haiku 4.5** (económico)

Cada consulta muestra su costo estimado (tokens + búsquedas) en USD y COP aproximado.

## 🔒 Seguridad

- Renderizador Markdown propio que escapa HTML y valida URLs (sin XSS desde páginas web consultadas).
- CSP restrictiva; `textContent` en los estados; el panel de valor se construye con DOM, sin `innerHTML`.
- System prompt que trata el contenido web como dato no confiable (defensa contra *prompt injection*).
- Botón **Borrar clave**; la key nunca sale de tu navegador.

## 🗂️ Funciones

- Streaming en vivo con progreso de búsquedas; manejo de `pause_turn` y truncado; reintentos 429/529; Cancelar.
- Próxima fecha Liga BetPlay (JSON verificado en web, caché 12 h).
- Historial con **registro de apuestas y ROI**; copiar y compartir por WhatsApp (incluye la decisión de valor).
- Guía **"Cómo apostar mejor"** dentro de la app (margen, valor, banca, simples vs. combinadas, expectativas reales).
- Accesible: `<dialog>` nativo, `aria-live`, `focus-visible`, responsive.

## ⚠️ Aviso importante

**Ningún modelo puede pronosticar fútbol con 99-100% de certeza.** Un apostador disciplinado y bueno logra un ROI del 2-5% a largo plazo, con rachas malas incluidas. Apuesta solo lo que puedas permitirte perder; nunca persigas pérdidas. Si el juego se vuelve un problema, busca ayuda profesional.

## 📁 Estructura

```
pronosticos/index.html   UI (selectores, próxima fecha, cuotas y banca, panel de decisión, historial, guía)
pronosticos/leagues.js   Equipos por liga (2026 / 2026-27)
pronosticos/app.js       Lógica: API con streaming, Markdown seguro, valor/EV/Kelly, historial y ROI
whatsapp-bot/            Bot opcional que envía pronósticos por WhatsApp 1 h antes (requiere tus cuentas y un servidor)
```

## 🔄 Mantenimiento de datos

Las plantillas de ligas domésticas se actualizan por temporada. Las continentales usan texto libre porque sus participantes cambian por edición; la búsqueda web valida cualquier equipo escrito.
