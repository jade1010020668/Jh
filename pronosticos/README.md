# ⚽ Pronósticos de Fútbol

App web estática que calcula la probabilidad de cada resultado con **datos reales** y un **motor estadístico propio**. Funciona **gratis y sin registro**; la IA es un paso opcional. Enfocada en la **Liga BetPlay Dimayor**, con Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 y las copas (Libertadores, Sudamericana, Champions, Europa League).

En línea: **https://fabulous-unicorn-235c34.netlify.app/pronosticos/** (al fusionar el PR; antes, en la *deploy preview*).

> **Léalo antes de apostar.** Ningún pronóstico es seguro: 70% significa que falla 3 de cada 10 veces. No está demostrado que esta app le gane a las casas de apuestas, y comprobarlo tomaría años de registro. Sirve para entender un partido y para no pagar de más por una cuota.

## Cómo se usa

1. Elija la liga: aparecen los **próximos partidos** reales.
2. Toque un partido: en segundos ve las probabilidades (1X2, más/menos de 2,5, ambos anotan, marcadores más probables) y la **calidad de los datos**.
3. (Opcional) Escriba las cuotas de **dos casas** donde pueda apostar y su banca: la app dice si alguna cuota tiene valor o, lo normal, que no apueste.
4. (Opcional) **Contexto con IA**: busca bajas y rotaciones confirmadas y ajusta el pronóstico. Requiere su propia API key de Anthropic.
5. **Seguimiento**: cada pronóstico queda guardado; después del partido la app busca el marcador y mide sus aciertos frente al mercado.

## De dónde sale cada número

| Pieza | Qué es |
|---|---|
| **Datos** | Calendario, tabla con desglose local/visitante, torneo anterior, últimos partidos y cuotas de referencia, leídos en vivo de la API pública de ESPN (no oficial). No hay listas de equipos que mantener. |
| **Mercado** | Las cuotas sin el margen de la casa (método de Shin en el 1X2; aditivo en el más/menos). Varias casas se combinan por media geométrica; las que comparten proveedor cuentan una vez. |
| **Modelo de goles** | Poisson con corrección de Dixon-Coles. La fuerza de ataque y defensa de cada equipo se estima con sus goles, **encogida hacia el promedio** según el tamaño de la muestra, sumando el torneo anterior y un sobrepeso de los últimos 5 partidos de liga. |
| **Pronóstico final** | `mercado^(1−w) · modelo^w`, con `w` máximo de 0,20 en el 1X2. Si modelo y mercado difieren más de 5 puntos, `w` baja a la mitad; más de 10, `w = 0` (manda el mercado). En goles totales (Liga BetPlay) el modelo no pesa: manda el mercado. |
| **Coherencia** | Se ajusta una matriz de marcadores al 1X2 y al más/menos finales; de ella salen "ambos anotan" y los marcadores exactos. |
| **Contexto (IA)** | Solo cuenta lo *confirmado* cuya fuente es una página que la búsqueda realmente devolvió. Cada novedad mueve los goles esperados 4–5%, con tope total de 10%. |

## Qué tan bien pronostica: prueba con partidos reales

`node tools/backtest/backtest.js` recorre **1.494 partidos** de la Liga BetPlay 2023-2026 (fase todos contra todos). En cada fecha el modelo pronostica usando solo lo ocurrido antes; después se compara con el resultado. Los parámetros se ajustaron con 2023-24 y se validaron con 2025-26, que el ajuste no vio.

| | Modelo de goles | Pronóstico fijo 47/30/23 |
|---|---|---|
| Error RPS, todo 2023-26 (menor es mejor) | **0,2008** | 0,2140 |
| Error RPS, validación 2025-26 | **0,1983** | 0,2147 |
| Log-loss, todo | **1,013** | 1,054 |
| Acierto del favorito | 48,4% | 47,3% (siempre local) |

