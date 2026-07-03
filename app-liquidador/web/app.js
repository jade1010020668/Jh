/* ================================================================
   LIQUIDADOR IDEAM — aplicación autónoma (navegador, sin servidor)
   Motor validado 100% contra el Excel. Datos en localStorage.
   ================================================================ */
'use strict';

// ---------- Almacenamiento ----------
var DB_KEY = 'liq_ideam_v1';
function cargarDB() {
  var d = localStorage.getItem(DB_KEY);
  if (d) { try { return JSON.parse(d); } catch (e) {} }
  return null;
}
function guardarDB() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

var DB = cargarDB() || inicializar();

function inicializar() {
  var db = {
    consecutivo: 0, loteSeq: 0,
    liquidaciones: [], lotes: [], loteItems: [], auditoria: [],
    maestros: {
      zonas: SEED.zonas.map(function (z) { return { zona: z[0], lugar: z[1], tarifaIca: z[2], nitAlcaldia: z[3], nombreAlcaldia: z[4], conceptoExtra: z[5], nitExtra: z[6], beneficiarioExtra: z[7] }; }),
      prepagada: SEED.prepagada.map(function (p) { return { compromiso: String(p[0]), valorMensual: p[1] }; }),
      vivienda: SEED.vivienda.map(function (v) { return { compromiso: String(v[0]), valorMensual: v[1] }; }),
      tarifas: SEED.tarifas.map(function (t) { return { compromiso: String(t[0]), tarifa: t[1], responsable: t[2] }; }),
      paramRubros: SEED.paramRubros.map(function (r) { return { rubro: r[0], recurso: r[1], situacion: r[2], fuente: r[3], tipoGasto: r[4], tipoOperacion: r[5], usoContable: r[6], cuentaContable: r[7], usoPresupuestal: r[8] }; }),
      compromisosSiif: (SEED.compromisosSiif || []).map(function (c) { return { numeroDocumento: String(c[0]), dependencia: String(c[1]), dependenciaDescripcion: String(c[2]), rubro: String(c[3]), fuente: String(c[4]), recurso: String(c[5]), situacion: String(c[6]), saldoPorUtilizar: c[7] }; }),
      configSiif: { pci: '32-02-00-000', tipoCuentaCxp: '103', tipoDocSoporte: '11', expedidor: '11', atributoNormal: '5', atributoConvenio: '25', nitDian: '800197268', posRetefuente: '2-01-04-01-29', posIcaBogota: '2-01-05-01-01-03-05', posIcaOtros: '2-01-05-01-97', funcionario: '', cargoFuncionario: '' }
    },
    parametros: {
      uvt: 49799, pctSalud: 0.125, pctPension: 0.16, pctArl: 0.01044, pctIbc: 0.40,
      pctDependientes: 0.10, pctExenta387: 0.25, iva: 0.19, pctReteIva: 0.15,
      tabla383: [[0, 95, 0, 0], [95, 150, 0.19, 0], [150, 360, 0.28, 10], [360, 640, 0.33, 69], [640, 945, 0.35, 162], [945, 2300, 0.37, 268], [2300, Infinity, 0.39, 770]]
    },
    superadminHash: null  // se define en el primer uso
  };
  return db;
}

function auditar(accion, consecutivo, detalle) {
  DB.auditoria.push({ fecha: new Date().toISOString(), usuario: usuarioActual(), accion: accion, consecutivo: consecutivo, detalle: detalle });
}
function usuarioActual() { return localStorage.getItem('liq_usuario') || 'usuario'; }

// ---------- Hash (SHA-256 vía SubtleCrypto, con fallback simple) ----------
async function hash(s) {
  if (window.crypto && crypto.subtle) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return String(h);
}

// ---------- Redondeos Excel ----------
function roundExcel(x, d) { if (x == null) return null; var m = Math.pow(10, d); return (x < 0 ? -1 : 1) * Math.floor(Math.abs(x) * m + 0.5) / m; }
function roundupExcel(x, d) { var m = Math.pow(10, d); var v = Math.ceil(Math.round(Math.abs(x) * m * 1e10) / 1e10); return (x < 0 ? -1 : 1) * v / m; }

