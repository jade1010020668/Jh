---
title: Grupo CUN
emoji: 🎓
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# 🎓 Grupo CUN — la app del grupo de estudio

Una página web privada para el grupo (pensada para 5 personas, aguanta más) donde
cualquiera puede:

- **Poner fechas importantes**: entregas, parciales, reuniones, clases. Con materia,
  detalles y link a la plataforma.
- **Ver alarmas**: el inicio muestra en rojo lo vencido, en naranja lo de hoy y los
  próximos 3 días, y en amarillo lo de la semana. El menú muestra cuántas cosas
  urgentes hay.
- **Recibir avisos**:
  - en el **navegador** (1 día antes, 2 horas antes y al vencerse) mientras la app
    esté abierta en alguna pestaña;
  - en el **celular**, suscribiéndose al calendario del grupo desde Google Calendar
    o iPhone (página *Calendario*), o con el botón **Agregar a mi Google Calendar**
    de cada fecha;
  - por **WhatsApp**, con el botón que arma el mensaje listo para enviar al grupo.
- **Subir archivos** (soluciones de parciales, entregas, guías, material) y
  **guardar links** (Drive, videos, plataforma), con categorías, materia y buscador.
  PDFs e imágenes se abren directo en el navegador.
- **Comentar** cada fecha («yo hago el punto 3») y escribir en el **muro** del grupo;
  los mensajes fijados salen en el inicio.
- **Ver los datos de cada integrante**: correo, teléfono, WhatsApp (con botón para
  escribirle), cumpleaños (salen en el inicio cuando se acercan) y una nota libre.
- **Calendario mensual** con todas las fechas.

Para entrar hay que crear una cuenta con el **código del grupo** (`GROUP_CODE`), así
nadie de afuera puede registrarse ni ver los datos personales.

---

## Dónde montarla (gratis)

La app es un solo programa en Python (Flask). **Todo** (fechas, mensajes y también los
archivos) se guarda en una base de datos PostgreSQL. Esto es importante porque los
planes gratis de Render y Hugging Face **borran el disco cada vez que la app se
reinicia**: si no conectas una base de datos externa, se pierde lo subido.

### Paso 1 — Base de datos gratis (Neon, 5 minutos)

1. Entra a <https://neon.tech> y crea una cuenta (sirve con Google/GitHub).
2. Crea un proyecto (región: *US East* está bien).
3. Copia la **connection string**; se ve así:
   `postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

El plan gratis trae 0,5 GB: alcanza para miles de fechas y unos cientos de PDFs.
Para videos o archivos muy pesados, súbanlos a Drive y guarden el **link** en la app.
(Supabase también sirve; la base de datos gratis de Render **se borra a los 30 días**,
por eso no la recomendamos.)

### Paso 2, opción A — Render (recomendado)

1. Entra a <https://render.com> con tu cuenta de GitHub.
2. **New → Blueprint** y elige este repositorio. Render lee el archivo `render.yaml`
   de la raíz y crea el servicio `grupo-cun`.
3. Te pedirá dos valores:
   - `GROUP_CODE`: el código secreto del grupo (ej. `cun-gerencia-2026`). Pásenlo solo
     por el chat del grupo.
   - `DATABASE_URL`: la connection string de Neon.
4. Espera el despliegue y abre el enlace `https://grupo-cun-xxxx.onrender.com`.

En el plan gratis la app «se duerme» tras 15 min sin uso y tarda ~1 minuto en
despertar la primera vez. Los datos no se pierden porque están en Neon.

### Paso 2, opción B — Hugging Face Spaces

1. En <https://huggingface.co/new-space> crea un Space: SDK **Docker**, plantilla
   *Blank*, visibilidad *Public* (la app ya pide usuario y contraseña).
2. Sube **el contenido de la carpeta `grupo-cun/`** a la raíz del Space (pestaña
   *Files → Upload files*, o con `git`). Este README ya trae la cabecera que
   Hugging Face necesita.
3. En *Settings → Variables and secrets* agrega como **secrets**:
   `GROUP_CODE`, `DATABASE_URL` y `SECRET_KEY` (cualquier texto largo y aleatorio).
4. Usa el enlace directo `https://TU-USUARIO-grupo-cun.hf.space` (no el de
   huggingface.co/spaces/…): ahí funcionan bien las sesiones y las notificaciones.

### Variables de configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `GROUP_CODE` | Código para crear cuenta | `CUN-GRUPO` (¡cámbialo!) |
| `DATABASE_URL` | PostgreSQL donde se guarda todo | SQLite local en `data/` |
| `SECRET_KEY` | Firma las sesiones | Se deriva del código del grupo |
| `GROUP_NAME` | Nombre que sale arriba | `Grupo CUN` |
| `MAX_UPLOAD_MB` | Tamaño máximo por archivo | `20` |
| `TZ_OFFSET_HOURS` | Zona horaria | `-5` (Colombia) |

---

## Primeros pasos con el grupo

1. Cada integrante entra al enlace → **Crea tu cuenta** con el código del grupo.
2. Completa **Mi perfil** (WhatsApp, correo, cumpleaños, horarios).
3. Al primer ingreso, toca **Activar alarmas** para que el navegador avise.
4. En **Calendario**, copia el enlace de suscripción y agrégalo a tu Google Calendar
   para tener los recordatorios en el celular.

## Probarla en tu computador

```bash
cd grupo-cun
pip install -r requirements.txt
GROUP_CODE=prueba python app.py      # abre http://localhost:5000
python -m unittest test_app          # prueba automática de todo el flujo
```