- La mejora sobre el pronóstico fijo no es casualidad (intervalo del 98% de la diferencia: −0,018 a −0,008).
- **Calibración:** en promedio pronosticó 47,6 / 29,0 / 23,4 y ocurrió 47,3 / 29,5 / 23,3. En 2025-26, cuando dio 67% al favorito, este ganó el 69%.
- **Lo que la prueba enseñó** (y cambió en el motor): usar el desglose local/visitante de cada equipo *empeoraba* el pronóstico (muy pocos partidos por condición); el torneo anterior merece el mismo peso que el actual; la ventaja de localía era algo mayor de lo supuesto; y en "más/menos de 2,5" el modelo **no supera** al promedio de la liga.
- **Lo que la prueba no puede decir:** si el modelo le gana a las casas de apuestas. No hay historial público de cuotas para comprobarlo, y lo esperable es que las casas sean mejores. Por eso el pronóstico final se apoya sobre todo en ellas, y por eso existe el seguimiento.

Los parámetros que siguen marcados `[M]` en `engine.js` (el peso del modelo frente al mercado y todos los de las ligas europeas) no tienen prueba propia.

## Cuándo recomienda apostar (casi nunca)

Todas estas condiciones a la vez: cuotas de **dos casas independientes** escritas por usted hace menos de 6 horas; calidad de datos Completa o Parcial; la cuota paga al menos **+3%** sobre el consenso de sus propias casas **y** sobre el pronóstico final (se toma el menor); la diferencia entre casas no supera 10% (más suele ser un error de tecleo); modelo y mercado no discrepan en más de 10 puntos; cuota ≤ 6. Monto: Kelly 1/4 con tope del **1% de la banca**, redondeado hacia abajo a $1.000; una sola apuesta por partido. Nunca recomienda combinadas, marcador exacto ni "ambos anotan".

El valor que detecta viene de que **su casa paga más que las otras**, no de que la app sepa más que el mercado.

## Seguimiento honesto

- Se guarda el último pronóstico visto hasta 5 minutos antes del partido; después ya no se modifica.
- Con menos de 100 partidos resueltos solo se muestra la lista y "todavía es ruido".
- Desde 100: diferencia de RPS frente al mercado con intervalo del 98% (bootstrap) y calibración del favorito.
- Ganancias y pérdidas de las apuestas se muestran como hechos, con la advertencia de que hacen falta cientos para distinguir habilidad de suerte.

## Privacidad y seguridad

- Sin servidor propio ni cuentas: todo se guarda en su navegador (`localStorage`).
- La página solo puede conectarse a ESPN (datos) y a Anthropic (IA opcional), por su política de seguridad de contenido (CSP). A ESPN no se le envía ningún dato suyo; la API key solo va a Anthropic.
- Todo dato externo se muestra como texto. El análisis de la IA pasa por un renderizador que escapa el HTML y valida los enlaces.

## Límites conocidos

- La fuente de datos es una API **no oficial**: puede cambiar o caerse. Si falla, la app lo dice y no inventa nada.
- Las cuotas de referencia son de una casa internacional; las de su casa pueden diferir.
- El modelo no conoce lesiones ni rotaciones por sí solo, y los cuadrangulares, finales y copas se parecen menos a la fase regular: ahí la calidad de datos baja.
- La comprobación de fuentes de la IA verifica que la página fue devuelta por la búsqueda, no que diga exactamente lo que la IA resume.

## Archivos

```
index.html   Página (estilos incluidos)
leagues.js   Ligas disponibles y altitud de las sedes colombianas
engine.js    Motor: modelo de goles, cuotas sin margen, mezcla, reglas de apuesta, métricas
data.js      Lectura y validación de datos (ESPN) e instrucciones para la IA
app.js       Interfaz, llamada opcional a la IA y seguimiento
```

Pruebas (sin dependencias): `node tests/run.js` desde la raíz del repositorio. Incluyen vectores calculados por dos implementaciones independientes, un ejemplo numérico completo, respuestas reales guardadas de la fuente de datos, la app real manejada con una página simulada y la prueba retrospectiva como guardián. Datos históricos: `tools/backtest/col1-2023-2026.json` (Wikipedia en español, CC BY-SA 4.0).

Para verla en local: `python3 -m http.server 8000` en la raíz y abrir `http://localhost:8000/pronosticos/`.
