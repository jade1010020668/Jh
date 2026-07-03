/**
 * ORFEO — módulo de integración (FUTURO).
 *
 * Objetivo: que agentes automáticos suban a Orfeo los soportes de cada
 * liquidación (comprobante PDF, planillas) y actualicen el expediente.
 *
 * Apps Script puede hacerlo con UrlFetchApp contra los servicios web de
 * Orfeo (según la versión instalada en la entidad: Orfeo clásico expone
 * radicación/anexado vía HTTP; versiones nuevas exponen API REST).
 *
 * Pendiente de definir con el área de sistemas del instituto:
 *  1. URL del ambiente de Orfeo y método de autenticación (usuario técnico).
 *  2. Endpoint para anexar documentos a un radicado existente.
 *  3. Tipos documentales y metadatos exigidos.
 *
 * La aplicación ya guarda por cada liquidación el radicado Orfeo, el PDF y
 * el consecutivo — los insumos que estos agentes necesitarán.
 */

function orfeoSubirSoporte(radicado, blobPdf) {
  throw new Error('Integración con Orfeo pendiente de credenciales y endpoint del instituto.');
}
