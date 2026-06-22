---
name: mundial-hoy
description: Analiza los partidos del Mundial 2026 que se juegan HOY (base matemática Elo/Poisson del repo + multifactor con búsqueda web) y publica el veredicto en el chat. Pensado para ejecutarse solo, como rutina diaria programada. Úsalo cuando el usuario pida el análisis del día, "los partidos de hoy", o cuando lo dispare una rutina.
---

# Análisis diario del Mundial 2026

Tu objetivo: producir, en el chat, un **análisis multifactor** de los partidos que
se juegan **hoy**, combinando la base matemática del repo con búsqueda web en vivo.
Sé conciso y honesto (son estimaciones probabilísticas, no certezas).

## Pasos (síguelos en orden, siempre igual)

1. **Fecha de hoy.** Obtén la fecha actual (UTC) con `date -u +%Y-%m-%d`.

2. **Partidos de hoy.** Busca en la web los partidos del **Mundial 2026** que se
   juegan en esa fecha (p. ej. "FIFA World Cup 2026 matches today <fecha>
   schedule"). Quédate con: equipos, hora y sede. Si no hay partidos hoy, dilo en
   una línea y termina.

3. **Base matemática (motor del repo).** Para cada partido, ejecuta:
   `node bot/analyze-match.js "<Local>" "<Visitante>"`
   Usa los **nombres en español de `js/data.js`** (ej.: "Corea del Sur", "Chequia",
   "Países Bajos", "Estados Unidos", "Türkiye", "RD del Congo", "Arabia Saudita",
   "Cabo Verde", "Costa de Marfil"). Si el script dice "Equipo desconocido", elige
   el nombre correcto de la lista que imprime.

4. **Multifactor (búsqueda web).** Para cada partido, investiga y pondera:
   lesiones/suspensiones confirmadas, forma reciente y alineación probable, cuotas
   del mercado, y contexto físico (altitud, clima, viajes/fatiga). Ajusta la lectura
   de la base de forma **moderada** (±25 % como mucho): la base manda, tú afinas.
   Si la info no es fiable, no ajustes.

5. **Veredicto.** Publica en el chat, por cada partido: marcador más probable, 1X2
   (con el aviso ⚖️ de empate si el script lo marcó), el/los factor(es) decisivos
   y una frase de "qué pasa". Cierra con: "Estimación probabilística, no certeza. +18".

6. **(Opcional) Registrar.** Si quieres medir aciertos luego, añade cada predicción
   a `bot/results.json` (campos `home`, `away`, `pred`, `actual:null`) y al día
   siguiente rellena `actual` con el resultado; `npm run scoreboard` lo evalúa.

## Notas
- No inventes datos: si dudas de un nombre o una hora, búscalo o dilo.
- Mantén el mensaje corto y legible (es para leer en el móvil).
- Esto NO usa WhatsApp ni apps externas: el análisis vive aquí, en el chat.
