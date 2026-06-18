# ⚽ Predictor Mundial 2026

Herramienta web de **análisis probabilístico** para los partidos del Mundial
de fútbol 2026 (Canadá · México · EE. UU.). No "adivina" resultados: calcula
**probabilidades bien calibradas** usando los modelos matemáticos de referencia
en el análisis deportivo y detecta **apuestas de valor (+EV)**.

> ⚠️ **Aviso importante.** Ninguna herramienta predice partidos con 100 % de
> acierto — es matemáticamente imposible por la enorme varianza del fútbol.
> Esto **no garantiza ganancias** ni es asesoría financiera. Las casas de
> apuestas tienen ventaja por su margen. Apuesta solo lo que puedas permitirte
> perder y juega con responsabilidad (+18).

## ¿Qué hace?

- **🎯 Analizar partido** — elige dos selecciones y obtén goles esperados (λ),
  probabilidades 1X2, Over/Under 2.5, Ambos Marcan y los marcadores más probables.
- **💰 Detección de valor + Kelly** — introduce las cuotas de tu casa y la app
  marca solo las apuestas con valor esperado positivo, con el *stake*
  recomendado por el Criterio de Kelly fraccionado.
- **🏆 Simular Mundial** — Montecarlo del torneo completo (miles de veces) para
  estimar la probabilidad de cada selección de avanzar, llegar a cuartos,
  semis, final y ser **campeona**.
- **📊 Ratings Elo editables** — ajusta la fuerza de cada selección; se guarda
  en tu navegador.
- **📐 Metodología** — explicación honesta de cada modelo.

## Modelos implementados

| Modelo | Para qué sirve |
|---|---|
| **Elo** (World Football Elo) | Fuerza relativa de cada selección |
| **Elo → λ (goles esperados)** | Puente entre rating y modelo de goles |
| **Poisson + Dixon-Coles (1997)** | Matriz de marcadores → 1X2 / O-U / BTTS |
| **Montecarlo** | Simulación del torneo y cuantificación de la "suerte" |
| **Quita de margen + EV** | Detectar cuándo una cuota tiene valor real |
| **Criterio de Kelly** | Cuánto apostar para crecer sin arruinarse |
| **Brier / RPS** | Métricas de calibración del modelo |

## Uso

Es una web estática, sin dependencias ni servidor. Abre `index.html` en el
navegador (o publícala con GitHub Pages).

```
index.html          App principal (Predictor Mundial 2026)
calculadora.html    Calculadora previa (conservada)
css/styles.css      Estilos
js/data.js          Equipos, grupos y ratings Elo (sorteo final FIFA)
js/models.js        Motor matemático (Elo, Poisson, Dixon-Coles, Kelly, RPS)
js/simulation.js    Simulación de Montecarlo del torneo
js/app.js           Interfaz
test_node.js        Pruebas del motor:  node test_node.js
```

## Pruebas

```bash
node test_node.js
```

## La verdad honesta

El mercado de apuestas ya es muy eficiente; batirlo de forma sostenida es
extremadamente difícil. Un buen modelo de 1X2 acierta ~50–55 % de los
resultados, lejísimos del "100 %". La única ventaja real —si existe— es
pequeña y solo se materializa con disciplina, gestión de banca y muchas
apuestas, nunca con una sola jugada "segura". Usa esto como herramienta de
**análisis y aprendizaje**.
