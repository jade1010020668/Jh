# 🧠 Cómo la rutina analiza cada partido (paso a paso)

Este documento explica **exactamente** qué hace la rutina (`bot/predict.js`,
usando `js/models.js`) para convertir dos selecciones en el marcador probable
que te llega por WhatsApp. Nada de magia: es estadística aplicada.

Lo ilustramos con un ejemplo real calculado por el propio motor:
**🇦🇷 Argentina (Elo 1890) vs 🇧🇷 Brasil (Elo 1765)**.

---

## Paso 0 — Entrada
La rutina toma del calendario (`fixtures.json`) los **dos equipos** y la **hora**
del partido. Cuando faltan ~60 minutos, arranca el análisis.

```
Argentina  vs  Brasil
```

---

## Paso 1 — Fuerza de cada selección (rating Elo)
Cada selección tiene un número **Elo** que resume su fuerza (de `js/data.js`,
editable). Cuanto más alto, mejor.

```
Argentina = 1890     Brasil = 1765
```

---

## Paso 2 — Ventaja de localía (solo anfitriones)
México, EE. UU. y Canadá reciben un bonus de **+45 Elo** cuando juegan de local
(están en su país). En el resto de partidos, el campo es neutral y no se aplica.

> En este ejemplo no aplica (ninguno es anfitrión).

---

## Paso 3 — De Elo a "goles esperados" (λ) — modelo log-lineal
La diferencia de Elo se convierte en **goles esperados** de cada equipo (λ,
*lambda*) con el modelo multiplicativo de Maher (1982), el estándar del fútbol:

```
d  = (Elo_local + localía − Elo_visita) × sensibilidad
μ  = ln( goles_base / 2 )                 (goles_base ≈ 2.65)

λ_local  = e^(μ + d)
λ_visita = e^(μ − d)
```

Con los números del ejemplo (sensibilidad = 0.0017):

```
d  = (1890 − 1765) × 0.0017 = 0.2125
μ  = ln(2.65 / 2)           = 0.2814

λ_local  (Argentina) = e^(0.2814 + 0.2125) = 1.64 goles esperados
λ_visita (Brasil)    = e^(0.2814 − 0.2125) = 1.07 goles esperados
```

**Por qué este modelo y no una resta simple:** garantiza que λ nunca sea
negativo y hace que las **goleadas tengan más goles totales** (como en la vida
real), porque el producto de las λ se mantiene y la suma crece con el desajuste.

---

## Paso 3.5 — 🩹 Ajuste por LESIONES y SUSPENSIONES (Opus 4.8 + búsqueda web)
Aquí entra la parte **híbrida**. La base matemática (pasos 1-3) solo "ve" la
fuerza histórica (Elo). Para meter lo que pasa **hoy**, **Opus 4.8** busca en la
web las **bajas confirmadas** (lesionados y sancionados) de ambas selecciones
para ESTE partido, y devuelve un **ajuste acotado** a los goles esperados de
cada equipo, con un procedimiento fijo (mismo prompt, misma lista de factores).

```
λ_local  ← λ_local  × (1 + ajuste_local%/100)
λ_visita ← λ_visita × (1 + ajuste_visita%/100)        con cada ajuste ∈ [−25%, +25%]
```

- Si falta una estrella o varios titulares de un equipo → su λ **baja**.
- Un rival muy debilitado puede subir **ligeramente** la λ del otro.
- Si no hay bajas claras o la info no es fiable → **ajuste 0**.
- El tope de **±25 %** es a propósito: **la base matemática sigue mandando**;
  el LLM solo "empuja". Por eso el análisis es **casi siempre igual** (mismo
  método), aunque los números se actualicen con las noticias del día.

> Sin `ANTHROPIC_API_KEY` (o si la red falla), este paso se **omite** y se usa
> solo el modelo matemático determinista. La rutina nunca se rompe por esto.

*(En el ejemplo Argentina–Brasil seguimos sin ajuste para que los números de
abajo coincidan con el modelo base.)*

---

## Paso 4 — Probabilidad de cada cantidad de goles (Poisson)
Los goles de un equipo siguen una **distribución de Poisson** con su λ. Es decir,
calculamos la probabilidad de que cada equipo marque 0, 1, 2, 3… goles:

```
P(k goles) = e^(−λ) × λ^k / k!
```

| Goles | Argentina (λ=1.64) | Brasil (λ=1.07) |
|:--:|:--:|:--:|
| 0 | 19.4% | 34.3% |
| 1 | 31.8% | 36.7% |
| 2 | 26.1% | 19.7% |
| 3 | 14.2% | 7.0% |

