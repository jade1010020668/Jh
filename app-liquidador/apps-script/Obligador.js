/**
 * OBLIGADOR — Fase 2: generación MODULAR de la carga masiva de obligaciones
 * del SIIF Nación (4 archivos: Maestro | Ítem | Deducciones | Usos).
 *
 * Modularidad: dentro de un lote se puede incluir/excluir/quitar cualquier
 * obligación; la numeración de TODOS los archivos se calcula al momento de
 * generar, así que la estructura nunca se daña.
 * Reset del lote: contraseña de superadmin + código de confirmación (2 pasos).
 */

var HOJAS_OBL = {
  COMPROMISOS_SIIF: ['numeroDocumento', 'dependencia', 'dependenciaDescripcion', 'rubro', 'fuente', 'recurso', 'situacion', 'saldoPorUtilizar'],
  PARAM_RUBROS: ['rubro', 'recurso', 'situacion', 'fuente', 'tipoGasto', 'tipoOperacion', 'usoContable', 'cuentaContable', 'usoPresupuestal'],
  CONFIG_SIIF: ['clave', 'valor'],
  LOTES: ['id', 'nombre', 'estado', 'fecha', 'creadoPor'],
  LOTE_ITEMS: ['loteId', 'consecutivo', 'version', 'incluido', 'motivo']
};

// Semillas auditadas del OBLIGADOR de IDEAM (tabla ITEM!V6:AC33 — completar en la hoja)
var SEED_PARAM_RUBROS = [
  ['A-02-02-02-008-002', '10', '01', '01', '21', '74', '', '', 'A-02-02-02-008-002-01'],
  ['A-02-02-02-008-003', '10', '01', '01', '', '188', '22', '511179001', 'A-02-02-02-008-003-09'],
  ['C-3299-0900-2-10101C-3299016-02', '11', '01', '01', '', '17', '22', '511179001', 'A-02-02-02-008-003-09']
];
var SEED_CONFIG_SIIF = [
  ['pci', '32-02-00-000'],
  ['tipoCuentaCxp', '103'],
  ['tipoDocSoporte', '11'],
  ['expedidor', '11'],
  ['atributoNormal', '5'],
  ['atributoConvenio', '25'],
  ['nitDian', '800197268'],
  ['posRetefuente', '2-01-04-01-29'],
  ['posIcaBogota', '2-01-05-01-01-03-05'],
  ['posIcaOtros', '2-01-05-01-97'],
  ['diasFechaPago', '2'],
  ['funcionario', ''],
  ['cargoFuncionario', '']
];

function setupObligador_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HOJAS_OBL).forEach(function (nombre) {
    var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (h.getLastRow() === 0) {
      h.appendRow(HOJAS_OBL[nombre]);
      h.setFrozenRows(1);
      h.getRange(1, 1, 1, HOJAS_OBL[nombre].length).setFontWeight('bold').setBackground('#538135').setFontColor('#FFFFFF');
    }
  });
  seedSiVacia_('PARAM_RUBROS', SEED_PARAM_RUBROS);
  seedSiVacia_('CONFIG_SIIF', SEED_CONFIG_SIIF);
}

function cargarConfigSiif_() {
  var c = {};
  leerHoja_('CONFIG_SIIF').forEach(function (f) { c[String(f[0])] = String(f[1]); });
  return c;
}

function cargarParamRubros_() {
  var r = {};
  leerHoja_('PARAM_RUBROS').forEach(function (f) {
    if (f[0] !== '') r[String(f[0]).trim()] = {
      recurso: String(f[1]), situacion: String(f[2]), fuente: String(f[3]),
      tipoGasto: String(f[4] || ''), tipoOperacion: String(f[5] || ''),
      usoContable: String(f[6] || ''), cuentaContable: String(f[7] || ''),
      usoPresupuestal: String(f[8] || '')
    };
  });
  return r;
}

function cargarCompromisosSiif_() {
  var c = {};
  leerHoja_('COMPROMISOS_SIIF').forEach(function (f) {
    if (f[0] !== '') c[String(f[0]).trim()] = { dependencia: String(f[1]), rubro: String(f[3]).trim(), fuente: String(f[4]), saldo: Number(f[7]) || null };
  });
  return c;
}

// ---------------------------------------------------------------------------
// API DE LOTES
// ---------------------------------------------------------------------------

