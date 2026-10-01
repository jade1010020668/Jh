# Grupo CUN — cómo funciona en línea

## Enlace

```
https://fabulous-unicorn-235c34.netlify.app/grupo/
```

Es **un solo tablero para el grupo**. No hay cuentas ni contraseñas: quien abre el
enlace entra y ve todo. Pásenlo solo por el chat del grupo.

El repo está conectado a **Netlify**: cada vez que algo llega a `main`, se publica
solo en un minuto. Todo lo que el grupo escribe o sube (fechas, mensajes, datos de
los integrantes y archivos) se guarda en **Netlify Blobs**, la nube de Netlify, a
través de la función `netlify/functions/grupo.mjs`. No se pierde aunque se vuelva a
publicar el sitio.

## Primera vez

1. Abre el enlace. Arriba sale **¿Quién eres?**: escribe tu nombre. Solo sirve para
   firmar lo que publicas y se recuerda en ese navegador. Se puede cambiar tocando
   tu nombre en el menú.
2. En **Integrantes**, cada quien agrega o corrige sus datos (WhatsApp, correo,
   cumpleaños, horarios). Cualquiera puede agregar a los demás.
3. Toca **Activar alarmas** para que el navegador avise de las entregas.
4. En **Calendario**, copia el enlace de suscripción a tu Google Calendar o iPhone
   para tener los recordatorios en el celular.

## Qué trae

- **Fechas** (entregas, parciales, reuniones, clases) con materia, detalles, link
  y comentarios. Cualquiera puede crear, editar, marcar como lista o borrar.
- **Alarmas**: en el inicio, lo vencido en rojo, lo de hoy y los próximos 3 días en
  naranja, lo de la semana en amarillo. El menú cuenta lo urgente.
  - Aviso del navegador 1 día antes, 2 horas antes y al vencerse, mientras la app
    esté abierta en alguna pestaña.
  - Calendario `.ics` con recordatorios (1 día y 2 horas antes) para el celular.
  - Botones «Agregar a mi Google Calendar» y «Avisar por WhatsApp» en cada fecha.
- **Archivos y links**: soluciones de parciales, entregas, guías, material. PDFs e
  imágenes se abren en el navegador. Hasta **4 MB por archivo** (límite de las
  funciones de Netlify); lo más pesado, en Drive y se guarda el link.
- **Muro** con mensajes fijados que salen en el inicio.
- **Integrantes**: correo, teléfono, WhatsApp, cumpleaños y una nota libre.
- **Calendario** del mes. El nombre del tablero se cambia en *Integrantes*.

La página se actualiza sola cada 30 segundos con lo que suban los demás.

## Privacidad

Como no hay contraseña, **cualquiera con el enlace puede ver y cambiar el tablero**,
incluidos los teléfonos y correos. No lo publiquen en redes ni en grupos grandes.

## Límites del plan gratis

Netlify da 125 000 llamadas de función al mes. La app consulta cada 30 segundos solo
mientras está visible: 5 personas con la app abierta una hora diaria usan unas
18 000 al mes.

## Archivos

- `grupo/index.html`, `grupo/app.js`, `grupo/styles.css` — la página.
- `netlify/functions/grupo.mjs` — la API (`/api/grupo`): el tablero, los archivos y
  el calendario `.ics`.
