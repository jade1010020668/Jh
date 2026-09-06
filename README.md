# Jh

Pequeñas apps web estáticas, publicadas en Netlify (cada cambio en `main` se publica solo).

## ⚽ [Pronósticos de fútbol con IA](pronosticos/) — análisis de valor para apostar con criterio

Pronósticos con datos reales en vivo (API de Claude + búsqueda web) y **cálculo de valor** frente a las cuotas de tu casa, con **stake sugerido** según tu banca y **registro de apuestas/ROI**. Enfocada en la **Liga BetPlay** (altura, empates, descenso, cuotas colombianas) y con las grandes ligas europeas.

- Elige liga y equipos (o trae la **próxima fecha de la Liga BetPlay** con un clic), ingresa tus cuotas y tu banca.
- Te dice si **hay valor** (y cuánto apostar) o si **no conviene apostar** ese partido.
- Historial con aciertos, ganancia y ROI; copiar y compartir por WhatsApp.

En línea en **https://fabulous-unicorn-235c34.netlify.app/pronosticos/**. Necesitas tu propia API key de Anthropic (se guarda solo en tu navegador). Detalles: **[pronosticos/README.md](pronosticos/README.md)**. Bot opcional para WhatsApp: **[whatsapp-bot/](whatsapp-bot/)**.

> Ninguna app garantiza ganar apostando: las casas cobran un margen en cada cuota. Esta herramienta sirve para apostar **solo con valor y con disciplina**. Juega responsable.

## 🔥 [Sala FF](sala/) — organizador de salas de Free Fire

Reemplaza los mensajes de "EQUIPO 1 / EQUIPO 2" del grupo de WhatsApp por un
enlace que se actualiza solo.

- El **admin** pone fecha, modo (1v1 a 12v12), mapa, código y contraseña de la sala.
- Cada quien **entra al enlace, escribe su nombre y escoge equipo**. Sin cuentas.
- Todo en **tiempo real**: se llena un cupo y a los demás se les actualiza al instante.
- Botones para **copiar el código**, el **enlace** y un **resumen listo para WhatsApp**.
- El admin puede **sacar** a quien no llegó; cualquiera puede **salirse solo**.

En línea en **https://fabulous-unicorn-235c34.netlify.app/sala/** (los equipos se guardan en Netlify Blobs vía `netlify/functions/sala.mjs`). Detalles y opciones: **[sala/SETUP.md](sala/SETUP.md)**.

## 🧮 [Calculadora](index.html)

Calculadora sencilla en una sola página.