// ---------- Motor de liquidación ----------
function maestroMap(arr, k, v) { var o = {}; arr.forEach(function (r) { o[String(r[k])] = r[v]; }); return o; }
function zonasMap() { var o = {}; DB.maestros.zonas.forEach(function (z) { o[z.zona] = z; }); return o; }

function liquidar(r) {
  var p = DB.parametros;
  var prep = maestroMap(DB.maestros.prepagada, 'compromiso', 'valorMensual');
  var viv = maestroMap(DB.maestros.vivienda, 'compromiso', 'valorMensual');
  var zonas = zonasMap();

  var honPeriodo = r.honorarios * r.dias / 30;
  var respIva = String(r.responsableIva || 'NO').trim().toUpperCase() === 'SI';
  var neto = respIva ? honPeriodo / (1 + p.iva) : honPeriodo;
  var anticipado = String(r.planilla || '').trim().toUpperCase() === 'A';
  var pensionado = String(r.pensionado || 'NO').trim().toUpperCase() === 'SI';
  var zona = parseInt(r.zona, 10);

  var baseAporte = neto * p.pctIbc;
  var saludIca = roundupExcel(baseAporte * p.pctSalud, -2);
  var pensionIca = roundupExcel(baseAporte * p.pctPension, -2);
  var baseIca;
  if (zona === 11) {
    if (anticipado && !pensionado) baseIca = neto - saludIca - pensionIca;
    else if (anticipado && pensionado) baseIca = neto - saludIca;
    else baseIca = neto;
  } else baseIca = neto;
  baseIca += (r.viaticos || 0);
  var zi = zonas[zona] || {};
  var tarifaIca = Number(zi.tarifaIca || 0);
  var ica = baseIca * tarifaIca;

  var ibc = neto * p.pctIbc;
  var salud = anticipado ? ibc * p.pctSalud : 0;
  var pension = anticipado ? ibc * p.pctPension : 0;
  var arl = anticipado ? ibc * p.pctArl : 0;
  var depend = String(r.dependientes || 'NO').trim().toUpperCase() === 'SI' ? neto * p.pctDependientes : 0;
  var prepagada = Number(prep[String(r.compromiso)] || 0);
  var vivienda = Number(viv[String(r.compromiso)] || 0);
  var rentaLiquida = neto - salud - pension - arl - depend - prepagada - vivienda;
  var pctExenta = parseInt(r.tarifa, 10) === 387 ? p.pctExenta387 : 0;
  var baseRetefuente = rentaLiquida - rentaLiquida * pctExenta;
  var baseUvt = baseRetefuente / p.uvt;

  var retefuente = 0;
  for (var i = 0; i < p.tabla383.length; i++) {
    var t = p.tabla383[i];
    var hasta = t[1] === null ? Infinity : t[1];
    if (baseUvt > t[0] && (baseUvt <= hasta || hasta === Infinity)) {
      retefuente = t[2] === 0 ? 0 : roundExcel((baseUvt - t[0]) * t[2] * p.uvt + t[3] * p.uvt, -3);
      break;
    }
  }

  var reteIvaBase = respIva ? (honPeriodo / (1 + p.iva)) * p.iva : 0;
  var reteIva = respIva ? reteIvaBase * p.pctReteIva : 0;
  var proUniversidades = zona === 7 ? baseIca * 0.005 : 0;
  var proHospitales = (zona === 8 || zona === 10) ? ica * (zona === 8 ? 0.10 : 0.06) : 0;
  var bomberil = zona === 5 ? roundExcel(baseIca * 0.02, -3) : 0;
  var totalDeducciones = retefuente + ica + reteIva + proUniversidades + proHospitales + bomberil;

  return {
    honPeriodo: honPeriodo, neto: neto, baseIca: baseIca, tarifaIca: tarifaIca, ica: ica, lugar: zi.lugar || '',
    salud: salud, pension: pension, arl: arl, dependientes: depend, prepagada: prepagada, vivienda: vivienda,
    rentaLiquida: rentaLiquida, pctExenta: pctExenta, baseRetefuente: baseRetefuente, baseUvt: baseUvt,
    retefuente: retefuente, reteIvaBase: reteIvaBase, reteIva: reteIva, proUniversidades: proUniversidades,
    proHospitales: proHospitales, bomberil: bomberil, totalDeducciones: totalDeducciones,
    netoAPagar: honPeriodo - totalDeducciones
  };
}

