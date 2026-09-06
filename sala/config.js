/* ==========================================================================
   CONFIGURACIÓN DE LA SALA FF
   Edita este archivo (es el único que necesitas tocar) y súbelo a GitHub.
   Guía paso a paso: ver SETUP.md en esta misma carpeta.
   ========================================================================== */

window.FF_CONFIG = {

  /* 1) TIEMPO REAL --------------------------------------------------------
     Pega aquí la configuración de tu proyecto de Firebase.
     Mientras esto sea null, la app funciona en "modo local": todo se guarda
     solo en tu navegador y NO se comparte con los demás.

     Ejemplo de cómo debe quedar:

     firebase: {
       apiKey: "AIza...",
       authDomain: "mi-sala-ff.firebaseapp.com",
       databaseURL: "https://mi-sala-ff-default-rtdb.firebaseio.com",
       projectId: "mi-sala-ff",
       appId: "1:123456789:web:abc123"
     },
  */
  firebase: null,

  /* 2) CLAVE DE ADMINISTRADOR --------------------------------------------
     Quien la sepa puede editar la sala y sacar gente. Cámbiala.
     Ojo: es una clave de conveniencia entre amigos, no seguridad real:
     está en el código de la página y cualquiera puede leerla. */
  adminPin: "1234",

  /* 3) Sala que se abre por defecto. Puedes tener varias con ?sala=nombre */
  salaPorDefecto: "principal"
};
