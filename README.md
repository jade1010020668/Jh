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

## 🎓 [Grupo 3 «El mejor grupo»](grupo/) — tablero del grupo de estudio

Un solo lugar para el grupo de la especialización:

- **Fechas** de entregas, parciales y reuniones con **alarmas** (en la app, en el
  navegador y en el calendario del celular).
- **Archivos** (soluciones de parciales, guías, entregas) y **links** para todos.
- **Muro** de mensajes y comentarios en cada fecha.
- **Datos de contacto** de cada integrante, con botón de WhatsApp.

Es un solo tablero, sin cuentas: quien tiene el enlace entra y ve todo.

En línea en **https://fabulous-unicorn-235c34.netlify.app/grupo/** (los datos y archivos se guardan en Netlify Blobs vía `netlify/functions/grupo.mjs`). Detalles: **[grupo/SETUP.md](grupo/SETUP.md)**.

## 🧮 [Calculadora](index.html)

Calculadora sencilla en una sola página.
