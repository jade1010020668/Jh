/**
 * MOTOR DE LIQUIDACIÓN — réplica exacta de las hojas ocultas '383' e 'ica'
 * de BASE_COMPLETA (IDEAM). Paridad verificada al 100% contra 78
 * liquidaciones reales (ver motor/PARIDAD.md).
 *
 * Este archivo funciona igual en Node.js (pruebas) y en Google Apps Script.
 */

/** ROUND de Excel: mitad SIEMPRE lejos de cero. */
function roundExcel(x, numDigits) {
  if (x === null || x === undefined) return null;
  var m = Math.pow(10, numDigits);
  return (x < 0 ? -1 : 1) * Math.floor(Math.abs(x) * m + 0.5) / m;
}

/** ROUNDUP de Excel: siempre lejos de cero. */
function roundupExcel(x, numDigits) {
  var m = Math.pow(10, numDigits);
  var v = Math.abs(x) * m;
  v = Math.ceil(Math.round(v * 1e10) / 1e10); // corrige ruido de flotantes
  return (x < 0 ? -1 : 1) * v / m;
}

/** Parámetros por vigencia (editables en la hoja PARAMETROS). */
var PARAMETROS_DEFECTO = {
  uvt: 49799,
  pctSalud: 0.125,
  pctPension: 0.16,
  pctArl: 0.01044,          // riesgo II (Concepto 0912/2018)
  pctIbc: 0.40,             // base de cotización = 40% del honorario
  pctDependientes: 0.10,
  pctExenta387: 0.25,       // renta exenta sólo con tarifa 387
  iva: 0.19,
  pctReteIva: 0.15,
  // tabla art. 383 E.T.: [desdeUVT, hastaUVT, tarifaMarginal, adiciónUVT]
  tabla383: [
    [0, 95, 0, 0],
    [95, 150, 0.19, 0],
    [150, 360, 0.28, 10],
    [360, 640, 0.33, 69],
    [640, 945, 0.35, 162],
    [945, 2300, 0.37, 268],
    [2300, Infinity, 0.39, 770]
  ]
};

/**
 * Liquida un radicado.
 * @param {Object} r  {honorarios, dias, responsableIva, planilla, pensionado,
 *                     zona, dependientes, tarifa, compromiso, viaticos}
 * @param {Object} m  maestros: {prepagada: {compromiso: valor}, vivienda: {...},
 *                     zonas: {zona: {lugar, tarifa, nitAlcaldia, nombreAlcaldia}}}
 * @param {Object} p  parámetros (PARAMETROS_DEFECTO)
 * @return {Object} liquidación completa con bases, valores y conceptos
 */
function liquidar(r, m, p) {
  p = p || PARAMETROS_DEFECTO;
  var honPeriodo = r.honorarios * r.dias / 30;                       // PAC!F
  var respIva = String(r.responsableIva || 'NO').trim().toUpperCase() === 'SI';
  var neto = respIva ? honPeriodo / (1 + p.iva) : honPeriodo;        // PAC!G
  var anticipado = String(r.planilla || '').trim().toUpperCase() === 'A';
  var pensionado = String(r.pensionado || 'NO').trim().toUpperCase() === 'SI';
  var zona = parseInt(r.zona, 10);

  // --- ICA (hoja 'ica') --------------------------------------------------
  var baseAporte = neto * p.pctIbc;
  var saludIca = roundupExcel(baseAporte * p.pctSalud, -2);
  var pensionIca = roundupExcel(baseAporte * p.pctPension, -2);
  var baseIca;
  if (zona === 11) {                                                 // sólo Bogotá depura
    if (anticipado && !pensionado) baseIca = neto - saludIca - pensionIca; // ANO
    else if (anticipado && pensionado) baseIca = neto - saludIca;          // ASI
    else baseIca = neto;                                                    // V**
  } else {
    baseIca = neto;
  }
  baseIca += (r.viaticos || 0);
  var zonaInfo = (m.zonas && m.zonas[zona]) || {};
  var tarifaIca = Number(zonaInfo.tarifa || 0);
  var ica = baseIca * tarifaIca;                                     // sin redondeo (ica!U)

  // --- Retefuente (hoja '383') --------------------------------------------
  var ibc = neto * p.pctIbc;
  var salud = anticipado ? ibc * p.pctSalud : 0;
  var pension = anticipado ? ibc * p.pctPension : 0;
  var arl = anticipado ? ibc * p.pctArl : 0;
  var depend = String(r.dependientes || 'NO').trim().toUpperCase() === 'SI' ? neto * p.pctDependientes : 0;
  var prepagada = Number((m.prepagada && m.prepagada[String(r.compromiso)]) || 0);
  var vivienda = Number((m.vivienda && m.vivienda[String(r.compromiso)]) || 0);
  var rentaLiquida = neto - salud - pension - arl - depend - prepagada - vivienda;
  var pctExenta = parseInt(r.tarifa, 10) === 387 ? p.pctExenta387 : 0;
  var baseRetefuente = rentaLiquida - rentaLiquida * pctExenta;
  var baseUvt = baseRetefuente / p.uvt;

  var retefuente = 0;
  for (var i = 0; i < p.tabla383.length; i++) {
    var t = p.tabla383[i]; // [desde, hasta, tarifa, adicion]
    if (baseUvt > t[0] && (baseUvt <= t[1] || t[1] === Infinity)) {
      retefuente = t[2] === 0 ? 0 : roundExcel((baseUvt - t[0]) * t[2] * p.uvt + t[3] * p.uvt, -3);
      break;
    }
  }

  // --- Otros conceptos del comprobante GF-F031 ------------------------------
  var reteIvaBase = respIva ? (honPeriodo / (1 + p.iva)) * p.iva : 0; // IVA teórico
  var reteIva = respIva ? reteIvaBase * p.pctReteIva : 0;             // 15%
  var proUniversidades = zona === 7 ? baseIca * 0.005 : 0;            // Pasto → U. Nariño
  var proHospitales = (zona === 8 || zona === 10) ? ica * (zona === 8 ? 0.10 : 0.06) : 0;
  var bomberil = zona === 5 ? roundExcel(baseIca * 0.02, -3) : 0;     // Sta Marta/Magdalena

  return {
    honPeriodo: honPeriodo, neto: neto,
    baseIca: baseIca, tarifaIca: tarifaIca, ica: ica, lugar: zonaInfo.lugar || '',
    salud: salud, pension: pension, arl: arl, dependientes: depend,
    prepagada: prepagada, vivienda: vivienda,
    rentaLiquida: rentaLiquida, pctExenta: pctExenta,
    baseRetefuente: baseRetefuente, baseUvt: baseUvt, retefuente: retefuente,
    reteIvaBase: reteIvaBase, reteIva: reteIva,
    proUniversidades: proUniversidades, proHospitales: proHospitales, bomberil: bomberil,
    totalDeducciones: retefuente + ica + reteIva + proUniversidades + proHospitales + bomberil,
    neto_a_pagar: honPeriodo - (retefuente + ica + reteIva + proUniversidades + proHospitales + bomberil)
  };
}

// Export para Node (las pruebas); en Apps Script se ignora.
if (typeof module !== 'undefined') {
  module.exports = { liquidar: liquidar, roundExcel: roundExcel, roundupExcel: roundupExcel, PARAMETROS_DEFECTO: PARAMETROS_DEFECTO };
}
