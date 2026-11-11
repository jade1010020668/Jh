# ⚽ Pronósticos de Fútbol

App web estática que calcula la probabilidad de cada resultado con **datos reales** y un **motor estadístico propio**. Funciona **gratis y sin registro**; la IA es un paso opcional. Enfocada en la **Liga BetPlay Dimayor**, con Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 y las copas (Libertadores, Sudamericana, Champions, Europa League).

En línea: **https://fabulous-unicorn-235c34.netlify.app/pronosticos/** (al fusionar el PR; antes, en la *deploy preview*).

> **Léalo antes de apostar.** Ningún pronóstico es seguro: 70% significa que falla 3 de cada 10 veces. No está demostrado que esta app le gane a las casas de apuestas, y comprobarlo tomaría años de registro. Sirve para entender un partido y para no pagar de más por una cuota.

## Cómo se usa

1. Elija la liga: aparecen los **próximos partidos** reales.
2. Toque un partido: en segundos ve las probabilidades (1X2, más/menos de 2,5, ambos anotan, marcadores más probables) y la **calidad de los datos**.
3. (Opcional) Escriba las cuotas de **dos casas** donde pueda apostar y su banca: la app dice si alguna cuota tiene valor o, lo normal, que no apueste.
4. (Opcional) **Contexto con IA**: busca bajas y rotaciones confirmadas y ajusta el pronóstico. Requiere su propia API key de Anthropic.
5. **Seguimiento**: cada pronóstico queda guardado (con las cuotas que usted escribió, que reaparecen si vuelve al partido); después del partido la app busca el marcador y mide sus aciertos frente al mercado.

Las cuotas se pueden escribir con coma o con punto (`2,35` o `2.35`) y la banca con o sin puntos de miles (`500.000` o `500000`): la app muestra el número que entendió.

## De dónde sale cada número

| Pieza | Qué es |
|---|---|
| **Datos** | Calendario, tabla con desglose local/visitante, torneo anterior, últimos partidos y cuotas de referencia (DraftKings o Bet 365, según la liga), leídos en vivo de la API pública de ESPN (no oficial). No hay listas de equipos que mantener. En cuadrangulares y finales se usa la tabla de la **fase regular**, no la del grupo de cuatro. Si la red del usuario bloquea esa fuente, la consulta se repite por una función del propio sitio (`/api/datos`). |
| **Mercado** | Las cuotas sin el margen de la casa (método de Shin en el 1X2; aditivo en el más/menos). Varias casas se combinan por media geométrica; las que comparten proveedor cuentan una vez. |
| **Modelo de goles** | Poisson con corrección de Dixon-Coles. La fuerza de ataque y defensa de cada equipo se estima con sus goles, **encogida hacia el promedio** según el tamaño de la muestra, sumando el torneo anterior y un sobrepeso de los últimos 5 partidos de liga. |
| **Pronóstico final** | `mercado^(1−w) · modelo^w`, con `w` máximo de 0,20 en el 1X2. Si modelo y mercado difieren más de 5 puntos, `w` baja a la mitad; más de 10, `w = 0` (manda el mercado). En goles totales (Liga BetPlay) el modelo no pesa: manda el mercado. |
| **Coherencia** | Se ajusta una matriz de marcadores al 1X2 y al más/menos finales; de ella salen "ambos anotan" y los marcadores exactos. |
| **Contexto (IA)** | Solo cuenta lo *confirmado* cuya fuente es una página que la búsqueda realmente devolvió. Cada novedad mueve los goles esperados 4–5%, con tope total de 10%. |

## Qué tan bien pronostica: prueba con partidos reales

`node tools/backtest/backtest.js` recorre **1.494 partidos** de la Liga BetPlay 2023-2026 (fase todos contra todos). En cada fecha el modelo pronostica usando solo lo ocurrido antes; después se compara con el resultado. Tres decisiones (el peso del torneo anterior, la fracción de goles del local y no usar el desglose local/visitante) se tomaron mirando 2023-24; el resto son valores de partida sin optimizar. 2025-26 no se usó para decidir nada. Con parámetros buscados solo en 2023-24 (`--buscar`), el error en 2025-26 es 0,1989 frente a 0,2147 del pronóstico fijo: prácticamente lo mismo que con los publicados.

| | Modelo de goles | Pronóstico fijo 47/30/23 |
|---|---|---|
| Error RPS, todo 2023-26 (menor es mejor) | **0,2008** | 0,2140 |
| Error RPS, validación 2025-26 | **0,1983** | 0,2147 |
| Log-loss, todo | **1,013** | 1,054 |
| Acierto del favorito | 48,4% | 47,3% (siempre local) |

- La mejora sobre el pronóstico fijo no es casualidad (intervalo del 98% de la diferencia: −0,018 a −0,008).
- **Calibración:** en promedio pronosticó 47,6 / 29,0 / 23,4 y ocurrió 47,3 / 29,5 / 23,3. Por tramos, en 2025-26 lo ocurrido quedó entre 1 y 7 puntos de lo pronosticado: dijo 52% y ocurrió 46% (94 partidos); dijo 57% y ocurrió 61% (103); dijo 67% y ocurrió 69% (149).
- **Lo que la prueba enseñó** (y cambió en el motor): usar el desglose local/visitante de cada equipo *empeoraba* el pronóstico (muy pocos partidos por condición); el torneo anterior merece el mismo peso que el actual; la ventaja de localía era algo mayor de lo supuesto; y en "más/menos de 2,5" el modelo **no supera** al promedio de la liga.
- **Lo que la prueba no puede decir:** si el modelo le gana a las casas de apuestas. No hay historial público de cuotas para comprobarlo, y lo esperable es que las casas sean mejores. Por eso el pronóstico final se apoya sobre todo en ellas, y por eso existe el seguimiento.

