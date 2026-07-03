# Liquidador IDEAM — aplicación web autónoma

Aplicación **lista para usar en el navegador**, sin servidor ni instalación. Funciona de dos formas:

- **En línea**: se despliega sola en Netlify con este repositorio. La URL del preview del PR la sirve en `/<ruta>/app-liquidador/web/`.
- **Local**: descarga esta carpeta (`index.html`, `app.js`, `ui.js`, `seed.js`) y abre `index.html` con doble clic.

Los datos se guardan en el **almacenamiento local del navegador** (localStorage). Para respaldar o mover la información entre equipos: pestaña **Superadmin → Exportar/Importar respaldo (JSON)**.

## Qué hace

1. **Nueva liquidación**: pega el código de Orfeo → *Analizar* (divide los 27 campos, repara guiones extra, avisa duplicados y valida la regla 383/387) → edita lo que necesites (los cambios quedan marcados y registrados) → *Liquidar* (motor idéntico al Excel, verificado 78/78) → *Confirmar y guardar* con **consecutivo único**. Botón para imprimir/guardar el comprobante `<orfeo>_liquidacion.pdf`.
2. **Base de datos**: todas las liquidaciones con filtro y trazabilidad; botón PDF por fila.
3. **Carga masiva**: selecciona liquidaciones → crea un **lote** (máx. 200) → dentro del lote **incluye / excluye ("no sube") / quita** sin dañar la numeración → *Generar* descarga los 4 archivos SIIF validados (`1_Maestro.txt … 4_Usos.txt`). **Reset** protegido con clave + código de 6 dígitos.
4. **Maestros**: edita en la propia app prepagada, vivienda, tarifas 383/387, zonas ICA, parametrización de rubros, compromisos del SIIF y parámetros de vigencia (UVT, %, tabla art. 383). Ya vienen sembrados con los datos del Excel.
5. **Superadmin**: define clave, edita/elimina (lógico) cualquier liquidación, ve la auditoría, respalda/restaura.

## Antes de la primera carga masiva

Ya vienen sembrados del Excel **301 compromisos** y **24 rubros parametrizados**, así que funciona de una. Para actualizarlos:

- Pestaña **Maestros** → selecciona **COMPROMISOS SIIF** → botón **📋 Pegar en bloque** → copia tu hoja COMPROMISOS del Excel (o el export CEN del SIIF) y pégala (detecta TAB / `|` / `;`). Marca "Reemplazar todo" para dejar solo lo nuevo, o déjalo sin marcar para agregar/actualizar por número de compromiso.
- Botón **↻ Recargar datos IDEAM** vuelve a cargar los compromisos y rubros originales del Excel.
- Los saldos del Excel son de una fecha dada; refréscalos con el export del SIIF antes de obligar valores límite.

## Nota

Esta versión guarda en el navegador (ideal para uso individual y pruebas). Para uso compartido por varios liquidadores con base de datos central, está la versión de **Google Apps Script** en `../apps-script/` (misma lógica, la hoja de cálculo como base de datos). Ambas comparten el motor validado.