/** Liquidaciones disponibles (última versión, LIQUIDADA, no en lote activo). */
function apiDisponibles() {
  var enLote = {};
  var lotesActivos = {};
  leerHoja_('LOTES').forEach(function (f) { if (['ABIERTO', 'GENERADO'].indexOf(String(f[2])) >= 0) lotesActivos[String(f[0])] = true; });
  leerHoja_('LOTE_ITEMS').forEach(function (f) { if (lotesActivos[String(f[0])] && String(f[3]) !== 'QUITADO') enLote[String(f[1])] = true; });

  var filas = leerHoja_('BD');
  var ult = {};
  var i = colBD_();
  filas.forEach(function (f) {
    var k = String(f[i.consecutivo]);
    if (!ult[k] || f[i.version] > ult[k][i.version]) ult[k] = f;
  });
  var res = [];
  Object.keys(ult).forEach(function (k) {
    var f = ult[k];
    if (String(f[i.estado]) !== 'LIQUIDADA') return;
    res.push({
      consecutivo: f[i.consecutivo], version: f[i.version], nombre: f[i.nombre],
      cedula: f[i.cedula], orfeo: String(f[i.orfeo]).replace(/^'/, ''), compromiso: f[i.compromiso],
      neto: f[i.neto], retefuente: f[i.retefuente], ica: f[i.ica], enLote: !!enLote[k]
    });
  });
  res.sort(function (a, b) { return a.consecutivo - b.consecutivo; });
  return res;
}

function apiCrearLote(nombre, consecutivos) {
  if (!consecutivos || !consecutivos.length) return { ok: false, errores: ['Seleccione al menos una liquidación.'] };
  if (consecutivos.length > 200) return { ok: false, errores: ['Máximo 200 obligaciones por carga (regla SIIF). Seleccionó ' + consecutivos.length + '.'] };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var id = Number(props.getProperty('LOTE_SEQ') || 0) + 1;
    props.setProperty('LOTE_SEQ', String(id));
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName('LOTES').appendRow([id, nombre || ('Lote ' + id), 'ABIERTO', new Date(), Session.getActiveUser().getEmail() || '']);
    var hi = ss.getSheetByName('LOTE_ITEMS');
    consecutivos.forEach(function (c) { hi.appendRow([id, c, '', 'SI', '']); });
    auditar_('LOTE_CREAR', id, consecutivos.length + ' liquidaciones');
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function apiListarLotes() {
  return leerHoja_('LOTES').map(function (f) {
    return { id: f[0], nombre: f[1], estado: f[2], fecha: f[3] instanceof Date ? Utilities.formatDate(f[3], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : f[3], creadoPor: f[4] };
  }).reverse();
}

function apiVerLote(id) {
  var items = [];
  leerHoja_('LOTE_ITEMS').forEach(function (f) {
    if (String(f[0]) === String(id)) items.push({ consecutivo: f[1], incluido: String(f[3]), motivo: f[4] });
  });
  var bd = {};
  var i = colBD_();
  leerHoja_('BD').forEach(function (f) {
    var k = String(f[i.consecutivo]);
    if (!bd[k] || f[i.version] > bd[k].version) bd[k] = {
      version: f[i.version], nombre: f[i.nombre], orfeo: String(f[i.orfeo]).replace(/^'/, ''),
      compromiso: f[i.compromiso], neto: f[i.neto], retefuente: f[i.retefuente], ica: f[i.ica], estado: f[i.estado]
    };
  });
  items.forEach(function (it) { var b = bd[String(it.consecutivo)] || {}; Object.keys(b).forEach(function (k) { it[k] = b[k]; }); });
  return { items: items };
}

/** Incluir / excluir ("no sube") / quitar un ítem del lote — sin dañar nada. */
function apiMarcarItem(loteId, consecutivo, accion, motivo) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOTE_ITEMS');
  var datos = h.getDataRange().getValues();
  for (var r = 1; r < datos.length; r++) {
    if (String(datos[r][0]) === String(loteId) && String(datos[r][1]) === String(consecutivo)) {
      var nuevo = accion === 'incluir' ? 'SI' : accion === 'excluir' ? 'NO' : 'QUITADO';
      h.getRange(r + 1, 4).setValue(nuevo);
      h.getRange(r + 1, 5).setValue(motivo || '');
      auditar_('LOTE_ITEM', loteId, 'consecutivo ' + consecutivo + ' → ' + nuevo + (motivo ? ' (' + motivo + ')' : ''));
      return { ok: true };
    }
  }
  return { ok: false, errores: ['Ítem no encontrado en el lote.'] };
}

// ---------------------------------------------------------------------------
// GENERACIÓN DE LOS 4 ARCHIVOS (numeración calculada al generar)
// ---------------------------------------------------------------------------

/** Número SIIF: sin separador de miles, decimales con coma. */
function numSiif(x, dec) {
  if (x === null || x === undefined || isNaN(x)) return '';
  var s = Number(x).toFixed(dec === undefined ? 2 : dec);
  return s.replace('.', ',');
}

/** Función PURA (probable en Node): construye los 4 archivos a partir de los datos. */
function generarArchivos(registros, cfg, rubros, zonas, hoy) {
  var errores = [], maestro = [], item = [], deducciones = [], usos = [];
  if (registros.length === 0) errores.push('El lote no tiene obligaciones incluidas.');
  if (registros.length > 200) errores.push('Máximo 200 obligaciones por carga; hay ' + registros.length + '.');

  registros.forEach(function (d, idx) {
    var n = idx + 1; // consecutivo del archivo — SIEMPRE recalculado
    var pr = rubros[String(d.rubro || '').trim()];
    if (!d.rubro) { errores.push('#' + n + ' (' + d.nombre + '): el compromiso ' + d.compromiso + ' no está en COMPROMISOS_SIIF (no hay rubro/dependencia).'); return; }
    if (!pr) { errores.push('#' + n + ' (' + d.nombre + '): el rubro ' + d.rubro + ' no está parametrizado en PARAM_RUBROS.'); return; }
    if (!d.neto || d.neto <= 0) { errores.push('#' + n + ' (' + d.nombre + '): valor a obligar inválido.'); return; }
    if (d.saldo !== null && d.saldo !== undefined && d.neto > d.saldo) {
      errores.push('#' + n + ' (' + d.nombre + '): el valor ' + d.neto + ' supera el saldo por utilizar del compromiso (' + d.saldo + ').');
    }

    var atributo = d.convenio ? cfg.atributoConvenio : cfg.atributoNormal;
    var fechaPago = d.fechaPago || hoy;

    // MAESTRO (17 campos)
    maestro.push([n, hoy, cfg.pci, d.compromiso, fechaPago, 'NO', cfg.tipoCuentaCxp, '0',
      cfg.tipoDocSoporte, d.docSoporte || d.orfeo, hoy.replace(/\//g, '-'), cfg.expedidor,
      cfg.funcionario || '', cfg.cargoFuncionario || '', (d.key || '') + ' PAGO HONORARIOS', '', ''].join('|'));

    // ITEM (13 campos, reglas condicionales de la Guía 6)
    var esMatriz = pr.tipoGasto !== '';
    var atributoNoNinguno = String(atributo) !== String(cfg.atributoNormal) && String(atributo) !== '5';
    var tipoGasto = '', usoContable = '', cuenta = '';
    if (atributoNoNinguno) { /* solo atributo + tipo de operación */ }
    else if (esMatriz) { tipoGasto = pr.tipoGasto; }
    else { usoContable = pr.usoContable; cuenta = pr.cuentaContable; }
    item.push([n, 1, d.dependencia, d.rubro, pr.recurso, pr.fuente, pr.situacion,
      numSiif(d.neto, 0), atributo, tipoGasto, pr.tipoOperacion, usoContable, cuenta].join('|'));

    // DEDUCCIONES: ICA + retefuente (valores SIIF: redondeados sin decimales)
    var linea = 1;
    var zona = zonas[parseInt(d.zona, 10)] || {};
    var icaValor = Math.round(d.ica || 0);
    if (icaValor > 0) {
      var pos = parseInt(d.zona, 10) === 11 ? cfg.posIcaBogota : cfg.posIcaOtros;
      var nit = parseInt(d.zona, 10) === 11 ? '899999061' : String(zona.nitAlcaldia || '');
      var tarifa = d.baseIca ? Math.round(icaValor / d.baseIca * 100 * 1e5) / 1e5 : 0;
      deducciones.push([n, linea++, pos, '01', nit, numSiif(d.baseIca, 2), numSiif(tarifa, 3), icaValor].join('|'));
    }
    var rfValor = Math.round(d.retefuente || 0);
    if (rfValor > 0) {
      var tarifaRf = d.baseRetefuente ? Math.round(rfValor / d.baseRetefuente * 100 * 1e5) / 1e5 : 0;
      deducciones.push([n, linea++, cfg.posRetefuente, '01', cfg.nitDian, numSiif(d.baseRetefuente, 2), numSiif(tarifaRf, 3), rfValor].join('|'));
    }

    // USOS (si el rubro tiene uso presupuestal)
    if (pr.usoPresupuestal) {
      usos.push([n, 1, pr.usoPresupuestal, numSiif(d.neto, 2)].join('|'));
    }
  });

  return { errores: errores, maestro: maestro.join('\n'), item: item.join('\n'), deducciones: deducciones.join('\n'), usos: usos.join('\n'), total: registros.length };
}

/** Genera la carga de un lote (solo ítems incluidos), valida y devuelve los .txt. */
function apiGenerarCarga(loteId) {
  var lote = apiVerLote(loteId);
  var incluidos = lote.items.filter(function (it) { return it.incluido === 'SI' && it.estado === 'LIQUIDADA'; });
  var cfg = cargarConfigSiif_();
  var rubros = cargarParamRubros_();
  var comp = cargarCompromisosSiif_();
  var m = cargarMaestros_();
  var i = colBD_();
  var porConsecutivo = {};
  leerHoja_('BD').forEach(function (f) {
    var k = String(f[i.consecutivo]);
    if (!porConsecutivo[k] || f[i.version] > porConsecutivo[k][i.version]) porConsecutivo[k] = f;
  });
  var registros = incluidos.map(function (it) {
    var f = porConsecutivo[String(it.consecutivo)];
    var compromiso = String(f[i.compromiso]).trim();
    var cs = comp[compromiso] || {};
    return {
      nombre: f[i.nombre], compromiso: compromiso, key: f[i.key],
      orfeo: String(f[i.orfeo]).replace(/^'/, ''), zona: f[i.zona],
      neto: Number(f[i.neto]), baseIca: Number(f[i.baseIca]), ica: Number(f[i.ica]),
      baseRetefuente: Number(f[i.baseRetefuente]), retefuente: Number(f[i.retefuente]),
      dependencia: cs.dependencia || '', rubro: cs.rubro || '', saldo: cs.saldo,
      convenio: false, docSoporte: String(f[i.orfeo]).replace(/^'/, '')
    };
  });
  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');
  var res = generarArchivos(registros, cfg, rubros, m.zonas, hoy);
  if (res.errores.length === 0) {
    marcarLote_(loteId, 'GENERADO');
    auditar_('LOTE_GENERAR', loteId, res.total + ' obligaciones');
  }
  return res;
}

// ---------------------------------------------------------------------------
// RESET PROTEGIDO (contraseña + código de confirmación)
// ---------------------------------------------------------------------------

function apiSolicitarReset(loteId, clave) {
  var esperado = PropertiesService.getScriptProperties().getProperty('SUPERADMIN_HASH');
  if (!esperado || hash_(String(clave)) !== esperado) {
    auditar_('RESET_RECHAZADO', loteId, 'clave incorrecta');
    return { ok: false, errores: ['Clave incorrecta.'] };
  }
  var codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  CacheService.getScriptCache().put('RESET_' + loteId, codigo, 300); // 5 minutos
  auditar_('RESET_SOLICITADO', loteId, 'código emitido');
  return { ok: true, codigo: codigo };
}

function apiConfirmarReset(loteId, codigo) {
  var esperado = CacheService.getScriptCache().get('RESET_' + loteId);
  if (!esperado || String(codigo) !== esperado) return { ok: false, errores: ['Código inválido o vencido (5 min). Solicite uno nuevo.'] };
  CacheService.getScriptCache().remove('RESET_' + loteId);
  marcarLote_(loteId, 'RESETEADO');
  auditar_('LOTE_RESET', loteId, 'lote restablecido; liquidaciones liberadas');
  return { ok: true };
}

function marcarLote_(id, estado) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOTES');
  var datos = h.getDataRange().getValues();
  for (var r = 1; r < datos.length; r++) {
    if (String(datos[r][0]) === String(id)) { h.getRange(r + 1, 3).setValue(estado); return; }
  }
}

function colBD_() {
  var i = {};
  HOJAS.BD.forEach(function (n, idx) { i[n] = idx; });
  return i;
}

if (typeof module !== 'undefined') module.exports = { generarArchivos: generarArchivos, numSiif: numSiif };