Los parámetros que siguen marcados `[M]` en `engine.js` (el peso del modelo frente al mercado y todos los de las ligas europeas) no tienen prueba propia.

## Cuándo recomienda apostar (casi nunca)

Todas estas condiciones a la vez: cuotas de **dos casas independientes** escritas por usted, **las dos** hace menos de 6 horas; calidad de datos Completa o Parcial; la cuota paga al menos **+3%** sobre el consenso de sus propias casas **y** sobre el pronóstico final (se toma el menor), pero no más de +10% (más suele ser un error de tecleo); el margen de cada casa es normal (al menos 3% en el 1X2) y los dos se parecen (una cuota mal copiada hacia arriba deja un margen anormalmente bajo); sus cuotas no contradicen a las de referencia del mercado (si lo hacen, casi siempre son de otro partido o están en otro orden); modelo y mercado no discrepan en más de 10 puntos; cuota ≤ 6. La recomendación se revisa sola cada minuto: desaparece cuando las cuotas envejecen o empieza el partido. Monto: Kelly 1/4 con tope del **1% de la banca**, redondeado hacia abajo a $1.000; una sola apuesta por partido. Nunca recomienda combinadas, marcador exacto ni "ambos anotan".

El valor que detecta viene de que **su casa paga más que las otras**, no de que la app sepa más que el mercado.

## Seguimiento honesto

- Se guarda el último pronóstico visto hasta 5 minutos antes del partido; después ya no se modifica.
- Con menos de 100 partidos resueltos se muestra la lista y "todavía es ruido": no hay conteo de aciertos ni colores de ganancia.
- En partidos con prórroga o penales cuenta el marcador de los **90 minutos**; si la fuente no permite saberlo, la app pide escribirlo.
- Desde 100: aciertos del favorito junto a los que se esperaban, calibración y, si al menos 100 partidos tienen cuotas guardadas, diferencia de RPS frente al mercado con intervalo del 98% (bootstrap).
- Ganancias y pérdidas de las apuestas se muestran como hechos, con la advertencia de que hacen falta cientos para distinguir habilidad de suerte.

## Privacidad y seguridad

- Sin servidor propio ni cuentas: todo se guarda en su navegador (`localStorage`).
- La página solo puede conectarse a ESPN (datos), al propio sitio (respaldo de datos) y a Anthropic (IA opcional), por su política de seguridad de contenido (CSP). A ESPN no se le envía ningún dato suyo; la API key solo va a Anthropic.
- El respaldo (`netlify/functions/espn.mjs`) solo acepta las cuatro consultas de fútbol que usa la app; no sirve como proxy abierto y no recibe datos del usuario.
- Todo dato externo se muestra como texto. El análisis de la IA pasa por un renderizador que escapa el HTML y valida los enlaces.

## Límites conocidos

- La fuente de datos es una API **no oficial**: puede cambiar o caerse. Si falla, la app lo dice y no inventa nada.
- Las cuotas de referencia son de una casa internacional; las de su casa pueden diferir.
- El modelo no conoce lesiones ni rotaciones por sí solo, y los cuadrangulares, finales y copas se parecen menos a la fase regular: ahí la calidad de datos baja. La lectura de la tabla en cuadrangulares se probó con las respuestas reales de 2025; la de los cuadrangulares de 2026 no se puede comprobar hasta que empiecen.
- Sin cuotas, en la Liga BetPlay el pronóstico sale solo del modelo y la calidad es "Parcial"; en las demás ligas, "Pobre" (su modelo no tiene prueba propia).
- La comprobación de fuentes de la IA verifica que la página fue devuelta por la búsqueda y que no tiene más de 14 días (cuando el buscador da la fecha), no que diga exactamente lo que la IA resume.
- El paso de IA solo se ha probado con respuestas simuladas, no con una API key real.

## Archivos

```
index.html   Página (estilos incluidos)
boot.js      Muestra un aviso en pantalla si la app no logra arrancar (navegador muy antiguo)
leagues.js   Ligas disponibles y altitud de las sedes colombianas
engine.js    Motor: modelo de goles, cuotas sin margen, mezcla, reglas de apuesta, métricas
data.js      Lectura y validación de datos (ESPN) e instrucciones para la IA
app.js       Interfaz, llamada opcional a la IA y seguimiento
```

Fuera de esta carpeta: `netlify/functions/espn.mjs` (respaldo de datos).

Pruebas (sin dependencias): `node tests/run.js` desde la raíz del repositorio. Incluyen vectores calculados por dos implementaciones independientes, un ejemplo numérico completo, respuestas reales guardadas de la fuente de datos, la app real manejada con una página simulada y la prueba retrospectiva como guardián. Datos históricos: `tools/backtest/col1-2023-2026.json` (Wikipedia en español, CC BY-SA 4.0).

Para verla en local: `python3 -m http.server 8000` en la raíz y abrir `http://localhost:8000/pronosticos/`.
