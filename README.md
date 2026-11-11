# Jh

Pequeñas apps web estáticas, publicadas en Netlify (cada cambio en `main` se publica solo). La **portada** del sitio (`index.html`) enlaza a las tres: https://fabulous-unicorn-235c34.netlify.app/

## ⚽ [Pronósticos de fútbol](pronosticos/) — probabilidades con datos reales y un motor estadístico

Elija un partido de la **Liga BetPlay** (o de las grandes ligas) y vea al instante la probabilidad de cada resultado, calculada con la tabla y los resultados reales de cada equipo, un modelo de goles y las cuotas del mercado sin su margen. **Gratis, sin registro y sin IA obligatoria.**

- Dice con franqueza qué tan bien respaldado está cada número ("calidad de los datos").
- Si usted escribe las cuotas de dos casas, indica si alguna tiene valor; lo normal es que recomiende **no apostar**.
- Guarda cada pronóstico y **mide sus propios aciertos** frente al mercado.
- Paso opcional con IA para bajas y rotaciones confirmadas.

En línea en **https://fabulous-unicorn-235c34.netlify.app/pronosticos/**. Detalles: **[pronosticos/README.md](pronosticos/README.md)**. Bot opcional que envía el pronóstico por WhatsApp antes de cada partido: **[whatsapp-bot/](whatsapp-bot/)**. Pruebas: `node tests/run.js`.

> Ninguna app garantiza ganar apostando. Juegue con responsabilidad.

## 🔥 [Sala FF](sala/) — organizador de salas de Free Fire

Reemplaza los mensajes de "EQUIPO 1 / EQUIPO 2" del grupo de WhatsApp por un
enlace que se actualiza solo.

- El **admin** pone fecha, modo (1v1 a 12v12), mapa, código y contraseña de la sala.
- Cada quien **entra al enlace, escribe su nombre y escoge equipo**. Sin cuentas.
- Todo en **tiempo real**: se llena un cupo y a los demás se les actualiza al instante.
- Botones para **copiar el código**, el **enlace** y un **resumen listo para WhatsApp**.
- El admin puede **sacar** a quien no llegó; cualquiera puede **salirse solo**.

En línea en **https://fabulous-unicorn-235c34.netlify.app/sala/** (los equipos se guardan en Netlify Blobs vía `netlify/functions/sala.mjs`). Detalles y opciones: **[sala/SETUP.md](sala/SETUP.md)**.

## 🧮 [Calculadora](calculadora/)

Calculadora sencilla en una sola página.
