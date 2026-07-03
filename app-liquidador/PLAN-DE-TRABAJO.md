# Plan de trabajo — Aplicación de Liquidación y Carga Masiva (IDEAM)

**Versión 1.0 — 2026-07-03.** Basado en la auditoría de `BASE_COMPLETA_Al_1.xlsx` y `OBLIGADOR_1_1.xlsx` (ver `AUDITORIA.md`) y el modelo SIIF Nación (capítulo 22).

---

## Visión

Una aplicación web donde: (1) el liquidador pega el código de Orfeo, revisa/edita los datos, la app valida las reglas y genera la **liquidación con un consecutivo único e irrepetible**, guardándola con trazabilidad total; (2) los maestros (prepagada, vivienda, dependientes, tarifas) se administran dentro de la app; (3) con lo ya liquidado se arma la **carga masiva modular** del SIIF (añadir, quitar, editar sin romper la estructura), con reset protegido por contraseña + código.

## Plataforma (recomendación)

| Componente | Elección | Por qué |
|---|---|---|
| Frontend | Aplicación web (SPA) desplegada en Netlify (este repo ya tiene el pipeline) | Acceso por navegador para todos los liquidadores |
| Base de datos + usuarios | **Supabase** (PostgreSQL gestionado, gratis en este volumen) | Base de datos real: consecutivos con secuencia (imposible repetir), roles, historial, respaldos; nada de vínculos `[1]` entre libros |
| Exportes | Excel/CSV descargable y hoja de Google Sheets espejo (solo lectura) | Mantener la comodidad de "ver toda la base" como hoy |
| Comprobante | PDF generado por la app (`<radicadoOrfeo>_liquidacion.pdf`) | Reemplaza la macro de pantallazo |

> Alternativa si se prefiere 100% Google: Google Sheets + Apps Script (menos robusto en roles/bloqueos). El plan es el mismo; solo cambia la Fase 0.

## Roles

- **Liquidador** (Sergio, Johanna, Portilla, Luz Dary, Diana…): captura, edita antes de liquidar, genera liquidaciones, consulta su trazabilidad.
- **Administrador**: además edita maestros (prepagada, vivienda, dependientes, cambio de tarifa, zonas/ICA, parámetros de vigencia) y arma lotes de carga.
- **Superadministrador** (contraseña propia + segundo factor/código): edita o elimina **cualquier** registro de la base, reliquida, restablece lotes de carga masiva y ve el log de auditoría completo. Toda acción suya queda registrada (quién, qué, cuándo, valor anterior → nuevo).

## Modelo de datos (núcleo)

```
radicados        id, consecutivo (secuencia única), codigo_original, 27 campos parseados,
                 campos_editados (json con valor original→editado, motivo), estado, creado_por, fechas
maestro_personas cedula, nombre, facturador, declarante, pensionado, dependientes, zona, riesgo
prepagada        compromiso, valor_mensual, vigencia, soporte
vivienda         compromiso, valor_mensual, vigencia, soporte
tarifas          compromiso, tarifa (383/387), vigencia, responsable   ← regla: 1 por año
parametros       vigencia, UVT, %salud, %pension, tabla_ARL, %exenta_387, tabla_art383,
                 zonas (ciudad, tarifa ICA, NITs alcaldía/beneficiarios), umbrales
liquidaciones    id, consecutivo, radicado_id, version, snapshot_entradas (json),
                 resultados (base/tarifa/valor por concepto), pdf_url, estado, liquidado_por, fecha
lotes_carga      id, nombre, estado, creado_por;  lote_items: lote_id, liquidacion_id, num_registro,
                 incluido (si/no), motivo_exclusion
compromisos_siif import del export SIIF (rubro, dependencia, fuente, recurso, situación, saldos)
parametrizacion_rubros  rubro → tipo_gasto, tipo_operacion, uso_contable, cuenta, uso_presupuestal
auditoria        usuario, acción, tabla, registro, antes → después, fecha
```

---

## FASE 1 — Liquidador (la prioridad: del código pegado a la liquidación idéntica)

**Objetivo de aceptación: pego un código real del NUEVO PAC y la app produce exactamente los mismos valores que el Excel (retefuente, ICA, reteIVA y demás conceptos), con consecutivo único y guardado.**

### 1.1 Parser y captura (semana 1)
- Pantalla "Nueva liquidación": pegar 1 o varios códigos.
- Parser valida: 27 campos exactos (si un nombre trae guion, lo detecta por patrón y avisa en vez de correr columnas), días numéricos, valores con coma, radicado Orfeo válido.
- **Precarga editable**: antes de liquidar, la línea se muestra como formulario (igual a la fila del NUEVO PAC): se pueden corregir **días** (el caso típico), valores, zona, marcas — cada edición guarda valor original + quién + motivo corto.

### 1.2 Maestros administrables (semana 1–2)
- CRUD de prepagada, vivienda, dependientes, cambio de tarifa, personas, zonas/tarifas ICA/NITs y parámetros de vigencia (UVT, %, tabla art. 383) — todo lo que hoy está regado en fórmulas y hojas ocultas.
- Importador inicial: migra los datos actuales del Excel (PREPAGADA Y VIVIENDA, CAMBIO DE TARIFA, Hoja1) para no digitar nada.

### 1.3 Validaciones de reglas (semana 2)
- **Tarifa constante**: si el compromiso ya tiene tarifa en la vigencia y el código/usuario intenta otra → bloqueo con mensaje (solo el admin la cambia en el maestro, quedando auditado).
- **387 solo anticipado**: tarifa 387 con planilla "V" → alerta y no deja continuar.
- Días ≠ 30 → advertencia (editable con motivo, como hoy).
- Duplicados: mismo radicado Orfeo ya liquidado → aviso con enlace a la liquidación existente (reliquidar = nueva versión, no nuevo consecutivo).

