# 22. Carga masiva de obligaciones (EPG): estructura oficial campo a campo

> Fuente principal: Guía Financiera No. 6 "Cargas Masivas Ejecución Presupuestal del Gasto" (GF-G-006, versión 2022, MinDefensa; publicación Armada Nacional 27-jul-2023), sección 3.5, que transcribe la estructura del Administrador SIIF Nación (MHCP). Complementada con el "Manual para cargas masivas" v.3.0 (11-09-2023, MHCP) y el documento oficial "Estructura archivo carga masiva Crear Obligación Presupuestal Homologada al nuevo CCP" v.2.0 (MHCP).

## Generalidades

- Ruta de la carga: menú **CARGA** (Web de Carga) → **EPG** → **Obligación**. Perfil transaccional en línea: Gestión Contable; perfil de la carga: **Entidad – Gestión Cargas Masivas EPG**. La transacción se habilita solo con autorización previa de la Administración SIIF del MHCP.
- El paquete se compone de **4 archivos**: **Maestro, Detalle (ítems), Deducciones y Usos Presupuestales**. Si las obligaciones no requieren deducciones se omite el archivo 3; si los rubros tienen la marca "requiere usos" es obligatorio el archivo 4.
- **No existe archivo de "Facturas"** en la carga masiva (hallazgo verificado): la vinculación de la factura electrónica (estado "Aprobada", CUFE) se hace en la transacción en línea (carpeta Facturas), obligatoria cuando el tercero tiene responsabilidad tributaria 52 y el uso tiene marca "Requiere Factura = SI".
- Límites: máximo **200 obligaciones por carga**; archivos firmados no mayores a **100 MB**; una obligación por cada línea de pago del compromiso; no ejecutar cargas masivas y registros manuales simultáneamente.
- Formato: campos separados por `|`; campos vacíos conservan el separador; fechas `yyyy/mm/dd` (fecha de registro = día de la carga); valores sin separador de miles y decimales con coma; códigos, no descripciones. Cada archivo: `.txt` → `.zip` (individual) → firmado digitalmente (`.zip.p7z` o `.zip.firm`) por el **mismo usuario** que ejecuta la carga.

## Archivo 1 — MAESTRO (cabecera, un registro por obligación)

| # | Campo | Tipo | Long. | REQ | Descripción / valores |
|---|---|---|---|---|---|
| 1 | Consecutivo | Numérico | 0 | S | Identifica cada conjunto de datos; inicia en 1 hasta N |
| 2 | Fecha | Date | 10 | S | Fecha de registro; debe ser el día de la carga (yyyy/mm/dd) |
| 3 | codPci | Varchar | 30 | S | PCI que realiza la carga; igual a la PCI de conexión |
| 4 | Consecutivo Compromiso | Varchar | 30 | S | Compromiso a utilizar (con saldo por obligar) |
| 5 | Fecha de Pago | Date | 10 | S | Fecha de pago de la obligación (yyyy/mm/dd) |
| 6 | Requiere DIP | Varchar | 50 | S | SI = pago en moneda distinta de pesos; NO = pesos |
| 7 | Tipo de Cuenta por Pagar | Bigint | 8 | S | Código del tipo (determina las deducciones propuestas) |
| 8 | Valor de IVA | Numérico | 17 | S | IVA facturado por el tercero; 0 si no hay |
| 9 | Tipo documento Soporte | Varchar | 30 | S | Código (ej. 17 = Factura) |
| 10 | Número Documento Soporte | Numérico | 50 | S | Número del documento soporte |
| 11 | Fecha Documento Soporte | Date | 0 | S | Formato yyyy-mm-dd |
| 12 | Expedidor | Numérico | 30 | S | Código (ej. 11 = Entidad) |
| 13 | Nombre funcionario | Varchar | 50 | N | Dato administrativo |
| 14 | Cargo Funcionario | Varchar | 50 | N | Dato administrativo |
| 15 | Observaciones | Varchar | 220 | N | Notas adicionales |
| 16 | urlDocumento | Varchar | 220 | N | — |
| 17 | urlDescripcion | Varchar | 220 | N | — |

