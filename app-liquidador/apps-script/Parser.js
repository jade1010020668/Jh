/**
 * PARSER del código de Orfeo (27 campos separados por "-").
 * Corrige el defecto del Excel: si el nombre o la dependencia traen guiones,
 * NO corre las columnas — repara la división usando anclas numéricas.
 */

var CAMPOS = [
  'key', 'numCuenta', 'compromiso', 'nombre', 'cedula', 'honorarios', 'dias',
  'responsableIva', 'valorHonorario', 'valorHonorarioResp', 'planilla',
  'declarante', 'pensionado', 'zona', 'dependientes', 'nivelRiesgo',
  'facturador', 'orfeo', 'dependencia', 'numCto', 'dctoEq', 'key2',
  'contrato', 'relleno1', 'relleno2', 'relleno3', 'telefono'
];

function esNumero(s) { return /^\d+([.,]\d+)?$/.test(String(s).trim()); }

/**
 * Divide el código en sus 27 campos. Devuelve {ok, campos:{...}, errores:[], avisos:[]}.
 */
function parsearCodigo(codigo) {
  var errores = [], avisos = [];
  var partes = String(codigo || '').trim().split('-');
  if (partes.length < 27) {
    return { ok: false, errores: ['El código tiene ' + partes.length + ' partes; se esperan mínimo 27. Revise que esté completo.'] };
  }

  if (partes.length > 27) {
    // Hay guiones extra: primero intentar fusionarlos en el NOMBRE (campo 4),
    // validando las anclas: cédula (5) numérica, honorarios (6) numérico, días (7) numérico.
    var extra = partes.length - 27;
    var reparado = null;
    for (var enNombre = extra; enNombre >= 0; enNombre--) {
      var enDependencia = extra - enNombre;
      var p = partes.slice(0, 3)
        .concat([partes.slice(3, 4 + enNombre).join('-')])
        .concat(partes.slice(4 + enNombre, 18 + enNombre))
        .concat([partes.slice(18 + enNombre, 19 + enNombre + enDependencia).join('-')])
        .concat(partes.slice(19 + enNombre + enDependencia));
      if (p.length === 27 && esNumero(p[4]) && esNumero(p[5]) && esNumero(p[6]) && /^\d{10,16}$/.test(String(p[17]).trim())) {
        reparado = p; break;
      }
    }
    if (!reparado) {
      return { ok: false, errores: ['El código tiene ' + partes.length + ' partes (guiones extra en nombre/dependencia) y no fue posible repararlo automáticamente. Revíselo manualmente.'] };
    }
    partes = reparado;
    avisos.push('El código traía guiones extra; se reparó automáticamente (verifique nombre y dependencia).');
  }

  var c = {};
  for (var i = 0; i < 27; i++) c[CAMPOS[i]] = String(partes[i] == null ? '' : partes[i]).trim();

  // Validaciones de forma
  if (!esNumero(c.cedula)) errores.push('La cédula (' + c.cedula + ') no es numérica.');
  if (!esNumero(c.honorarios)) errores.push('Los honorarios (' + c.honorarios + ') no son numéricos.');
  if (!esNumero(c.dias)) errores.push('Los días (' + c.dias + ') no son numéricos.');
  if (!/^\d{10,16}$/.test(c.orfeo)) errores.push('El radicado Orfeo (' + c.orfeo + ') no parece válido.');
  if (['A', 'V'].indexOf(c.planilla.toUpperCase()) < 0) errores.push('La planilla debe ser A o V (llegó "' + c.planilla + '").');
  if (Number(String(c.dias).replace(',', '.')) !== 30) avisos.push('Los días son ' + c.dias + ' (lo normal es 30). Puede editarlos antes de liquidar.');

  // Números normalizados
  c.honorarios = Number(String(c.honorarios).replace(',', '.'));
  c.dias = Number(String(c.dias).replace(',', '.'));
  c.zona = parseInt(c.zona, 10);
  c.planilla = c.planilla.toUpperCase();

  return { ok: errores.length === 0, campos: c, errores: errores, avisos: avisos };
}

if (typeof module !== 'undefined') module.exports = { parsearCodigo: parsearCodigo, CAMPOS: CAMPOS };
