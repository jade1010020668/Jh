/* ================= INTERFAZ ================= */
'use strict';
var estado = { datos: null, resultado: null, original: null, loteActual: null };

function $(id) { return document.getElementById(id); }
function fmt(n) { return (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function msgs(el, r) {
  var h = '';
  (r.errores || []).forEach(function (e) { h += '<div class="msg err">⛔ ' + esc(e) + '</div>'; });
  (r.avisos || []).forEach(function (a) { h += '<div class="msg warn">⚠️ ' + esc(a) + '</div>'; });
  $(el).innerHTML = h;
}

function tab(t) {
  ['nueva', 'bd', 'carga', 'maestros', 'admin'].forEach(function (x) {
    $('p-' + x).style.display = x === t ? '' : 'none';
    $('t-' + x).className = x === t ? 'act' : '';
  });
  if (t === 'bd') pintarBD();
  if (t === 'carga') { cargarDisponibles(); cargarLotes(); }
  if (t === 'maestros') pintarMaestros();
}

// ---------- Nueva liquidación ----------
var CAMPOS_EDIT = [['nombre', 'Nombre'], ['cedula', 'Cédula'], ['compromiso', 'Compromiso (RP)'], ['honorarios', 'Honorarios mensuales'], ['dias', 'Días'], ['responsableIva', 'Responsable IVA (SI/NO)'], ['planilla', 'Planilla (A/V)'], ['declarante', 'Declarante (SI/NO)'], ['pensionado', 'Pensionado (SI/NO)'], ['zona', 'Zona operativa'], ['dependientes', 'Dependientes (SI/NO)'], ['tarifa', 'Tarifa (383/387)'], ['prepagada', 'Prepagada (mes)'], ['vivienda', 'Vivienda (mes)'], ['orfeo', 'Radicado Orfeo'], ['dependencia', 'Dependencia'], ['facturador', 'Facturador (SI/NO)'], ['telefono', 'Teléfono'], ['observaciones', 'Observaciones']];

function analizar() {
  var r = parsearCodigo($('codigo').value);
  if (!r.ok && !r.campos) { msgs('msgParse', r); return; }
  var c = r.campos;
  var tar = DB.maestros.tarifas.filter(function (t) { return String(t.compromiso) === String(c.compromiso); })[0];
  c.tarifa = tar ? tar.tarifa : '';
  if (!tar) r.avisos.push('El compromiso ' + c.compromiso + ' no tiene tarifa (383/387) en el maestro. Asígnela en Maestros o edítela abajo.');
  if (c.tarifa === 387 && c.planilla !== 'A') r.errores.push('REGLA: la tarifa 387 exige planilla A (anticipado) y llegó "' + c.planilla + '".');
  var dup = DB.liquidaciones.filter(function (l) { return String(l.orfeo) === String(c.orfeo); });
  if (dup.length) r.avisos.push('El radicado ' + c.orfeo + ' ya tiene liquidación (consecutivo ' + dup[0].consecutivo + '). Si continúa, será una nueva VERSIÓN.');
  var prep = DB.maestros.prepagada.filter(function (p) { return String(p.compromiso) === String(c.compromiso); })[0];
  var viv = DB.maestros.vivienda.filter(function (v) { return String(v.compromiso) === String(c.compromiso); })[0];
  c.prepagada = prep ? prep.valorMensual : 0;
  c.vivienda = viv ? viv.valorMensual : 0;
  r.ok = r.errores.length === 0;
  msgs('msgParse', r);
  estado.datos = c; c.codigoOriginal = $('codigo').value.trim();
  estado.original = JSON.parse(JSON.stringify(c));
  var f = $('form'); f.innerHTML = '';
  CAMPOS_EDIT.forEach(function (cc) {
    var v = c[cc[0]] != null ? c[cc[0]] : '';
    f.innerHTML += '<div><label>' + cc[1] + '</label><input id="f_' + cc[0] + '" value="' + esc(v) + '" oninput="this.className=\'editado\'"></div>';
  });
  $('cardForm').style.display = ''; $('cardLiq').style.display = 'none';
}
function leerForm() {
  CAMPOS_EDIT.forEach(function (cc) { estado.datos[cc[0]] = $('f_' + cc[0]).value; });
  estado.datos.honorarios = Number(String(estado.datos.honorarios).replace(',', '.'));
  estado.datos.dias = Number(String(estado.datos.dias).replace(',', '.'));
}
function ediciones() {
  var e = [];
  CAMPOS_EDIT.forEach(function (cc) {
    var o = estado.original[cc[0]] != null ? estado.original[cc[0]] : '';
    if (String(estado.datos[cc[0]]) !== String(o)) e.push({ campo: cc[0], antes: o, despues: estado.datos[cc[0]] });
  });
  return e;
}
function previsualizar() {
  leerForm();
  var d = estado.datos;
  if (parseInt(d.tarifa, 10) === 387 && String(d.planilla).toUpperCase() !== 'A') { msgs('msgForm', { errores: ['La tarifa 387 exige planilla A (anticipado).'] }); return; }
  if (!d.tarifa) { msgs('msgForm', { errores: ['Falta la tarifa (383/387). Edítela arriba o agréguela en Maestros.'] }); return; }
  msgs('msgForm', {});
  var x = liquidar(d); estado.resultado = x;
  var filas = [['Honorario del período', x.honPeriodo], ['Base (neto de IVA)', x.neto], ['— Aportes (salud+pensión+ARL)', x.salud + x.pension + x.arl], ['— Dependientes', x.dependientes], ['— Prepagada', x.prepagada], ['— Vivienda', x.vivienda], ['Base retefuente (' + (x.pctExenta * 100) + '% exenta)', x.baseRetefuente], ['RETEFUENTE (DIAN)', x.retefuente], ['Base ICA — ' + x.lugar, x.baseIca], ['RETEICA (' + (x.tarifaIca * 100).toFixed(3) + '%)', x.ica], ['RETEIVA', x.reteIva], ['Pro-universidades', x.proUniversidades], ['Pro-hospitales', x.proHospitales], ['Sobretasa bomberil', x.bomberil]];
  var h = '<table class="liq">';
  filas.forEach(function (f) { if (f[1] || f[0].indexOf('Base') === 0 || f[0].indexOf('Honorario') === 0) h += '<tr><td>' + f[0] + '</td><td class="v">' + fmt(f[1]) + '</td></tr>'; });
  h += '<tr class="total"><td>TOTAL DEDUCCIONES</td><td class="v">' + fmt(x.totalDeducciones) + '</td></tr>';
  h += '<tr class="total"><td>NETO A PAGAR</td><td class="v">' + fmt(x.netoAPagar) + '</td></tr></table>';
  $('liq').innerHTML = h; $('cardLiq').style.display = '';
}
function guardar() {
  var d = estado.datos, x = estado.resultado;
  var dup = DB.liquidaciones.filter(function (l) { return String(l.orfeo) === String(d.orfeo); });
  var consecutivo, version;
  if (dup.length) { consecutivo = dup[0].consecutivo; version = Math.max.apply(null, dup.map(function (l) { return l.version; })) + 1; }
  else { DB.consecutivo++; consecutivo = DB.consecutivo; version = 1; }
  var reg = { consecutivo: consecutivo, version: version, fecha: new Date().toISOString(), liquidadoPor: usuarioActual(), estado: 'LIQUIDADA' };
  CAMPOS_EDIT.forEach(function (cc) { reg[cc[0]] = d[cc[0]]; });
  reg.tarifa = d.tarifa; reg.zona = d.zona; reg.numCuenta = d.numCuenta; reg.key = d.key;
  ['honPeriodo', 'neto', 'baseRetefuente', 'retefuente', 'baseIca', 'tarifaIca', 'ica', 'reteIva', 'proUniversidades', 'proHospitales', 'bomberil', 'totalDeducciones', 'netoAPagar', 'prepagada', 'vivienda'].forEach(function (k) { reg[k] = x[k]; });
  reg.ediciones = ediciones(); reg.codigoOriginal = d.codigoOriginal;
  DB.liquidaciones.push(reg);
  auditar('LIQUIDAR', consecutivo, 'v' + version + ' orfeo ' + d.orfeo + ' ' + d.nombre);
  guardarDB();
  $('msgGuardar').innerHTML = '<span class="msg ok">✅ Guardada — consecutivo <b>' + consecutivo + '</b> (versión ' + version + '). <a href="#" onclick="imprimirComprobante(' + consecutivo + ',' + version + ');return false">Ver/Imprimir comprobante (PDF)</a></span>';
  $('cardForm').style.display = 'none'; $('cardLiq').style.display = 'none'; $('codigo').value = '';
}

// ---------- Comprobante imprimible ----------
function imprimirComprobante(consecutivo, version) {
  var reg = DB.liquidaciones.filter(function (l) { return l.consecutivo === consecutivo && l.version === version; })[0];
  if (!reg) return;
  var zonas = zonasMap(); var zi = zonas[parseInt(reg.zona, 10)] || {};
  function fila(concepto, base, tarifa, valor, nit, ben) {
    if (!valor) return '';
    return '<tr><td>' + concepto + '</td><td class="v">' + fmt(base) + '</td><td class="v">' + (tarifa ? (tarifa * 100).toFixed(3) + '%' : '') + '</td><td class="v">' + fmt(valor) + '</td><td>' + (nit || '') + '</td><td>' + (ben || '') + '</td></tr>';
  }
  var w = window.open('', '_blank');
  w.document.write('<html><head><meta charset="utf-8"><title>' + reg.orfeo + '_liquidacion</title><style>body{font-family:Arial;font-size:12px;margin:24px}h1{font-size:15px;text-align:center;margin:2px}h2{font-size:11px;text-align:center;font-weight:normal}table{border-collapse:collapse;width:100%;margin-top:10px}td,th{border:1px solid #999;padding:5px 7px}th{background:#1F4E79;color:#fff;text-align:left}.v{text-align:right}.tot{font-weight:bold;background:#eef}.enc td{border:0;padding:2px}</style></head><body>' +
    '<h1>LIQUIDACIÓN DE IMPUESTOS</h1><h2>DOCUMENTO EQUIVALENTE - CONTRATISTAS · GF-F031 · Consecutivo ' + reg.consecutivo + ' v' + reg.version + '</h2>' +
    '<table class="enc"><tr><td><b>Nombre:</b> ' + esc(reg.nombre) + '</td><td><b>Cédula:</b> ' + esc(reg.cedula) + '</td><td><b>Radicado Orfeo:</b> ' + esc(reg.orfeo) + '</td></tr>' +
    '<tr><td><b>Contrato/RP:</b> ' + esc(reg.compromiso) + '</td><td><b>Dependencia:</b> ' + esc(reg.dependencia) + '</td><td><b>Ciudad:</b> ' + esc(zi.lugar || '') + '</td></tr>' +
    '<tr><td><b>Honorario mensual:</b> ' + fmt(reg.honorarios) + '</td><td><b>Días:</b> ' + reg.dias + '</td><td><b>Honorario período:</b> ' + fmt(reg.honPeriodo) + '</td></tr>' +
    '<tr><td><b>Planilla:</b> ' + esc(reg.planilla) + '</td><td><b>Tarifa:</b> ' + esc(reg.tarifa) + '</td><td><b>Fecha:</b> ' + reg.fecha.slice(0, 16).replace('T', ' ') + '</td></tr></table>' +
    '<table><tr><th>CONCEPTO</th><th>BASE</th><th>TARIFA</th><th>IMPUESTO</th><th>NIT</th><th>BENEFICIARIO</th></tr>' +
    fila('RETENCIÓN EN LA FUENTE', reg.baseRetefuente, reg.baseRetefuente ? reg.retefuente / reg.baseRetefuente : 0, reg.retefuente, '800197268', 'U.A.E. DIAN') +
    fila('RETENCIÓN DE ICA', reg.baseIca, reg.tarifaIca, reg.ica, zi.nitAlcaldia, zi.nombreAlcaldia) +
    fila('RETENCIÓN DE IVA', 0, 0.15, reg.reteIva, '800197268', 'U.A.E. DIAN') +
    fila('PRO-UNIVERSIDADES', reg.baseIca, 0.005, reg.proUniversidades, zi.nitExtra, zi.beneficiarioExtra) +
    fila('PRO-HOSPITALES', reg.ica, 0, reg.proHospitales, zi.nitExtra, zi.beneficiarioExtra) +
    fila('SOBRETASA BOMBERIL', reg.baseIca, 0.02, reg.bomberil, zi.nitExtra, zi.beneficiarioExtra) +
    '<tr class="tot"><td>TOTAL DEDUCCIONES</td><td></td><td></td><td class="v">' + fmt(reg.totalDeducciones) + '</td><td></td><td></td></tr>' +
    '<tr class="tot"><td>NETO A PAGAR</td><td></td><td></td><td class="v">' + fmt(reg.netoAPagar) + '</td><td></td><td></td></tr></table>' +
    '<p style="color:#666;margin-top:14px">Guarde este documento como <b>' + esc(reg.orfeo) + '_liquidacion.pdf</b> (Imprimir → Guardar como PDF).</p>' +
    '<script>setTimeout(function(){window.print()},300)<\/script></body></html>');
  w.document.close();
}

// ---------- Base de datos ----------
function pintarBD() {
  var q = ($('filtro').value || '').toLowerCase();
  var cols = [['consecutivo', 'Consec.'], ['version', 'v'], ['fecha', 'Fecha'], ['liquidadoPor', 'Por'], ['estado', 'Estado'], ['nombre', 'Nombre'], ['cedula', 'Cédula'], ['orfeo', 'Orfeo'], ['compromiso', 'RP'], ['dias', 'Días'], ['tarifa', 'Tar.'], ['neto', 'Neto'], ['retefuente', 'Retef.'], ['ica', 'ICA'], ['netoAPagar', 'A pagar']];
  var h = '<tr>'; cols.forEach(function (c) { h += '<th>' + c[1] + '</th>'; }); h += '<th></th></tr>';
  var n = 0;
  DB.liquidaciones.slice().reverse().forEach(function (l) {
    var texto = [l.consecutivo, l.nombre, l.cedula, l.orfeo, l.compromiso].join(' ').toLowerCase();
    if (q && texto.indexOf(q) < 0) return;
    n++;
    h += '<tr' + (l.estado === 'ELIMINADA' ? ' style="opacity:.5;text-decoration:line-through"' : '') + '>';
    cols.forEach(function (c) {
      var v = l[c[0]];
      if (c[0] === 'fecha') v = String(v).slice(0, 16).replace('T', ' ');
      if (['neto', 'retefuente', 'ica', 'netoAPagar'].indexOf(c[0]) >= 0) v = fmt(v);
      h += '<td>' + (v != null ? v : '') + '</td>';
    });
    h += '<td><button onclick="imprimirComprobante(' + l.consecutivo + ',' + l.version + ')">PDF</button></td></tr>';
  });
  $('tablaBD').innerHTML = h;
  $('bdTotal').textContent = n + ' registros · ' + DB.liquidaciones.length + ' filas totales';
}

// ---------- Carga masiva ----------
function ultimasVersiones() {
  var u = {};
  DB.liquidaciones.forEach(function (l) { var k = l.consecutivo; if (!u[k] || l.version > u[k].version) u[k] = l; });
  return u;
}
function enLoteActivo() {
  var activos = {}; DB.lotes.forEach(function (lt) { if (['ABIERTO', 'GENERADO'].indexOf(lt.estado) >= 0) activos[lt.id] = true; });
  var en = {}; DB.loteItems.forEach(function (it) { if (activos[it.loteId] && it.incluido !== 'QUITADO') en[it.consecutivo] = true; });
  return en;
}
function cargarDisponibles() {
  var u = ultimasVersiones(), en = enLoteActivo();
  var h = '<tr><th></th><th>Consec.</th><th>Nombre</th><th>Orfeo</th><th>RP</th><th>Neto</th><th>Retef.</th><th>ICA</th><th>Estado</th></tr>';
  var n = 0;
  Object.keys(u).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
    var l = u[k]; if (l.estado !== 'LIQUIDADA') return; n++;
    h += '<tr><td>' + (en[k] ? '🔒' : '<input type="checkbox" class="chk" value="' + k + '">') + '</td><td>' + k + ' v' + l.version + '</td><td>' + esc(l.nombre) + '</td><td>' + esc(l.orfeo) + '</td><td>' + esc(l.compromiso) + '</td><td class="v">' + fmt(l.neto) + '</td><td class="v">' + fmt(l.retefuente) + '</td><td class="v">' + fmt(l.ica) + '</td><td>' + (en[k] ? '<span class="pill">en lote</span>' : 'disponible') + '</td></tr>';
  });
  $('tablaDisp').innerHTML = h; $('dispTotal').textContent = n + ' liquidaciones';
}
function crearLote() {
  var sel = [].slice.call(document.querySelectorAll('.chk:checked')).map(function (c) { return Number(c.value); });
  if (!sel.length) { $('msgLote').innerHTML = '<div class="msg err">Seleccione al menos una liquidación.</div>'; return; }
  if (sel.length > 200) { $('msgLote').innerHTML = '<div class="msg err">Máximo 200 por lote.</div>'; return; }
  DB.loteSeq++; var id = DB.loteSeq;
  DB.lotes.push({ id: id, nombre: $('nombreLote').value || ('Lote ' + id), estado: 'ABIERTO', fecha: new Date().toISOString(), creadoPor: usuarioActual() });
  sel.forEach(function (c) { DB.loteItems.push({ loteId: id, consecutivo: c, incluido: 'SI', motivo: '' }); });
  auditar('LOTE_CREAR', id, sel.length + ' liquidaciones'); guardarDB();
  $('msgLote').innerHTML = '<div class="msg ok">✅ Lote ' + id + ' creado</div>';
  cargarDisponibles(); cargarLotes(); verLote(id);
}
function cargarLotes() {
  var h = '<table><tr><th>Id</th><th>Nombre</th><th>Estado</th><th>Fecha</th><th></th></tr>';
  DB.lotes.slice().reverse().forEach(function (l) {
    h += '<tr><td>' + l.id + '</td><td>' + esc(l.nombre) + '</td><td><span class="pill">' + l.estado + '</span></td><td>' + String(l.fecha).slice(0, 16).replace('T', ' ') + '</td><td><button onclick="verLote(' + l.id + ')">Abrir</button></td></tr>';
  });
  $('lotes').innerHTML = h + '</table>';
}
function verLote(id) {
  estado.loteActual = id;
  var lt = DB.lotes.filter(function (l) { return l.id === id; })[0];
  $('tituloLote').textContent = '3 · ' + lt.nombre + ' (id ' + id + ')';
  $('cardLote').style.display = '';
  var u = ultimasVersiones();
  var h = '<tr><th>Consec.</th><th>Nombre</th><th>Orfeo</th><th>RP</th><th>Neto</th><th>¿Sube?</th><th>Motivo</th><th>Acciones</th></tr>';
  DB.loteItems.filter(function (it) { return it.loteId === id && it.incluido !== 'QUITADO'; }).forEach(function (it) {
    var l = u[it.consecutivo] || {};
    h += '<tr><td>' + it.consecutivo + '</td><td>' + esc(l.nombre) + '</td><td>' + esc(l.orfeo) + '</td><td>' + esc(l.compromiso) + '</td><td class="v">' + fmt(l.neto) + '</td><td>' + (it.incluido === 'SI' ? '✅' : '🚫 no sube') + '</td><td>' + esc(it.motivo) + '</td><td>' + (it.incluido === 'SI' ? '<button onclick="marcarItem(' + it.consecutivo + ',\'excluir\')">Excluir</button>' : '<button onclick="marcarItem(' + it.consecutivo + ',\'incluir\')">Incluir</button>') + ' <button onclick="marcarItem(' + it.consecutivo + ',\'quitar\')">Quitar</button></td></tr>';
  });
  $('tablaLote').innerHTML = h; $('msgCarga').innerHTML = '';
}
function marcarItem(consecutivo, accion) {
  var motivo = accion === 'excluir' ? (prompt('Motivo de exclusión (p. ej. "no sube en carga masiva"):') || '') : '';
  DB.loteItems.forEach(function (it) {
    if (it.loteId === estado.loteActual && it.consecutivo === consecutivo) {
      it.incluido = accion === 'incluir' ? 'SI' : accion === 'excluir' ? 'NO' : 'QUITADO'; it.motivo = motivo;
    }
  });
  auditar('LOTE_ITEM', estado.loteActual, 'consecutivo ' + consecutivo + ' → ' + accion); guardarDB();
  verLote(estado.loteActual); cargarDisponibles();
}
function descargar(nombre, contenido) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
  a.download = nombre; a.click();
}
function generarCarga() {
  var id = estado.loteActual;
  var u = ultimasVersiones();
  var comp = maestroObj(DB.maestros.compromisosSiif, 'numeroDocumento');
  var incluidos = DB.loteItems.filter(function (it) { return it.loteId === id && it.incluido === 'SI'; });
  var registros = incluidos.map(function (it) {
    var l = u[it.consecutivo]; var cs = comp[String(l.compromiso).trim()] || {};
    return { nombre: l.nombre, compromiso: String(l.compromiso).trim(), key: l.key, orfeo: l.orfeo, zona: l.zona, neto: Number(l.neto), baseIca: Number(l.baseIca), ica: Number(l.ica), baseRetefuente: Number(l.baseRetefuente), retefuente: Number(l.retefuente), dependencia: cs.dependencia || '', rubro: cs.rubro || '', saldo: cs.saldo != null ? cs.saldo : null, convenio: false, docSoporte: l.orfeo };
  });
  var hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  var res = generarArchivos(registros, hoy);
  if (res.errores.length) { $('msgCarga').innerHTML = res.errores.map(function (e) { return '<div class="msg err">⛔ ' + esc(e) + '</div>'; }).join(''); return; }
  descargar('1_Maestro.txt', res.maestro); descargar('2_Item.txt', res.item);
  if (res.deducciones) descargar('3_Deducciones.txt', res.deducciones);
  if (res.usos) descargar('4_Usos.txt', res.usos);
  DB.lotes.forEach(function (l) { if (l.id === id) l.estado = 'GENERADO'; });
  auditar('LOTE_GENERAR', id, res.total + ' obligaciones'); guardarDB();
  $('msgCarga').innerHTML = '<div class="msg ok">✅ ' + res.total + ' obligaciones — 4 archivos descargados. Comprima cada .txt en .zip, fírmelo (.zip.p7z) con su token y cárguelo en SIIF → CARGA → EPG → Obligación.</div>';
  cargarLotes();
}
async function pedirReset() {
  var clave = prompt('Clave de superadministrador:'); if (clave === null) return;
  if (!DB.superadminHash) { $('msgCarga').innerHTML = '<div class="msg err">Primero defina la clave en la pestaña Superadmin.</div>'; return; }
  if (await hash(clave) !== DB.superadminHash) { $('msgCarga').innerHTML = '<div class="msg err">Clave incorrecta.</div>'; return; }
  var codigo = String(Math.floor(100000 + Math.random() * 900000));
  var cod = prompt('Código de confirmación: ' + codigo + '\n\nEscríbalo para confirmar el RESET del lote:');
  if (cod !== codigo) { $('msgCarga').innerHTML = '<div class="msg err">Código inválido.</div>'; return; }
  DB.lotes.forEach(function (l) { if (l.id === estado.loteActual) l.estado = 'RESETEADO'; });
  auditar('LOTE_RESET', estado.loteActual, 'restablecido'); guardarDB();
  $('msgCarga').innerHTML = '<div class="msg ok">✅ Lote restablecido; las liquidaciones quedaron libres.</div>';
  cargarLotes(); cargarDisponibles();
}