Ejemplo oficial:

```
1|2020/11/12|36-02-00-005-910110|185519|2020/11/10|NO|07|0|7|1488|2020/11/12|11|ANDRES FELIPE RUIZ MARQUEZ|SUBDIRECTOR ( E )|COM 1488, ANDES-JARDIN...||
```

## Archivo 2 — DETALLE / ÍTEMS de afectación de gasto

| # | Campo | Tipo | Long. | REQ | Descripción / valores |
|---|---|---|---|---|---|
| 1 | Consecutivo Maestro | Numérico | 0 | S | Mismo consecutivo del maestro |
| 2 | NumRegistro | Numérico | 0 | S | Consecutivo del detalle (1..N) |
| 3 | CodDepAfectacion | Varchar | 30 | S | Dependencia de afectación de gastos del compromiso |
| 4 | CodPosicionGasto | Varchar | 50 | S | Rubro (posición de gasto) |
| 5 | CodRecursoPresupuestal | Varchar | 0 | S | Código de recurso (10–27, 50–53) |
| 6 | CodFuenteFinanciacion | Varchar | 0 | S | 01 Nación, 02 Propios |
| 7 | CodSituacionFondos | Varchar | 0 | S | 01 CSF, 02 SSF |
| 8 | ValorEnPesos | Numérico | 0 | S | Sin miles; decimales con coma |
| 9 | Atributo contable | Varchar | 50 | S | 05 = Ninguno contabiliza en la obligación; otro → al pago |
| 10 | Tipo de Gasto | Varchar | 0 | S* | TCON007; solo si el rubro va por matriz directa (define el débito) |
| 11 | Tipo de Operación | Varchar | 0 | S | Único por rubro (define el crédito); TCON007 o TCON012 |
| 12 | Uso Contable | Varchar | 0 | S* | TCON012; solo si el rubro va por usos contables |
| 13 | Código cuenta contable | Varchar | 0 | S* | Cuenta débito del uso (TCON012-4); solo por usos |

Reglas condicionales de los campos 9–13 (verbatim):

- Rubro por **matriz directa**: diligenciar atributo, tipo de gasto y tipo de operación; dejar en blanco uso contable y cuenta.
- **Atributo ≠ Ninguno**: diligenciar atributo y tipo de operación; los demás en blanco.
- Rubro por **usos contables**: diligenciar atributo, tipo de operación, uso contable y cuenta; tipo de gasto en blanco.

Ejemplo oficial:

```
1|1|910110|C-3603-1300-14-0-3603025-02|10|01|01|80831|23||17|22|511119001
```

## Archivo 3 — DEDUCCIONES (según aplique)

| # | Campo | Tipo | Long. | REQ | Descripción / valores |
|---|---|---|---|---|---|
| 1 | Consecutivo Maestro | Numérico | 0 | S | Mismo consecutivo del maestro |
| 2 | Línea Registro | Numérico | 0 | S | Consecutivo 1..n |
| 3 | Posición del Catálogo para pago no Presupuestal | Carácter | 220 | S | Código de la deducción (ej. 2-03-05-01; retefuente honorarios declarantes 2-01-04-01-03-01; rentas de trabajo 2-01-04-01-29; ICA 2-02-03-01) |
| 4 | Tipo de naturaleza jurídica | Carácter | 2 | S | 01 PJ Nal · 02 PJ Ext · 03 PN Nal · 04 PN Ext · 05 Consorcio · 06 UT |
| 5 | Número Documento Tercero | Carácter | 50 | S | Identificación del beneficiario de la deducción |
| 6 | Base Gravable | Numérico | 0 | S | Base aplicable |
| 7 | Tarifa | Numérico | 0 | S | Decimales con coma, hasta 3 (ej. 0,966) |
| 8 | Valor de Deducción | Numérico | 0 | S | Redondeado, **sin decimales** |

