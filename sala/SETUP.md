# Cómo funciona la Sala FF en línea

## Ya está en línea, sin configurar nada

El repo está conectado a **Netlify**. Cada vez que algo llega a `main`, Netlify
publica el sitio solo, en un minuto:

```
https://fabulous-unicorn-235c34.netlify.app/sala/
```

Ese es el enlace del grupo. Todo lo que la gente escribe (equipos, hora,
código) se guarda en la nube de Netlify (**Netlify Blobs**) a través de una
pequeña función (`netlify/functions/sala.mjs`). No hay que crear cuentas ni
pegar claves en ningún lado.

- La etiqueta arriba a la derecha dice **En vivo** cuando la página está
  hablando con esa función. Si dice **Modo local**, la función no respondió
  (por ejemplo, abriste el archivo directo desde el celular) y lo que escribas
  se queda solo en ese navegador.
- La página pregunta por cambios cada 3 segundos justo después de que alguien
  toca algo, y cada 6 segundos en reposo. No pregunta mientras está en
  segundo plano. Para un grupo de amigos eso se siente en tiempo real.
- El plan gratis de Netlify da 125 000 llamadas de función al mes. Con 12
  personas mirando la sala un rato al día sobra. Si algún mes se acabara,
  la sala pasa a modo local hasta el mes siguiente; la opción Firebase de
  abajo no tiene ese límite.

## Cambiar la clave de admin

En `sala/config.js`, cambia `adminPin: "1234"` por lo que quieras. Con esa
clave, desde **Admin** puedes cambiar modo, mapa, nombres de equipos, apuesta,
estado y nota, **vaciar** los equipos y **quitar al líder**. Sacar, anotar y
mover gente lo haces directo en los equipos.

> La clave viaja dentro de la página: sirve para que nadie toque la sala por
> accidente, no como candado de verdad.

## Varias salas a la vez

Agrégale `?sala=` al enlace:

```
https://fabulous-unicorn-235c34.netlify.app/sala/?sala=viernes
https://fabulous-unicorn-235c34.netlify.app/sala/?sala=torneo
```

Cada una guarda sus propios equipos, hora y código.

## Opcional: Firebase (tiempo real instantáneo)

Si quieres que los cambios lleguen al instante en vez de cada pocos segundos,
o te preocupa el límite mensual de Netlify:

1. Entra a <https://console.firebase.google.com> → **Crear proyecto**.
2. **Compilación → Realtime Database → Crear base de datos** → modo de prueba.
3. Pestaña **Reglas**:

   ```json
   { "rules": { "salas": { ".read": true, ".write": true } } }
   ```

4. ⚙️ **Configuración del proyecto → Tus apps → `</>`** y copia el bloque
   `firebaseConfig`.
5. Pégalo en `sala/config.js` en `firebase: { ... }` (incluye `databaseURL`).

Con `firebase` configurado, la app lo usa en vez de la función de Netlify.

## Preguntas rápidas

**¿Cada quien necesita cuenta?** No. Entran al enlace, escriben su nombre y ya.

**¿Quién manda?** Quien pone el **código de la sala** queda como líder y puede
sacar, anotar y mover gente. El admin siempre puede.

**¿Puedo salirme solo?** Sí, tu propio slot tiene **Salir**.

**¿Cómo lo paso al grupo?** **Texto WhatsApp** copia el mensaje completo;
**Foto equipos** genera una imagen para la galería o para mandar directo.