---

## Paso 5 — Corrección Dixon-Coles (marcadores bajos)
El Poisson "puro" subestima ligeramente los empates 0-0 y 1-1 y sobreestima el
1-0 / 0-1. La corrección de **Dixon-Coles (1997)** ajusta justo esas cuatro
casillas con un parámetro `ρ`, para acercar el modelo a la realidad del fútbol.

---

## Paso 6 — Matriz de marcadores
Combinamos ambos equipos: la probabilidad de un marcador concreto (p. ej. 2-1)
es `P(local marca 2) × P(visita marca 1)`, ya con la corrección anterior. Eso
genera una **matriz** con la probabilidad de **todos** los marcadores posibles.

Marcadores más probables del ejemplo:

```
1-1 → 12.4%      2-0 → 8.9%
1-0 → 10.2%      0-0 → 7.4%
2-1 →  9.6%      0-1 → 6.4%
```

👉 **El "marcador más probable" que te llega por WhatsApp es el de arriba: 1-1.**
Pero fíjate: ¡solo tiene un 12.4%! El otro ~88% de las veces sale otra cosa.
**Eso es la incertidumbre real del fútbol** (lo que llamas "suerte").

---

## Paso 7 — Mercados derivados de la matriz
Sumando casillas de la matriz salen las probabilidades de los mercados típicos:

| Mercado | Cómo se calcula | Ejemplo |
|---|---|---|
| **Gana Argentina** | suma de marcadores con local > visita | **49.9%** |
| **Empate** | suma de marcadores iguales | **26.0%** |
| **Gana Brasil** | suma de marcadores con visita > local | **24.1%** |
| **Más de 2.5 goles** | marcadores con 3+ goles totales | **50.9%** |
| **Ambos marcan** | marcadores con ambos ≥ 1 | **53.7%** |

---

## Paso 8 — (Opcional) Valor frente a las cuotas
Si le das cuotas de tu casa, el motor les quita el **margen** con el método de
**Shin (1992)** y compara con nuestra probabilidad. Solo si **tu probabilidad
supera la implícita** hay *valor* (+EV), y el **Criterio de Kelly** sugiere
cuánto apostar. *(Esto vive en la web; la rutina de WhatsApp manda el marcador;
si quieres, puedo añadir el cálculo de valor también al mensaje.)*

---

## El mensaje final
Con todo lo anterior, el WhatsApp que recibes 1 hora antes es:

```
⚽ MUNDIAL 2026 — falta ~1 hora (21:00 UTC)
Argentina vs Brasil

🔮 Marcador más probable: 1-1 (12%)
📊 Argentina: 50% · Empate: 26% · Brasil: 24%
⚽ +2.5 goles: 51% · Ambos marcan: 54%
🎲 Otros marcadores: 1-0, 2-1, 2-0
🩹 Bajas: sin lesiones/sanciones relevantes en ambos equipos
⚠️ Estimación probabilística (base Elo/Poisson + Opus 4.8 por lesiones). +18
```

La línea **🩹 Bajas** solo aparece cuando el ajuste de Opus 4.8 está activo
(hay `ANTHROPIC_API_KEY`); si no, el mensaje muestra solo el modelo matemático.

---

## Resumen del flujo

```
Equipos → Elo → (+localía) → λ goles esperados (log-lineal)
       → 🩹 AJUSTE Opus 4.8 por lesiones/suspensiones (web, acotado ±25%)
       → Poisson por equipo → Dixon-Coles → MATRIZ de marcadores
       → marcador más probable + 1X2 + Over/Under + Ambos marcan
       → (opcional) valor con Shin + Kelly
       → mensaje de WhatsApp
```

## Honestidad
- El "marcador más probable" rara vez supera el ~12-15%: es el más frecuente,
  **no el seguro**.
- La calidad depende de los **Elo** (edítalos en `js/data.js` para afinar).
- Limitación conocida: un solo Elo **mezcla ataque y defensa**; un modelo ideal
  los separaría, pero exige más datos. Aquí prima la robustez y que tú ajustes.
- El **ajuste por lesiones (Opus 4.8)** es tan bueno como la información pública
  que encuentre, y es **acotado a ±25 %** para no sobrerreaccionar. No es
  determinista al 100 % (depende de noticias en vivo), pero sigue **siempre el
  mismo procedimiento**: por eso el método es estable aunque los datos cambien.
- Esto **no garantiza ganar dinero**. Es análisis, no una bola de cristal.
```