Ejemplo oficial: `7|1|2-03-05-01|01|890900286|968700,00|0,400|3875,00`

Las deducciones de la obligación se vinculan automáticamente a las órdenes de pago posteriores; contabilizan según la TCON008.

## Archivo 4 — USOS PRESUPUESTALES (según aplique)

| # | Campo | Tipo | Long. | REQ | Descripción / valores |
|---|---|---|---|---|---|
| 1 | Consecutivo Maestro | Numérico | 30 | S | Enlaza con el maestro |
| 2 | Consecutivo detalle | Numérico | 30 | S | Identifica los registros de detalle |
| 4* | Posición de Gastos | Carácter | 50 | S | Objeto de gasto al máximo nivel del CCP con marca "Usos Presupuestales = SI" relacionado al rubro |
| 5* | Valor | Numérico | 22,8 | S | Sin miles; decimales con coma |

\* La numeración 1, 2, 4, 5 (sin 3) aparece así en el documento fuente.

Ejemplos oficiales: `1|1|A-02-02-02-010|64231,00` · `1|2|A-02-02-02-006-004|16600,00`

## Tablas de códigos (Guía 6 sec. 3.11 y Guía 12)

- **Atributo contable (48 códigos)**: 01 Anticipo ByS · 02 ByS pagado por anticipado · 03 Encargo fiduciario · 04 Fondos administrados · **05 Ninguno** · 06 Fideicomiso · 07 Caja menor · 08 Préstamos · 09 Reembolso caja menor · 10 Anticipo proyectos de inversión · 11 FONPET · 12 Cuotas partes bonos pensionales · 13–22 ByS pagados por anticipado (seguros, arrendamientos, impresos, honorarios, títulos, intereses, comisiones, mantenimiento, contribuciones, estudios) · **23 Avances para viáticos** · 24–28 depósitos · 29 Excedentes financieros · 30 GPA-sueldos · 31 Cesantías · 32 Vacaciones · 33 Prima de vacaciones · 34 Prima de servicios · 35 Crédito a empleados · 36–37 GMF · 38 Estampilla pro-UNAL · 39 Devolución ahorro voluntario SENA · **40 ByS, impuestos y transferencias causados** · 41 Ejecución rezago sin flujo · 42 Corto plazo · 43 Largo plazo · 44 Financiamiento BanRep · 45–46 Beneficios a empleados · 47 Fondos de contingencias · 48 Depósitos en garantía.
- **Tipo de gasto (54 códigos + adiciones CGN)**: 6 Materiales y suministros (1514xx) · 7 PPYE bienes muebles en bodega (1635xx) · 8 Intangibles-software (1970xx) · 15 Sueldos y salarios (5101xx) · **21 Generales (5111xx)** · 22 Impuestos, contribuciones y tasas · 23/24 Transferencias · 27 Gasto público social · 46 Licencias · 51 Préstamos gubernamentales… y adiciones posteriores de la CGN (69 Generales-Servicios, 114 Generales-Materiales, 116 Tasas). Lista completa en el capítulo del Excel y en la TCON007 vigente.
- **Tipo de cuenta por pagar**: 01 Pago sin descuentos · 03 Servicios públicos · 06 Contrato de obra · 07/08 Viáticos funcionarios/contratistas · 11 Nómina · 16 Servicios técnicos exterior · 20 Reembolso caja menor · 22 Pago no presupuestal · 25/26 Adq. servicios declarantes/no declarantes · 48 Sentencias · 016 Cierre caja menor · 052 Legalización anticipo · 93 Rentas de trabajo · 99 Régimen simple, entre otros.
- **Tipo documento soporte**: 1 Acto administrativo · 2 Resolución · 9 Contrato · 11 Cuenta de cobro · 12 Cumplido a satisfacción · **17 Factura** · 19 Nómina · 30 Solicitud · 31 Acta · 33–40 contratos específicos, entre otros.
- **Expedidor**: 5 Dependencia interna · 6 Órgano judicial · 7 DNP · 8 DGCPTN · **11 Entidad** · 12 CGN · 13 CGR · 14 Órgano rector · 15 Usuario gestión contable.

