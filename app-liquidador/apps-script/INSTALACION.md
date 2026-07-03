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
   - `Orfeo.gs` ← contenido de `Orfeo.js`
   - `Index.html` ← contenido de `Index.html` (archivo tipo **HTML**)
   - En ⚙️ Configuración del proyecto activa "Mostrar appsscript.json" y reemplázalo con `appsscript.json`.
4. En el editor ejecuta **`setup()`** (autoriza los permisos cuando lo pida). Esto crea las hojas `BD, PREPAGADA, VIVIENDA, TARIFAS, ZONAS, PARAMETROS, AUDITORIA` y carga las semillas migradas del Excel (11 zonas con NITs, 21 prepagadas, 17 viviendas, 66 tarifas 383/387).
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

## Próximos módulos (Fase 2 del plan)

- Generador de la carga masiva SIIF (lotes modulares, validador, reset con contraseña + código).
- PDF automático `<radicadoOrfeo>_liquidacion.pdf` en Drive.
- **Agentes de Orfeo** (`Orfeo.gs`): subir soportes automáticamente al radicado — requiere del área de sistemas la URL, el usuario técnico y el endpoint de anexado (ver comentarios del archivo).