// ---------- Maestros (editables) ----------
var MAESTRO_DEFS = {
  tarifas: { titulo: 'TARIFAS (383/387 por compromiso)', cols: ['compromiso', 'tarifa', 'responsable'] },
  prepagada: { titulo: 'PREPAGADA (valor mensual)', cols: ['compromiso', 'valorMensual'] },
  vivienda: { titulo: 'VIVIENDA (valor mensual)', cols: ['compromiso', 'valorMensual'] },
  zonas: { titulo: 'ZONAS (ICA)', cols: ['zona', 'lugar', 'tarifaIca', 'nitAlcaldia', 'nombreAlcaldia', 'conceptoExtra', 'nitExtra', 'beneficiarioExtra'] },
  paramRubros: { titulo: 'PARÁMETROS DE RUBROS (contabilidad SIIF)', cols: ['rubro', 'recurso', 'situacion', 'fuente', 'tipoGasto', 'tipoOperacion', 'usoContable', 'cuentaContable', 'usoPresupuestal'] },
  compromisosSiif: { titulo: 'COMPROMISOS SIIF (export CEN)', cols: ['numeroDocumento', 'dependencia', 'dependenciaDescripcion', 'rubro', 'fuente', 'recurso', 'situacion', 'saldoPorUtilizar'] }
};
function pintarMaestros() {
  var h = '<div style="margin-bottom:10px"><select id="selMaestro" onchange="pintarUnMaestro()">';
  Object.keys(MAESTRO_DEFS).forEach(function (k) { h += '<option value="' + k + '">' + MAESTRO_DEFS[k].titulo + '</option>'; });
  h += '</select> <button class="primario" onclick="agregarFilaMaestro()">+ Agregar fila</button> <button class="primario" onclick="guardarMaestro()">💾 Guardar</button></div><div id="maestroTabla"></div>' +
    '<div class="card" style="margin-top:16px"><h2>Parámetros de vigencia</h2><div id="paramTabla"></div><button class="primario" onclick="guardarParametros()">💾 Guardar parámetros</button></div>';
  $('maestros').innerHTML = h;
  pintarUnMaestro(); pintarParametros();
}
function pintarUnMaestro() {
  var k = $('selMaestro').value, def = MAESTRO_DEFS[k], filas = DB.maestros[k];
  var h = '<table><tr>'; def.cols.forEach(function (c) { h += '<th>' + c + '</th>'; }); h += '<th></th></tr>';
  filas.forEach(function (fila, i) {
    h += '<tr>';
    def.cols.forEach(function (c) { h += '<td><input data-k="' + k + '" data-i="' + i + '" data-c="' + c + '" value="' + esc(fila[c]) + '" style="width:100%;border:1px solid #cbd3dc;padding:4px;border-radius:4px"></td>'; });
    h += '<td><button onclick="borrarFilaMaestro(\'' + k + '\',' + i + ')">✕</button></td></tr>';
  });
  $('maestroTabla').innerHTML = h + '</table>';
}
function agregarFilaMaestro() { var k = $('selMaestro').value; var o = {}; MAESTRO_DEFS[k].cols.forEach(function (c) { o[c] = ''; }); DB.maestros[k].push(o); pintarUnMaestro(); }
function borrarFilaMaestro(k, i) { DB.maestros[k].splice(i, 1); pintarUnMaestro(); }
function guardarMaestro() {
  var k = $('selMaestro').value;
  document.querySelectorAll('[data-k="' + k + '"]').forEach(function (inp) {
    var i = +inp.getAttribute('data-i'), c = inp.getAttribute('data-c'), v = inp.value;
    if (['tarifa', 'valorMensual', 'tarifaIca', 'zona', 'saldoPorUtilizar'].indexOf(c) >= 0 && v !== '') v = Number(String(v).replace(',', '.'));
    if (DB.maestros[k][i]) DB.maestros[k][i][c] = v;
  });
  auditar('MAESTRO:' + k, '', DB.maestros[k].length + ' filas'); guardarDB();
  alert('Maestro ' + k + ' guardado (' + DB.maestros[k].length + ' filas).');
}
function pintarParametros() {
  var p = DB.parametros;
  var h = '<table>';
  ['uvt', 'pctSalud', 'pctPension', 'pctArl', 'pctIbc', 'pctDependientes', 'pctExenta387', 'iva', 'pctReteIva'].forEach(function (k) {
    h += '<tr><td>' + k + '</td><td><input id="pp_' + k + '" value="' + p[k] + '" style="border:1px solid #cbd3dc;padding:4px;border-radius:4px"></td></tr>';
  });
  $('paramTabla').innerHTML = h + '</table>';
}
function guardarParametros() {
  ['uvt', 'pctSalud', 'pctPension', 'pctArl', 'pctIbc', 'pctDependientes', 'pctExenta387', 'iva', 'pctReteIva'].forEach(function (k) {
    DB.parametros[k] = Number(String($('pp_' + k).value).replace(',', '.'));
  });
  auditar('PARAMETROS', '', 'actualizados'); guardarDB(); alert('Parámetros guardados.');
}

