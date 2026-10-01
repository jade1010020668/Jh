# Jh

Pequeñas apps web estáticas, publicadas con GitHub Pages.

## 🔥 [Sala FF](sala/) — organizador de salas de Free Fire

Reemplaza los mensajes de "EQUIPO 1 / EQUIPO 2" del grupo de WhatsApp por un
enlace que se actualiza solo.

- El **admin** pone fecha, modo (1v1 a 12v12), mapa, código y contraseña de la sala.
- Cada quien **entra al enlace, escribe su nombre y escoge equipo**. Sin cuentas.
- Todo en **tiempo real**: se llena un cupo y a los demás se les actualiza al instante.
- Botones para **copiar el código**, el **enlace** y un **resumen listo para WhatsApp**.
- El admin puede **sacar** a quien no llegó; cualquiera puede **salirse solo**.

En línea en **https://fabulous-unicorn-235c34.netlify.app/sala/** (Netlify publica solo cada cambio en `main`; los equipos se guardan en Netlify Blobs vía `netlify/functions/sala.mjs`). Detalles y opciones: **[sala/SETUP.md](sala/SETUP.md)**.

## 🎓 [Grupo CUN](grupo-cun/) — app del grupo de estudio

Fechas de entregas y parciales con alarmas, archivos (soluciones de parciales,
guías), links, muro de mensajes y datos de contacto de cada integrante. Es una app
Python (Flask) para montar en **Render** o **Hugging Face Spaces** con una base de
datos gratis en Neon. Cómo montarla: **[grupo-cun/README.md](grupo-cun/README.md)**.

## 🧮 [Calculadora](index.html)

Calculadora sencilla en una sola página.
