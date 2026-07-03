# Instalación de la aplicación (Google Sheets + Apps Script)

La aplicación vive en una hoja de cálculo de Google (que es la base de datos visible) con una interfaz web propia. **15 minutos de instalación, sin servidores ni costos.**

## Pasos

1. **Crea la hoja de cálculo** en Google Drive (p. ej. `LIQUIDADOR IDEAM`).
2. Abre **Extensiones → Apps Script**.
3. En el editor crea estos archivos y pega el contenido de esta carpeta:
   - `Code.gs` ← contenido de `Code.js`
   - `Motor.gs` ← contenido de `Motor.js`
   - `Parser.gs` ← contenido de `Parser.js`
   - `Seed.gs` ← contenido de `Seed.js`
   - `Pdf.gs` ← contenido de `Pdf.js`
   - `Obligador.gs` ← contenido de `Obligador.js`
   - `Orfeo.gs` ← contenido de `Orfeo.js`
   - `Index.html` ← contenido de `Index.html` (archivo tipo **HTML**)
   - En ⚙️ Configuración del proyecto activa "Mostrar appsscript.json" y reemplázalo con `appsscript.json`.
4. En el editor ejecuta **`setup()`** (autoriza los permisos cuando lo pida). Esto crea las hojas `BD, PREPAGADA, VIVIENDA, TARIFAS, ZONAS, PARAMETROS, AUDITORIA` **más las de la carga masiva** (`COMPROMISOS_SIIF, PARAM_RUBROS, CONFIG_SIIF, LOTES, LOTE_ITEMS`) y carga las semillas migradas del Excel (11 zonas con NITs, 21 prepagadas, 17 viviendas, 66 tarifas 383/387, parametrización de rubros y configuración SIIF del IDEAM).
5. Abre `Code.gs`, cambia la clave en **`definirClaveSuperadmin()`**, ejecútala una vez y vuelve a dejar el texto `CAMBIEME-123` (la clave queda guardada como hash, no en el código).
6. **Desplegar → Nueva implementación → Aplicación web**: ejecutar como *tú*, acceso *cualquier usuario del dominio* (o "cualquiera con el enlace" si los liquidadores usan cuentas personales). Copia la URL — esa es la aplicación.

## Uso diario

1. **Nueva liquidación**: pegar el código de Orfeo → *Analizar* (valida los 27 campos, repara guiones extra, avisa duplicados y reglas 383/387) → editar lo necesario (días, etc.; cada cambio queda registrado) → *Liquidar* → revisar valores → *Confirmar y guardar* (asigna el **consecutivo único**, imposible de repetir).
2. **Base de datos**: consulta con filtro de todo lo liquidado y su trazabilidad; la hoja `BD` de la hoja de cálculo muestra lo mismo con todos los detalles (incluida la columna `edicionesJson` con qué se modificó antes de liquidar).
3. **Maestros**: prepagada, vivienda, tarifas, zonas y parámetros (UVT, %, tabla art. 383) se editan en sus pestañas del archivo — protégelas con permisos de rango de Google Sheets para que solo el administrador las cambie.
4. **Superadmin**: con la clave puede editar cualquier campo o eliminar (borrado lógico) — todo queda en la hoja `AUDITORIA`.

## Reglas implementadas

- Tarifa (383/387) viene del maestro `TARIFAS` — constante todo el año; **387 exige planilla A** (bloqueo).
- Radicado Orfeo repetido → nueva **versión** del mismo consecutivo (historial completo).
- Consecutivo por `PropertiesService` con `LockService`: único aunque dos personas guarden al tiempo.
- Nada se borra físicamente: estado `ELIMINADA` + auditoría.

## Carga masiva SIIF (Fase 2 — incluida)

1. Pega en la hoja `COMPROMISOS_SIIF` el export del SIIF (listado de compromisos: número, dependencia, rubro, fuente, recurso, situación, saldo por utilizar) — es el insumo de rubros y saldos.
2. Completa `PARAM_RUBROS` (rubro → recurso/fuente/situación, tipo de gasto o uso contable + cuenta, uso presupuestal) y revisa `CONFIG_SIIF` (PCI, tipo de cuenta por pagar, expedidor, funcionario…).
3. Pestaña **Carga masiva**: selecciona liquidaciones → *Crear lote* (máx. 200) → dentro del lote puedes **incluir / excluir ("no sube") / quitar** cualquier obligación sin dañar la numeración (se recalcula al generar) → *Generar* descarga los 4 archivos `1_Maestro.txt, 2_Item.txt, 3_Deducciones.txt, 4_Usos.txt` ya validados (saldo del compromiso, rubros parametrizados, formato SIIF: `|`, fecha del día, decimales con coma, deducciones sin decimales).
4. Comprime cada `.txt` en `.zip`, fírmalo con tu token (`.zip.p7z`) y cárgalo en SIIF → CARGA → EPG → Obligación.
5. **Restablecer lote**: pide la clave de superadmin y luego un **código de confirmación de 6 dígitos** (vence en 5 min). Libera las liquidaciones para un nuevo lote; todo queda auditado.

## PDF automático

Al guardar cada liquidación se genera `<radicadoOrfeo>_liquidacion_v<versión>.pdf` (formato GF-F031) en la carpeta `LIQUIDACIONES_PDF` de tu Drive, y el enlace queda en la columna `pdfUrl` de la hoja `BD`.

## Próximo módulo

- **Agentes de Orfeo** (`Orfeo.gs`): subir soportes automáticamente al radicado — requiere del área de sistemas la URL, el usuario técnico y el endpoint de anexado (ver comentarios del archivo).
