# 🗓️ Rutina diaria en el chat (sin WhatsApp, sin app)

Esto hace que el análisis del Mundial **aparezca solo cada día en el chat**, sin
CallMeBot, sin *secrets* y sin fusionar nada. Usa una **Rutina / Tarea programada
de Claude Code en la web** ("Cloud Rotinas").

## Lo que ya está listo (hecho)
- **Comando reutilizable** `/mundial-hoy` (en `.claude/skills/mundial-hoy/`): busca
  los partidos de hoy, calcula la base con el motor del repo y le suma el
  multifactor con búsqueda web, y publica el veredicto aquí.
- **Helper** `node bot/analyze-match.js "Local" "Visitante"` para la base de cada
  partido.

## El único paso que haces tú (1 clic, en la web)
1. Abre este proyecto en **Claude Code en la web** (claude.ai/code).
2. Crea una **tarea programada / rutina recurrente** (la opción de "Schedule" /
   "Rutina" del proyecto).
3. **Cadencia:** diaria, por la mañana (tu horario, ej. 08:00 de Ciudad de México).
4. **Prompt de la rutina** (pega esto tal cual):

   ```
   /mundial-hoy
   ```

   o, si prefieres en lenguaje natural:

   ```
   Analiza los partidos del Mundial 2026 que se juegan hoy: base matemática con
   node bot/analyze-match.js para cada uno + multifactor (lesiones, forma, cuotas,
   contexto) con búsqueda web, y publícame el veredicto de cada partido.
   ```

5. Guarda. Listo: cada día, a esa hora, el análisis llega solo a la sesión.

> Documentación de las rutinas/programación: https://code.claude.com/docs/en/claude-code-on-the-web

## ¿Y si quiero "una hora antes de cada partido"?
Una sola rutina **diaria por la mañana** ya te cubre todos los partidos del día con
horas de antelación (más simple y fiable que crear una alarma por partido). Si aun
así quieres una por partido, habría que programar una tarea por cada hora de inicio.

## Probarlo ahora mismo
No hace falta esperar a la rutina: escribe **`/mundial-hoy`** en el chat y se ejecuta
al instante.
