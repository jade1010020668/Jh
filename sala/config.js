/* ==========================================================================
   CONFIGURACIÓN DE LA SALA FF

   Normalmente NO hay que tocar nada: publicada en Netlify, la app ya guarda
   los equipos en la nube de Netlify (carpeta netlify/functions) y todo el
   grupo ve lo mismo.
   ========================================================================== */

window.FF_CONFIG = {

  /* Clave de administrador. Quien la sepa puede cambiar los ajustes de la
     sala, sacar gente y vaciar equipos. Cámbiala.
     Ojo: es una clave de conveniencia entre amigos, no seguridad real:
     está en el código de la página y cualquiera puede leerla. */
  adminPin: "1234",

  /* Sala que se abre por defecto. Puedes tener varias con ?sala=nombre */
  salaPorDefecto: "principal",

  /* Dónde está la API de la sala. Déjalo así en Netlify.
     Pon false para forzar el modo local (solo este navegador). */
  api: "/api/sala",

  /* OPCIONAL: Firebase Realtime Database. Si lo configuras, se usa en vez
     de la API de Netlify (tiempo real instantáneo, sin sondeo). Guía en
     SETUP.md. */
  firebase: null
};
