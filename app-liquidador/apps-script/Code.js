/**
 * APLICACIÓN DE LIQUIDACIÓN — núcleo (Google Apps Script, vinculado a una hoja de cálculo).
 *
 * La hoja de cálculo ES la base de datos visible:
 *   BD          → todas las liquidaciones (una fila por versión)
 *   PREPAGADA   → compromiso | valor mensual
 *   VIVIENDA    → compromiso | valor mensual
 *   TARIFAS     → compromiso | tarifa 383/387 | responsable   (regla: constante en el año)
 *   ZONAS       → zona | lugar | tarifa ICA | NITs
 *   PARAMETROS  → UVT, %, tabla art. 383 (por vigencia)
 *   AUDITORIA   → quién, qué, antes → después, cuándo
 */

var HOJAS = {
  BD: ['consecutivo', 'version', 'fecha', 'liquidadoPor', 'estado', 'key', 'numCuenta', 'compromiso',
       'nombre', 'cedula', 'honorarios', 'dias', 'responsableIva', 'planilla', 'declarante', 'pensionado',
       'zona', 'dependientes', 'nivelRiesgo', 'facturador', 'orfeo', 'dependencia', 'numCto', 'telefono',
       'tarifa', 'prepagada', 'vivienda', 'honPeriodo', 'neto', 'baseRetefuente', 'retefuente',
       'baseIca', 'tarifaIca', 'ica', 'reteIva', 'proUniversidades', 'proHospitales', 'bomberil',
       'totalDeducciones', 'netoAPagar', 'edicionesJson', 'codigoOriginal', 'pdfUrl', 'observaciones'],
  PREPAGADA: ['compromiso', 'valorMensual'],
  VIVIENDA: ['compromiso', 'valorMensual'],
  TARIFAS: ['compromiso', 'tarifa', 'responsable'],
  ZONAS: ['zona', 'lugar', 'tarifaIca', 'nitAlcaldia', 'nombreAlcaldia', 'conceptoExtra', 'nitExtra', 'beneficiarioExtra'],
  PARAMETROS: ['clave', 'valor'],
  AUDITORIA: ['fecha', 'usuario', 'accion', 'consecutivo', 'detalle']
};

// ---------------------------------------------------------------------------
// INSTALACIÓN (ejecutar una sola vez desde el editor: setup y luego definirClaveSuperadmin)
// ---------------------------------------------------------------------------

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HOJAS).forEach(function (nombre) {
    var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (h.getLastRow() === 0) {
      h.appendRow(HOJAS[nombre]);
      h.setFrozenRows(1);
      h.getRange(1, 1, 1, HOJAS[nombre].length).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    }
  });
  // Semillas (solo si las hojas están vacías)
  seedSiVacia_('ZONAS', SEED_ZONAS);
  seedSiVacia_('PREPAGADA', SEED_PREPAGADA);
  seedSiVacia_('VIVIENDA', SEED_VIVIENDA);
  seedSiVacia_('TARIFAS', SEED_TARIFAS);
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PARAMETROS');
  if (hp.getLastRow() === 1) {
    var p = PARAMETROS_DEFECTO;
    [['uvt', p.uvt], ['pctSalud', p.pctSalud], ['pctPension', p.pctPension], ['pctArl', p.pctArl],
     ['pctIbc', p.pctIbc], ['pctDependientes', p.pctDependientes], ['pctExenta387', p.pctExenta387],
     ['iva', p.iva], ['pctReteIva', p.pctReteIva], ['tabla383', JSON.stringify(p.tabla383)]
    ].forEach(function (f) { hp.appendRow(f); });
  }
  return 'Instalación completa. Ahora ejecute definirClaveSuperadmin() y despliegue como aplicación web.';
}

function seedSiVacia_(nombre, filas) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (h.getLastRow() === 1 && filas.length) {
    h.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
  }
}

/** Cambie la clave aquí y ejecútelo UNA vez; luego borre la clave del código. */
function definirClaveSuperadmin() {
  var CLAVE = 'CAMBIEME-123';
  PropertiesService.getScriptProperties().setProperty(
    'SUPERADMIN_HASH', hash_(CLAVE));
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

// ---------------------------------------------------------------------------
// WEB APP
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Liquidador IDEAM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// LECTURA DE MAESTROS Y PARÁMETROS
// ---------------------------------------------------------------------------

function leerHoja_(nombre) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h || h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).getValues();
}

