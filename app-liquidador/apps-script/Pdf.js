/**
 * PDF del comprobante de liquidación (formato GF-F031) — reemplaza la macro
 * de pantallazo del Excel. Se guarda en Drive (carpeta LIQUIDACIONES_PDF)
 * como <radicadoOrfeo>_liquidacion_v<version>.pdf
 */

function fmtPesos_(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

/** HTML del comprobante (función pura, probable en Node). */
function construirHtmlComprobante(d, x, consecutivo, version, zonaInfo) {
  zonaInfo = zonaInfo || {};
  function fila(concepto, base, tarifa, valor, nit, beneficiario) {
    if (!valor) return '';
    return '<tr><td>' + concepto + '</td><td class="v">' + fmtPesos_(base) + '</td><td class="v">' +
      (tarifa ? (tarifa * 100).toFixed(3) + '%' : '') + '</td><td class="v">' + fmtPesos_(valor) +
      '</td><td>' + (nit || '') + '</td><td>' + (beneficiario || '') + '</td></tr>';
  }
  var html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}' +
    'h1{font-size:14px;text-align:center;margin:2px}h2{font-size:11px;text-align:center;font-weight:normal;margin:2px}' +
    'table{border-collapse:collapse;width:100%;margin-top:10px}' +
    'td,th{border:1px solid #999;padding:4px 6px}th{background:#1F4E79;color:#fff;text-align:left}' +
    '.v{text-align:right}.tot{font-weight:bold;background:#eef}.enc td{border:0;padding:2px 4px}' +
    '</style></head><body>' +
    '<h1>LIQUIDACIÓN DE IMPUESTOS</h1>' +
    '<h2>FACTURA ELECTRÓNICA O DOCUMENTO EQUIVALENTE - CONTRATISTAS · Código: GF-F031</h2>' +
    '<table class="enc"><tr><td><b>Consecutivo:</b> ' + consecutivo + ' (v' + version + ')</td>' +
    '<td><b>Radicado Orfeo:</b> ' + d.orfeo + '</td><td><b>Fecha:</b> ' + (d.fechaTexto || '') + '</td></tr>' +
    '<tr><td><b>Nombre:</b> ' + d.nombre + '</td><td><b>Cédula:</b> ' + d.cedula + '</td><td><b>Contrato/RP:</b> ' + d.compromiso + '</td></tr>' +
    '<tr><td><b>Dependencia:</b> ' + (d.dependencia || '') + '</td><td><b>Ciudad:</b> ' + (x.lugar || '') + '</td>' +
    '<td><b>Régimen:</b> ' + (String(d.responsableIva).toUpperCase() === 'SI' ? 'RESPONSABLE DE IVA' : 'NO RESPONSABLE') + '</td></tr>' +
    '<tr><td><b>Honorario mensual:</b> ' + fmtPesos_(d.honorarios) + '</td><td><b>Días:</b> ' + d.dias + '</td>' +
    '<td><b>Honorario del período:</b> ' + fmtPesos_(x.honPeriodo) + '</td></tr>' +
    '<tr><td><b>Planilla:</b> ' + d.planilla + '</td><td><b>Tarifa:</b> ' + d.tarifa + '</td>' +
    '<td><b>Base retefuente:</b> ' + fmtPesos_(x.baseRetefuente) + '</td></tr></table>' +
    '<table><tr><th>CONCEPTO</th><th>BASE</th><th>TARIFA</th><th>IMPUESTO</th><th>NIT BENEFICIARIO</th><th>BENEFICIARIO</th></tr>' +
    fila('RETENCIÓN EN LA FUENTE', x.baseRetefuente, x.baseRetefuente ? x.retefuente / x.baseRetefuente : 0, x.retefuente, '800197268', 'U.A.E. DIRECCION DE IMPUESTOS Y ADUANAS NACIONALES') +
    fila('RETENCIÓN DE ICA', x.baseIca, x.tarifaIca, x.ica, zonaInfo.nitAlcaldia, zonaInfo.nombreAlcaldia) +
    fila('RETENCIÓN DE IVA', x.reteIvaBase, 0.15, x.reteIva, '800197268', 'U.A.E. DIRECCION DE IMPUESTOS Y ADUANAS NACIONALES') +
    fila('PRO-UNIVERSIDADES', x.baseIca, 0.005, x.proUniversidades, zonaInfo.nitExtra, zonaInfo.beneficiarioExtra) +
    fila('PRO-HOSPITALES', x.ica, null, x.proHospitales, zonaInfo.nitExtra, zonaInfo.beneficiarioExtra) +
    fila('SOBRETASA BOMBERIL', x.baseIca, 0.02, x.bomberil, zonaInfo.nitExtra, zonaInfo.beneficiarioExtra) +
    '<tr class="tot"><td>TOTAL DEDUCCIONES</td><td></td><td></td><td class="v">' + fmtPesos_(x.totalDeducciones) + '</td><td></td><td></td></tr>' +
    '<tr class="tot"><td>NETO A PAGAR</td><td></td><td></td><td class="v">' + fmtPesos_(x.neto_a_pagar) + '</td><td></td><td></td></tr>' +
    '</table>' +
    '<p><b>Observaciones:</b> ' + (d.observaciones || '') + '</p>' +
    '<p style="color:#666">Generado por la aplicación Liquidador · usuario: ' + (d.usuario || '') + '</p>' +
    '</body></html>';
  return html;
}

/** Genera el PDF en Drive y devuelve su URL (solo Apps Script). */
function generarPdf_(d, x, consecutivo, version) {
  var m = cargarMaestros_();
  var zonaInfo = m.zonas[parseInt(d.zona, 10)] || {};
  d.fechaTexto = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  d.usuario = Session.getActiveUser().getEmail() || '';
  var html = construirHtmlComprobante(d, x, consecutivo, version, zonaInfo);
  var pdf = Utilities.newBlob(html, 'text/html', 'liq.html').getAs('application/pdf')
    .setName(String(d.orfeo) + '_liquidacion_v' + version + '.pdf');
  var carpetas = DriveApp.getFoldersByName('LIQUIDACIONES_PDF');
  var carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder('LIQUIDACIONES_PDF');
  return carpeta.createFile(pdf).getUrl();
}

if (typeof module !== 'undefined') module.exports = { construirHtmlComprobante: construirHtmlComprobante };
