// Si algo impide que la app arranque (navegador muy antiguo, un archivo que no cargó), se dice en pantalla
// en vez de dejar la página a medias. Escrito a propósito con sintaxis antigua: debe funcionar en cualquier navegador.
(function () {
  var shown = false;
  function show(msg) {
    if (shown || window.__appReady) return;
    shown = true;
    var box = document.getElementById('boot-error');
    if (!box) return;
    box.hidden = false;
    box.textContent = 'La app no pudo iniciar en este navegador. Recargue la página; si sigue igual, ábrala en Chrome o Safari actualizados. Detalle técnico: ' + msg;
  }
  // Solo cuentan los errores de los archivos de ESTE sitio: los de extensiones del navegador u otros orígenes no son de la app
  function own(url) { return !url || String(url).indexOf(location.origin) === 0 || !/^[a-z][a-z0-9+.-]*:/i.test(String(url)); }
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT') { if (own(t.src || t.getAttribute('src'))) show('no cargó el archivo ' + (t.getAttribute('src') || '')); return; }
    if (t && t !== window && t.tagName) return;            // imágenes u otros recursos: no impiden el arranque
    if (e && e.filename && !own(e.filename)) return;
    show((e && e.message) || 'error desconocido');
  }, true);
  window.addEventListener('load', function () { setTimeout(function () { show('el programa no terminó de cargar'); }, 0); });
})();
