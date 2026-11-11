# Contexto del proyecto

Repositorio de apps web estáticas publicadas en Netlify (cada cambio en `main` se publica solo).

## Apps
- `pronosticos/`: pronósticos de fútbol (foco: Liga BetPlay). Dueño y usuario: Diego, apostador, no técnico.
- `whatsapp-bot/`: bot opcional que envía el pronóstico por WhatsApp; reutiliza el motor de `pronosticos/`.
- `sala/`: Sala FF (organizador de salas de Free Fire) con una función de Netlify. No tocar al trabajar en pronósticos.
- `index.html` en la raíz: calculadora.

## Objetivo de pronosticos
"Que pronostique los partidos lo más perfecto posible." Traducción honesta: la probabilidad mejor calibrada posible, con forma de medirla. La certeza no existe y la app lo dice.

## Decisiones tomadas
- **Los números no los pone la IA.** Datos exactos de la API pública de ESPN (sin clave, CORS abierto, no oficial); cálculo en JavaScript puro (`engine.js`). La IA es opcional y solo aporta contexto con fuente comprobable, con efecto acotado (±10%).
- **El mercado manda.** El pronóstico final es sobre todo las cuotas sin margen; el modelo de goles ajusta como máximo 20–25% y nada si discrepa más de 10 puntos.
- **Apostar casi nunca.** Solo con dos casas independientes escritas por el usuario; tope de 1% de la banca; una apuesta por partido. El valor viene de comparar casas, no de "saber más".
- **Seguimiento con rigor.** Registro automático de cada pronóstico; sin veredictos con menos de 100 partidos.
- La CSP permite conectar solo a `api.anthropic.com`, `site.api.espn.com` y `sports.core.api.espn.com`.
- Sin listas de equipos en el código: tabla y calendario se leen en vivo.
- Especificación del motor diseñada por un equipo de agentes (investigación, tres diseños, auditoría adversarial) y verificada con vectores independientes: `node tests/run.js`.

## Pendientes y riesgos
- Parámetros `[M]` del motor sin calibrar con datos propios.
- ESPN bloquea navegadores automatizados ("HeadlessChrome"); los navegadores normales funcionan. Si la API cambia, la app avisa y no pronostica.
- El paso de IA y los envíos reales del bot no se han probado con credenciales reales.
- El número de teléfono del dueño estuvo en commits antiguos del bot (sigue en el historial de git).