// ---------- Parser del código Orfeo (27 campos) ----------
var CAMPOS = ['key', 'numCuenta', 'compromiso', 'nombre', 'cedula', 'honorarios', 'dias', 'responsableIva', 'valorHonorario', 'valorHonorarioResp', 'planilla', 'declarante', 'pensionado', 'zona', 'dependientes', 'nivelRiesgo', 'facturador', 'orfeo', 'dependencia', 'numCto', 'dctoEq', 'key2', 'contrato', 'relleno1', 'relleno2', 'relleno3', 'telefono'];
function esNum(s) { return /^\d+([.,]\d+)?$/.test(String(s).trim()); }

function parsearCodigo(codigo) {
  var errores = [], avisos = [];
  var partes = String(codigo || '').trim().split('-');
  if (partes.length < 27) return { ok: false, errores: ['El código tiene ' + partes.length + ' partes; se esperan 27. Verifique que esté completo.'] };
  if (partes.length > 27) {
    var extra = partes.length - 27, reparado = null;
    for (var en = extra; en >= 0; en--) {
      var ed = extra - en;
      var p = partes.slice(0, 3).concat([partes.slice(3, 4 + en).join('-')]).concat(partes.slice(4 + en, 18 + en)).concat([partes.slice(18 + en, 19 + en + ed).join('-')]).concat(partes.slice(19 + en + ed));
      if (p.length === 27 && esNum(p[4]) && esNum(p[5]) && esNum(p[6]) && /^\d{10,16}$/.test(String(p[17]).trim())) { reparado = p; break; }
    }
    if (!reparado) return { ok: false, errores: ['El código tiene ' + partes.length + ' partes (guiones extra) y no fue posible repararlo. Revíselo.'] };
    partes = reparado; avisos.push('El código traía guiones extra; se reparó automáticamente (verifique nombre y dependencia).');
  }
  var c = {};
  for (var i = 0; i < 27; i++) c[CAMPOS[i]] = String(partes[i] == null ? '' : partes[i]).trim();
  if (!esNum(c.cedula)) errores.push('La cédula (' + c.cedula + ') no es numérica.');
  if (!esNum(c.honorarios)) errores.push('Los honorarios (' + c.honorarios + ') no son numéricos.');
  if (!esNum(c.dias)) errores.push('Los días (' + c.dias + ') no son numéricos.');
  if (!/^\d{10,16}$/.test(c.orfeo)) errores.push('El radicado Orfeo (' + c.orfeo + ') no parece válido.');
  if (['A', 'V'].indexOf(c.planilla.toUpperCase()) < 0) errores.push('La planilla debe ser A o V (llegó "' + c.planilla + '").');
  if (Number(String(c.dias).replace(',', '.')) !== 30) avisos.push('Los días son ' + c.dias + ' (lo normal es 30). Puede editarlos antes de liquidar.');
  c.honorarios = Number(String(c.honorarios).replace(',', '.'));
  c.dias = Number(String(c.dias).replace(',', '.'));
  c.zona = parseInt(c.zona, 10);
  c.planilla = c.planilla.toUpperCase();
  return { ok: errores.length === 0, campos: c, errores: errores, avisos: avisos };
}

// ---------- Generador de la carga masiva ----------
function numSiif(x, dec) { if (x == null || isNaN(x)) return ''; return Number(x).toFixed(dec == null ? 2 : dec).replace('.', ','); }

