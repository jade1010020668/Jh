# Cómo poner la Sala FF en línea

Son dos cosas: **publicar la página** y **conectar la base de datos** para que
todos vean lo mismo al mismo tiempo. Toma unos 10 minutos y es gratis.

---

## Paso 1 — Publicar la página (GitHub Pages)

1. En GitHub, entra al repo → pestaña **Settings** → sección **Pages**.
2. En *Source* elige **Deploy from a branch**.
3. Branch: `main`, carpeta: `/ (root)`. Dale **Save**.
4. Espera 1–2 minutos. Tu sala queda en:

   ```
   https://jade1010020668.github.io/jh/sala/
   ```

Ese es el enlace que pegas en el grupo de WhatsApp.

> Ya funciona así, pero todavía en **modo local**: cada quien ve solo lo que
> escribió en su propio celular. Para que se vea en tiempo real, sigue el paso 2.

---

## Paso 2 — Conectar el tiempo real (Firebase)

Firebase es de Google y el plan gratis alcanza de sobra para esto.

1. Entra a <https://console.firebase.google.com> y dale **Crear un proyecto**.
   Ponle el nombre que quieras (ej. `sala-ff`). Puedes desactivar Google Analytics.

2. En el menú de la izquierda: **Compilación → Realtime Database → Crear base de datos**.
   - Ubicación: la que te sugiera.
   - Reglas de seguridad: elige **Iniciar en modo de prueba**.

3. Abre la pestaña **Reglas** de la base de datos y déjala así:

   ```json
   {
     "rules": {
       "salas": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```

   Dale **Publicar**.

   > Esto deja la sala abierta: cualquiera que tenga el enlace puede escribir en
   > ella. Para un grupo de amigos está bien; no guardes ahí nada privado.

4. Vuelve a **Configuración del proyecto** (el engranaje, arriba a la izquierda)
   → baja hasta **Tus apps** → ícono **`</>`** (Web) → registra la app.
   Firebase te muestra un bloque parecido a este:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "sala-ff.firebaseapp.com",
     databaseURL: "https://sala-ff-default-rtdb.firebaseio.com",
     projectId: "sala-ff",
     storageBucket: "sala-ff.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   > Si no aparece `databaseURL`, cópiala de la pantalla de Realtime Database
   > (es la URL que sale arriba de la tabla). Sin ella no funciona.

5. Abre `sala/config.js` en el repo y pega esos datos:

   ```js
   window.FF_CONFIG = {
     firebase: {
       apiKey: "AIzaSy...",
       authDomain: "sala-ff.firebaseapp.com",
       databaseURL: "https://sala-ff-default-rtdb.firebaseio.com",
       projectId: "sala-ff",
       appId: "1:123456789:web:abc123"
     },
     adminPin: "TU_CLAVE_AQUI",
     salaPorDefecto: "principal"
   };
   ```

6. Guarda, haz commit y sube. Al minuto, la etiqueta de arriba a la derecha de
   la página cambia de **Modo local** a **En vivo**.

---

## Paso 3 — Tu clave de admin

Cambia `adminPin` en `config.js` por algo que solo sepas tú. Con esa clave
entras al **panel del administrador** y puedes:

- poner fecha y hora de la partida,
- cambiar el modo (1v1, 2v2, 4v4, 6v6, 12v12),
- escribir el **código y la contraseña de la sala**,
- ponerle nombre a cada equipo,
- dejar una nota y la apuesta,
- **sacar** a cualquiera y **vaciar** los equipos.

> La clave viaja dentro de la página, así que alguien con ganas podría leerla en
> el código. Sirve para que nadie toque la sala por accidente, no como candado
> de verdad.

---

## Varias salas a la vez

Agrégale `?sala=` al enlace y tienes salas independientes:

```
https://jade1010020668.github.io/jh/sala/?sala=viernes
https://jade1010020668.github.io/jh/sala/?sala=torneo
```

Cada una guarda sus propios equipos y su propio código.

---

## Preguntas rápidas

**¿Cada quien necesita cuenta?** No. Entran al enlace, escriben su nombre y ya.

**¿Puedo salirme solo?** Sí. Tu propio slot tiene un botón **Salir**; no
necesitas al admin.

**¿Y si alguien no llegó?** El admin le da **Sacar** y el cupo queda libre al
instante para todos.

**¿Cómo lo paso al grupo?** El botón **Copiar para WhatsApp** arma el mensaje
completo (fecha, código, clave y los dos equipos) listo para pegar.