// ---------- Superadmin y respaldo ----------
async function definirClave() {
  var c = $('saNueva').value; if (!c) { alert('Escriba una clave.'); return; }
  DB.superadminHash = await hash(c); guardarDB(); $('saNueva').value = '';
  $('msgSA').innerHTML = '<div class="msg ok">✅ Clave de superadmin definida.</div>';
}
async function saAccion(accion) {
  if (!DB.superadminHash) { $('msgSA').innerHTML = '<div class="msg err">Primero defina la clave.</div>'; return; }
  if (await hash($('saClave').value) !== DB.superadminHash) { $('msgSA').innerHTML = '<div class="msg err">Clave incorrecta.</div>'; auditar('SUPERADMIN_RECHAZADO', '', accion); guardarDB(); return; }
  var cons = Number($('saCons').value), ver = Number($('saVer').value || 0);
  var regs = DB.liquidaciones.filter(function (l) { return l.consecutivo === cons && (!ver || l.version === ver); });
  var reg = regs[regs.length - 1];
  if (!reg) { $('msgSA').innerHTML = '<div class="msg err">No se encontró el consecutivo ' + cons + '.</div>'; return; }
  if (accion === 'editar') {
    var col = $('saCol').value, val = $('saVal').value, ant = reg[col];
    if (!(col in reg)) { $('msgSA').innerHTML = '<div class="msg err">Columna "' + col + '" no existe.</div>'; return; }
    reg[col] = val; auditar('SUPERADMIN_EDITAR', cons, col + ': "' + ant + '" → "' + val + '"'); guardarDB();
    $('msgSA').innerHTML = '<div class="msg ok">✅ Editado (auditado). Si cambió datos de cálculo, reliquide con el código original.</div>';
  } else if (accion === 'eliminar') {
    reg.estado = 'ELIMINADA'; auditar('SUPERADMIN_ELIMINAR', cons, 'estado → ELIMINADA'); guardarDB();
    $('msgSA').innerHTML = '<div class="msg ok">✅ Eliminada (lógico, auditado).</div>';
  }
}
function exportarRespaldo() { descargar('respaldo_liquidador_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(DB)); }
function importarRespaldo(input) {
  var f = input.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () { try { DB = JSON.parse(r.result); guardarDB(); alert('Respaldo importado.'); location.reload(); } catch (e) { alert('Archivo inválido.'); } };
  r.readAsText(f);
}
function verAuditoria() {
  var h = '<table><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Consec.</th><th>Detalle</th></tr>';
  DB.auditoria.slice().reverse().slice(0, 200).forEach(function (a) {
    h += '<tr><td>' + a.fecha.slice(0, 16).replace('T', ' ') + '</td><td>' + esc(a.usuario) + '</td><td>' + esc(a.accion) + '</td><td>' + (a.consecutivo || '') + '</td><td>' + esc(a.detalle) + '</td></tr>';
  });
  $('auditoria').innerHTML = h + '</table>';
}

// Init
window.addEventListener('DOMContentLoaded', function () {
  var u = localStorage.getItem('liq_usuario');
  if (!u) { u = prompt('Su nombre o correo (para la trazabilidad):') || 'usuario'; localStorage.setItem('liq_usuario', u); }
  $('usuario').textContent = u;
});