function cargarMaestros_() {
  var prepagada = {}, vivienda = {}, zonas = {}, tarifas = {};
  leerHoja_('PREPAGADA').forEach(function (f) { if (f[0] !== '') prepagada[String(f[0])] = Number(f[1]) || 0; });
  leerHoja_('VIVIENDA').forEach(function (f) { if (f[0] !== '') vivienda[String(f[0])] = Number(f[1]) || 0; });
  leerHoja_('ZONAS').forEach(function (f) {
    if (f[0] !== '') zonas[parseInt(f[0], 10)] = { lugar: f[1], tarifa: Number(f[2]) || 0, nitAlcaldia: f[3], nombreAlcaldia: f[4], conceptoExtra: f[5], nitExtra: f[6], beneficiarioExtra: f[7] };
  });
  leerHoja_('TARIFAS').forEach(function (f) { if (f[0] !== '') tarifas[String(f[0])] = { tarifa: parseInt(f[1], 10), responsable: f[2] }; });
  return { prepagada: prepagada, vivienda: vivienda, zonas: zonas, tarifas: tarifas };
}

function cargarParametros_() {
  var p = JSON.parse(JSON.stringify(PARAMETROS_DEFECTO));
  leerHoja_('PARAMETROS').forEach(function (f) {
    var k = String(f[0]);
    if (k === 'tabla383') { try { p.tabla383 = JSON.parse(f[1]); } catch (e) {} }
    else if (k in p) p[k] = Number(f[1]);
  });
  return p;
}

// ---------------------------------------------------------------------------
// API PARA LA INTERFAZ
// ---------------------------------------------------------------------------

/** Paso 1: pegar código → parsear + precargar validaciones + maestros. */
function apiParsear(codigo) {
  var r = parsearCodigo(codigo);
  if (!r.ok) return r;
  var m = cargarMaestros_();
  var c = r.campos;
  // tarifa desde el maestro (regla: constante en el año)
  var t = m.tarifas[String(c.compromiso)];
  c.tarifa = t ? t.tarifa : '';
  if (!t) r.avisos.push('El compromiso ' + c.compromiso + ' NO tiene tarifa (383/387) asignada en el maestro TARIFAS. Asígnela antes de liquidar.');
  if (c.tarifa === 387 && c.planilla !== 'A') r.errores.push('REGLA: la tarifa 387 exige pago ANTICIPADO (planilla A) y este radicado llegó "' + c.planilla + '".');
  // duplicado
  var dup = buscarPorOrfeo_(c.orfeo);
  if (dup) r.avisos.push('El radicado Orfeo ' + c.orfeo + ' YA tiene liquidación (consecutivo ' + dup + '). Si continúa se creará una nueva VERSIÓN.');
  c.prepagada = m.prepagada[String(c.compromiso)] || 0;
  c.vivienda = m.vivienda[String(c.compromiso)] || 0;
  r.ok = r.errores.length === 0;
  return r;
}

/** Paso 2: previsualizar la liquidación con los datos (posiblemente editados). */
function apiLiquidar(datos) {
  var m = cargarMaestros_();
  var p = cargarParametros_();
  if (parseInt(datos.tarifa, 10) === 387 && String(datos.planilla).toUpperCase() !== 'A') {
    return { ok: false, errores: ['La tarifa 387 exige planilla A (anticipado).'] };
  }
  var res = liquidar(datos, m, p);
  return { ok: true, resultado: res };
}

/** Paso 3: guardar — asigna consecutivo ÚNICO (con bloqueo) y escribe en BD. */
function apiGuardar(datos, resultado, ediciones) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var dup = buscarPorOrfeo_(datos.orfeo);
    var consecutivo, version;
    if (dup) {
      consecutivo = dup.consecutivo;
      version = dup.maxVersion + 1;
    } else {
      consecutivo = Number(props.getProperty('CONSECUTIVO') || 0) + 1;
      props.setProperty('CONSECUTIVO', String(consecutivo));
      version = 1;
    }
    var usuario = Session.getActiveUser().getEmail() || 'desconocido';
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD');
    h.appendRow([
      consecutivo, version, new Date(), usuario, 'LIQUIDADA',
      datos.key, datos.numCuenta, datos.compromiso, datos.nombre, datos.cedula,
      datos.honorarios, datos.dias, datos.responsableIva, datos.planilla, datos.declarante,
      datos.pensionado, datos.zona, datos.dependientes, datos.nivelRiesgo, datos.facturador,
      "'" + datos.orfeo, datos.dependencia, datos.numCto, datos.telefono, datos.tarifa,
      resultado.prepagada, resultado.vivienda, resultado.honPeriodo, resultado.neto,
      resultado.baseRetefuente, resultado.retefuente, resultado.baseIca, resultado.tarifaIca,
      resultado.ica, resultado.reteIva, resultado.proUniversidades, resultado.proHospitales,
      resultado.bomberil, resultado.totalDeducciones, resultado.neto_a_pagar,
      JSON.stringify(ediciones || []), datos.codigoOriginal || '', '', datos.observaciones || ''
    ]);
    auditar_('LIQUIDAR', consecutivo, 'v' + version + ' orfeo ' + datos.orfeo + ' ' + datos.nombre);
    return { ok: true, consecutivo: consecutivo, version: version };
  } finally {
    lock.releaseLock();
  }
}