## Procedimiento operativo (resumen)

1. Verificar prerrequisitos (compromiso con saldo, radicación con tipo correcto, tercero/cuenta, perfil y firma digital).
2. Diligenciar plantillas en Excel (una hoja por archivo) con códigos.
3. Pasar al Bloc de notas reemplazando tabulaciones por `|`; guardar cada `.txt`.
4. Comprimir cada archivo individualmente (`.zip`) y firmarlo digitalmente (`.zip.p7z`), máx. 100 MB.
5. SIIF → menú CARGA → EPG → Obligación → subir maestro y detalles → **Cargar** (no se puede cancelar).
6. **Ver Log / Guardar Log**: exitosos y fallidos registro a registro.
7. Corregir y recargar **solo los fallidos** (recargar exitosos duplica).
8. Verificar: `Reportes / EPG / Obligación / Obligación Presupuestal – Comprobante` y `CEN / EPG / Listado de Obligaciones`. Las obligaciones quedan en estado "Generada" con contabilización automática EPG066 cuando el atributo es 05-Ninguno.

## Errores comunes documentados

| Error | Causa / solución |
|---|---|
| "La extensión del nombre del archivo no es válida" | Falta compresión y/o firma (.zip.p7z) |
| Rechazo inmediato | El firmante no es el usuario que carga |
| Registros fallidos (log) | Códigos inválidos, fecha ≠ día de carga, requeridos vacíos, saldo insuficiente, parametrización TCON (error "MOTCONGAS" → revisar TCON12/TCON7) |
| Duplicados | Se recargaron registros ya exitosos |
| Carga impedida | Espacios/tabulaciones sin reemplazar por `|` |

## Variante: "Obligación homologada al nuevo CCP"

Documento oficial MHCP (v.2.0, 04-01-19; ruta `EPG / Obligación / Carga Masiva Homologación`), usado para el traslado de cuentas por pagar entre vigencias: 4 archivos — CabeceraOBLG (Consecutivo | Número OBLG | PCI), Detalle1 Rubros Origen (8 campos), Detalle2 Rubros Destino (los 8 + atributo, tipo de gasto, tipo de operación, uso contable, cuenta) y Usos Presupuestales opcional.

## Documentos oficiales

| Documento | URL |
|---|---|
| Guía 6 Cargas Masivas EPG v.2022 (Armada/MDN) | https://www.armada.mil.co/sites/default/files/06_guia_financiera_no._6_cargas_masivas_ejecucion_presupuestal_del_gasto_fp27jul2023.pdf |
| Guía Financiera No. 6 v.2019 (DIMAR; sin sección de obligación) | https://www.dimar.mil.co/sites/default/files/informes/Gu%C3%ADa%20Financiera%20No.%206%20-%20Cargas%20Masivas%20Ejecuci%C3%B3n%20Presupuestal%20del%20Gasto.pdf |
| Manual para cargas masivas v.3.0 (MHCP, espejo PTE) | https://www.pte.gov.co/documents/d/portal/copy-1-of-manual-cargas-masivas?download=true |
| Estructura obligación homologada al nuevo CCP (MHCP) | https://www.minhacienda.gov.co/documents/d/portal/estructura-carga-masiva-registrar-obligacion-homologada-al-nuevoccp?download=true |
| Página oficial Cargas Masivas | https://www.minhacienda.gov.co/siif/ciclo-de-negocios/cargas-masivas |
| Estructura carga masiva compromiso v.3.0 (MHCP) | https://www.minhacienda.gov.co/documents/d/portal/3-estructura-carga-masiva-registrar-compromiso-presupuestal-del-gasto-1?download=true |

> Ver también: `curso-carga-masiva-obligaciones.md` (curso paso a paso) y `Carga_Masiva_Obligaciones_SIIF_Nacion.xlsx` (estructura en Excel con plantillas).