function generarArchivos(registros, hoy) {
  var cfg = DB.maestros.configSiif;
  var rubros = maestroObj(DB.maestros.paramRubros, 'rubro');
  var zonas = zonasMap();
  var errores = [], maestro = [], item = [], deducciones = [], usos = [];
  if (registros.length === 0) errores.push('El lote no tiene obligaciones incluidas.');
  if (registros.length > 200) errores.push('Máximo 200 obligaciones por carga; hay ' + registros.length + '.');
  registros.forEach(function (d, idx) {
    var n = idx + 1;
    var pr = rubros[String(d.rubro || '').trim()];
    if (!d.rubro) { errores.push('#' + n + ' (' + d.nombre + '): compromiso ' + d.compromiso + ' sin rubro en COMPROMISOS_SIIF.'); return; }
    if (!pr) { errores.push('#' + n + ' (' + d.nombre + '): rubro ' + d.rubro + ' no está en PARAM_RUBROS.'); return; }
    if (!d.neto || d.neto <= 0) { errores.push('#' + n + ' (' + d.nombre + '): valor a obligar inválido.'); return; }
    if (d.saldo != null && d.neto > d.saldo) errores.push('#' + n + ' (' + d.nombre + '): valor ' + d.neto + ' supera el saldo del compromiso (' + d.saldo + ').');
    var atributo = d.convenio ? cfg.atributoConvenio : cfg.atributoNormal;
    var fechaPago = d.fechaPago || hoy;
    maestro.push([n, hoy, cfg.pci, d.compromiso, fechaPago, 'NO', cfg.tipoCuentaCxp, '0', cfg.tipoDocSoporte, d.docSoporte || d.orfeo, hoy.replace(/\//g, '-'), cfg.expedidor, cfg.funcionario || '', cfg.cargoFuncionario || '', (d.key || '') + ' PAGO HONORARIOS', '', ''].join('|'));
    var esMatriz = pr.tipoGasto !== '';
    var atNoNing = String(atributo) !== String(cfg.atributoNormal) && String(atributo) !== '5';
    var tipoGasto = '', usoContable = '', cuenta = '';
    if (atNoNing) {} else if (esMatriz) tipoGasto = pr.tipoGasto; else { usoContable = pr.usoContable; cuenta = pr.cuentaContable; }
    item.push([n, 1, d.dependencia, d.rubro, pr.recurso, pr.fuente, pr.situacion, numSiif(d.neto, 0), atributo, tipoGasto, pr.tipoOperacion, usoContable, cuenta].join('|'));
    var linea = 1, zona = zonas[parseInt(d.zona, 10)] || {};
    var icaValor = Math.round(d.ica || 0);
    if (icaValor > 0) {
      var pos = parseInt(d.zona, 10) === 11 ? cfg.posIcaBogota : cfg.posIcaOtros;
      var nit = parseInt(d.zona, 10) === 11 ? '899999061' : String(zona.nitAlcaldia || '');
      var tar = d.baseIca ? Math.round(icaValor / d.baseIca * 100 * 1e5) / 1e5 : 0;
      deducciones.push([n, linea++, pos, '01', nit, numSiif(d.baseIca, 2), numSiif(tar, 3), icaValor].join('|'));
    }
    var rf = Math.round(d.retefuente || 0);
    if (rf > 0) {
      var tarRf = d.baseRetefuente ? Math.round(rf / d.baseRetefuente * 100 * 1e5) / 1e5 : 0;
      deducciones.push([n, linea++, cfg.posRetefuente, '01', cfg.nitDian, numSiif(d.baseRetefuente, 2), numSiif(tarRf, 3), rf].join('|'));
    }
    if (pr.usoPresupuestal) usos.push([n, 1, pr.usoPresupuestal, numSiif(d.neto, 2)].join('|'));
  });
  return { errores: errores, maestro: maestro.join('\n'), item: item.join('\n'), deducciones: deducciones.join('\n'), usos: usos.join('\n'), total: registros.length };
}
function maestroObj(arr, key) { var o = {}; arr.forEach(function (r) { o[String(r[key]).trim()] = r; }); return o; }