/** Base de datos para la pantalla (todas las liquidaciones). */
function apiListar() {
  return { encabezados: HOJAS.BD, filas: leerHoja_('BD').map(function (f) {
    return f.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : v; });
  }) };
}

function apiMaestros() {
  return {
    prepagada: leerHoja_('PREPAGADA'), vivienda: leerHoja_('VIVIENDA'),
    tarifas: leerHoja_('TARIFAS'), zonas: leerHoja_('ZONAS'),
    parametros: leerHoja_('PARAMETROS')
  };
}

/** Guardado de un maestro completo (reemplaza el contenido; queda auditado). */
function apiGuardarMaestro(nombre, filas, claveSiEsSensible) {
  if (['PREPAGADA', 'VIVIENDA', 'TARIFAS', 'ZONAS', 'PARAMETROS'].indexOf(nombre) < 0) {
    return { ok: false, errores: ['Maestro no permitido'] };
  }
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  var antes = h.getLastRow() - 1;
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent();
  if (filas.length) h.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
  auditar_('MAESTRO:' + nombre, '', antes + ' → ' + filas.length + ' filas');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SUPERADMINISTRADOR
// ---------------------------------------------------------------------------

function apiSuperadmin(clave, accion, payload) {
  var esperado = PropertiesService.getScriptProperties().getProperty('SUPERADMIN_HASH');
  if (!esperado || hash_(String(clave)) !== esperado) {
    auditar_('SUPERADMIN_RECHAZADO', '', accion);
    return { ok: false, errores: ['Clave incorrecta.'] };
  }
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD');
  if (accion === 'editar') {
    // payload: {fila (1-based sobre datos), columna (nombre), valor}
    var col = HOJAS.BD.indexOf(payload.columna) + 1;
    if (col < 1) return { ok: false, errores: ['Columna inválida'] };
    var celda = h.getRange(payload.fila + 1, col);
    var anterior = celda.getValue();
    celda.setValue(payload.valor);
    auditar_('SUPERADMIN_EDITAR', h.getRange(payload.fila + 1, 1).getValue(),
      payload.columna + ': "' + anterior + '" → "' + payload.valor + '"');
    return { ok: true };
  }
  if (accion === 'eliminar') {
    // Borrado LÓGICO: estado = ELIMINADA (nada se borra físicamente)
    var estadoCol = HOJAS.BD.indexOf('estado') + 1;
    var anteriorE = h.getRange(payload.fila + 1, estadoCol).getValue();
    h.getRange(payload.fila + 1, estadoCol).setValue('ELIMINADA');
    auditar_('SUPERADMIN_ELIMINAR', h.getRange(payload.fila + 1, 1).getValue(), 'estado "' + anteriorE + '" → ELIMINADA');
    return { ok: true };
  }
  return { ok: false, errores: ['Acción desconocida'] };
}

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function buscarPorOrfeo_(orfeo) {
  var filas = leerHoja_('BD');
  var iOrfeo = HOJAS.BD.indexOf('orfeo'), iCons = HOJAS.BD.indexOf('consecutivo'), iVer = HOJAS.BD.indexOf('version');
  var res = null;
  filas.forEach(function (f) {
    if (String(f[iOrfeo]).replace(/^'/, '') === String(orfeo)) {
      if (!res || f[iVer] > res.maxVersion) res = { consecutivo: f[iCons], maxVersion: f[iVer] };
    }
  });
  return res;
}

function auditar_(accion, consecutivo, detalle) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AUDITORIA')
    .appendRow([new Date(), Session.getActiveUser().getEmail() || 'desconocido', accion, consecutivo, detalle]);
}
