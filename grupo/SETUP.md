# Grupo CUN — cómo funciona en línea

## Enlace

```
https://fabulous-unicorn-235c34.netlify.app/grupo/
```

El repo está conectado a **Netlify**: cada vez que algo llega a `main`, se publica
solo en un minuto. No hay que crear cuentas ni configurar nada.

Todo lo que el grupo escribe o sube (fechas, mensajes, perfiles y archivos) se
guarda en **Netlify Blobs**, la nube de Netlify, a través de la función
`netlify/functions/grupo.mjs`. No se pierde aunque se vuelva a publicar el sitio.

## Primera vez

1. **La primera persona** que abre el enlace ve «Crear el grupo»: escribe el nombre
   del grupo, inventa el **código del grupo** y crea su usuario.
2. Pasa el enlace y el código **solo por el chat del grupo**.
3. Los demás entran, tocan «Crea tu cuenta», ponen el código y llenan su perfil.
4. Cada quien toca **Activar alarmas** para que el navegador avise de las entregas
   y, en *Calendario*, copia el enlace de suscripción a su Google Calendar o iPhone
   para tener los recordatorios en el celular.

Si el código se filtra, cualquiera del grupo puede cambiarlo en *Mi perfil*.

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
- **Calendario** del mes.

La página se actualiza sola cada 30 segundos con lo que suban los demás.

## Límites del plan gratis

Netlify da 125 000 llamadas de función al mes. La app consulta cada 30 segundos solo
mientras está visible: 5 personas con la app abierta una hora diaria usan unas
18 000 al mes. Los Blobs incluyen espacio de sobra para cientos de PDFs.

## Archivos

- `grupo/index.html`, `grupo/app.js`, `grupo/styles.css` — la página.
- `netlify/functions/grupo.mjs` — la API (`/api/grupo`): cuentas, datos, archivos
  y el calendario `.ics`.
