# Contexto del proyecto

Repositorio de apps web estáticas publicadas en Netlify (cada cambio en `main` se publica solo).

## Apps
- `pronosticos/`: pronósticos de fútbol (foco: Liga BetPlay). Dueño y usuario: Diego, apostador, no técnico.
- `whatsapp-bot/`: bot opcional que envía el pronóstico por WhatsApp; reutiliza el motor de `pronosticos/`.
- `sala/`: Sala FF (organizador de salas de Free Fire) con una función de Netlify. No tocar al trabajar en pronósticos.
- `index.html` en la raíz: portada con enlaces a las tres apps. `calculadora/`: la calculadora (antes estaba en la raíz y la portada no enlazaba a nada; Diego entraba por ahí y no encontraba los pronósticos).
- `netlify/functions/espn.mjs`: respaldo de datos de pronósticos (solo si la red del usuario bloquea ESPN).

## Objetivo de pronosticos
"Que pronostique los partidos lo más perfecto posible." Traducción honesta: la probabilidad mejor calibrada posible, con forma de medirla. La certeza no existe y la app lo dice.

## Decisiones tomadas
- **Los números no los pone la IA.** Datos exactos de la API pública de ESPN (sin clave, CORS abierto, no oficial); cálculo en JavaScript puro (`engine.js`). La IA es opcional y solo aporta contexto con fuente comprobable, con efecto acotado (±10%).
- **El mercado manda.** El pronóstico final es sobre todo las cuotas sin margen; el modelo de goles ajusta como máximo 20% y nada si discrepa más de 10 puntos.
- **Apostar casi nunca.** Solo con dos casas independientes escritas por el usuario; tope de 1% de la banca; una apuesta por partido. El valor viene de comparar casas, no de "saber más".
- **Seguimiento con rigor.** Registro automático de cada pronóstico; sin veredictos con menos de 100 partidos.
- La CSP permite conectar solo al propio sitio, `api.anthropic.com`, `site.api.espn.com` y `sports.core.api.espn.com`.
- Sin listas de equipos en el código: tabla y calendario se leen en vivo.
- Especificación del motor diseñada por un equipo de agentes (investigación, tres diseños, auditoría adversarial) y verificada con vectores independientes: `node tests/run.js`.
- **Parámetros de la Liga BetPlay calibrados con datos** (`tools/backtest/`, 1.494 partidos 2023-26; ajuste en 2023-24, validación en 2025-26): el desglose local/visitante NO se usa (empeoraba), el torneo anterior pesa 1,0, la fracción de goles del local es 0,615 y en goles totales el modelo no pesa frente al mercado. RPS 0,2008 frente a 0,2140 de un pronóstico fijo.

- **Auditoría del 11-nov-2026** (seis auditores: motor, datos, interfaz, IA, bot, apuestas): 38 hallazgos corregidos con prueba. Los de más peso: en cuadrangulares se tomaba la tabla del grupo como si fuera la liga; la final nunca se detectaba; con prórroga se registraba el marcador final en vez del de 90 minutos; un dígito mal copiado en una cuota producía una recomendación; la banca "500.000" se leía $500; reabrir un partido borraba cuotas y recomendación.
- Sin cuotas, la Liga BetPlay queda en calidad "Parcial" (modelo probado); las demás ligas, "Pobre".

## Pendientes y riesgos
- **Fusionar el PR a `main`** para que la dirección definitiva funcione: requiere el visto bueno explícito de Diego.
- Los cuadrangulares de 2026 empiezan hacia el 20-nov: la búsqueda de la tabla regular se probó con las respuestas reales de 2025, no con las de 2026.
- No hubo revisión cruzada con Codex (el plugin no está instalado en las sesiones en la nube).
- Sin calibrar: el peso del modelo frente al mercado (no hay historial de cuotas) y todo lo de las ligas europeas.
- ESPN bloquea navegadores automatizados ("HeadlessChrome"); los navegadores normales funcionan. Si la API cambia, la app avisa y no pronostica.
- El paso de IA y los envíos reales del bot no se han probado con credenciales reales.
- El número de teléfono del dueño estuvo en commits antiguos del bot (sigue en el historial de git).