### 1.4 Motor de cálculo con paridad Excel (semana 2–3)
- Réplica exacta de: honorario del período (×días/30), neto de IVA (÷1,19), IBC 40%, aportes solo si "A", dependientes 10%, prepagada/vivienda por compromiso, 25% exenta solo 387, tabla art. 383 con los mismos redondeos; ICA por zona con depuración solo en Bogotá y reglas de pensionado; reteIVA 15%; pro-universidades, pro-hospitales, sobretasa bomberil por zona; NITs de beneficiarios.
- **Banco de pruebas de regresión**: los ~450 radicados reales del NUEVO PAC se corren contra el motor y se comparan 1 a 1 con los valores del Excel. Criterio: 100% de coincidencia (las diferencias se revisan juntas: pueden ser los errores #REF!/umbral 2024 detectados en la auditoría — decidimos si replicar o corregir).

### 1.5 Consecutivo, liquidación y comprobante (semana 3)
- Al dar **Continuar**: la app asigna el **consecutivo desde una secuencia de base de datos** (único, sin huecos reutilizables, imposible de repetir), calcula, muestra la liquidación (formato GF-F031), y al confirmar la guarda.
- Genera el **PDF** `<radicadoOrfeo>_liquidacion.pdf` descargable y archivado.
- Reliquidación: corregir datos → nueva **versión** de la misma liquidación (v1, v2…), historial completo conservado; el PDF anterior no se borra.

### 1.6 Base de datos visible y trazabilidad (semana 3–4)
- Pantalla "Base de datos": tabla completa estilo NUEVO PAC con todas las liquidaciones — filtros por consecutivo, radicado, persona, responsable, fecha, estado; se ve **con qué se liquidó cada una** (días, tarifa, prepagada aplicada, versión).
- Export a Excel y hoja espejo de Google Sheets (solo lectura).
- **Modo superadministrador**: con su contraseña puede editar cualquier campo o eliminar registros (borrado lógico con papelera) y reliquidar; todo queda en el log de auditoría.

**Entregable Fase 1**: app usable por los 5 liquidadores, con paridad probada contra el Excel. *Duración estimada: 4 semanas.*

---

## FASE 2 — Obligador (carga masiva modular)

### 2.1 Insumos SIIF (semana 5)
- Importador del export de compromisos del SIIF (como `RP al 24052024`/`COMPROMISOS`): rubros, dependencias, fuente/recurso/situación, saldos.
- Administración de la **parametrización por rubro** (la tabla V6:AC33 del ITEM: tipo de gasto/operación/uso/cuenta/uso presupuestal) y del tipo de cuenta por pagar (verificar el `103` contra el catálogo vigente).

### 2.2 Armado del lote (semana 5–6)
- Selección de liquidaciones en estado "Liquidada/Revisada" → lote (límite 200, valida saldo del compromiso contra lo ya obligado).
- **Modularidad garantizada**: dentro del lote se puede **añadir, quitar, excluir ("no sube") o editar** cualquier obligación; la app **renumera automáticamente** consecutivos maestro/ítem/deducción/usos manteniendo los enlaces — imposible dañar la estructura del resto.
- Vista previa por persona: maestro + ítems + deducciones (ICA/retefuente con sus posiciones y NITs) + usos.

### 2.3 Generación y validación (semana 6)
- Validador SIIF completo (separador, fechas = día de la carga, decimales con coma, deducción sin decimales, requeridos, campos condicionales del ítem según atributo/matriz/usos).
- Genera los 4 archivos `.txt` listos para comprimir y firmar, y opcionalmente el volcado a Google Sheets.

### 2.4 Reset protegido y ciclo de carga (semana 7)
- **Restablecer lote**: requiere contraseña del administrador **+ código de confirmación** (doble paso); deja copia del lote anterior en el historial.
- Pos-carga: pegar el log del SIIF → la app marca exitosos/fallidos, arma automáticamente el re-lote solo con fallidos corregibles y vincula el número de obligación SIIF a cada liquidación (trazabilidad radicado → consecutivo → obligación).

**Entregable Fase 2**: ciclo completo liquidación → lote → archivos → log → re-lote. *Duración estimada: 3 semanas.*

---

## FASE 3 — Complementos

- Módulo de **devoluciones al área** (hoja DEV: motivo estandarizado, responsable, fechas, notificación).
- Dashboard: cuentas por responsable (como LTR), pendientes, liquidado vs. obligado del mes.
- Reportes e indicadores; copias de seguridad automáticas; manual de usuario y capacitación.

---

## Reglas de oro transversales

1. **Nada se borra físicamente**: todo es borrado lógico con papelera y auditoría (quién, qué, antes → después).
2. **El consecutivo nunca se repite ni se reutiliza**, ni siquiera si se elimina el registro.
3. **Los parámetros tienen vigencia** (UVT, tarifas, tablas): liquidar en 2027 no daña lo liquidado en 2026.
4. **Paridad primero**: no se libera la Fase 1 hasta que el banco de pruebas dé 100% contra el Excel.
5. Acciones destructivas (reset de lote, borrado, edición masiva) = contraseña + código + registro.

## Primer paso inmediato

Construir el **motor de liquidación** (1.4) con los maestros mínimos y correrlo contra los radicados reales del NUEVO PAC para demostrar la paridad — es la prueba de que la app "liquida exactamente igual". Con esa base validada se monta la interfaz alrededor.
