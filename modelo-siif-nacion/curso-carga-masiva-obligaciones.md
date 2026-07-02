# Curso: construye tu carga masiva de obligaciones en SIIF Nación

**Nivel: principiante → operativo. Tiempo estimado: 2–3 horas con práctica.**

Este curso te lleva de cero a construir, firmar y cargar un paquete de carga masiva de obligaciones, entendiendo *por qué* cada campo lleva lo que lleva: cómo se leen los rubros, cómo se buscan las TCON, qué va con qué y qué significa que un rubro esté "atado" a usos o no.

> Material complementario: el archivo **`Carga_Masiva_Obligaciones_SIIF_Nacion.xlsx`** (en esta misma carpeta) trae la estructura campo a campo en pestañas (Maestro, Item, Deducciones, Usos, Facturas, Códigos) y plantillas listas para diligenciar.

---

## Lección 0 — Ubícate: qué es la obligación y dónde estás parado

La cadena presupuestal del gasto es: **Solicitud de CDP → CDP → Compromiso → Radicación de soportes (cuenta por pagar) → OBLIGACIÓN → Orden de pago → Pago**.

La **obligación** es el paso donde la entidad *reconoce que debe* (recibió el bien/servicio y hay factura o soporte). Por eso:

- Consume **saldo por obligar del compromiso** (no puedes obligar más de lo comprometido).
- Es el paso donde nace la **contabilidad automática** (transacción **EPG066**): débito a un gasto o activo, crédito a un pasivo, crédito a las deducciones.
- Se registra una a una por `EPG / Obligación / Crear` (perfil **Gestión Contable**)… o **masivamente** con archivos planos, que es lo que aprenderás aquí (perfil **Entidad – Gestión Cargas Masivas EPG**, transacción que habilita la Administración SIIF del MHCP previa solicitud).

**La carga masiva crea hasta 200 obligaciones de una sola vez**, como si las hubieras digitado una a una.

### Qué necesitas tener ANTES de empezar (checklist de prerrequisitos)

| ✔ | Prerrequisito | Por qué |
|---|---|---|
| ☐ | Compromiso registrado con **saldo por obligar > 0** | El campo 4 del Maestro referencia el compromiso |
| ☐ | **Radicación de soportes** con el **tipo de cuenta por pagar correcto** | Ese tipo determina las deducciones que el sistema propone; si está errado, la cuenta por pagar se ANULA (no se puede modificar) |
| ☐ | Tercero creado, con **cuenta bancaria** al menos en "Registro Previo" | Para obligar basta "Registrada/Registro Previo"; para PAGAR debe estar "Activa" |
| ☐ | Perfil **Entidad – Gestión Cargas Masivas EPG** + carga habilitada por la Administración SIIF | Sin esto no verás la opción en el menú CARGA |
| ☐ | **Certificado de firma digital** (token) instalado y funcionando | Cada archivo se firma; el firmante debe ser el MISMO usuario que carga |
| ☐ | Si el tercero es **facturador electrónico** (responsabilidad 52): factura en estado **"Aprobada"** en el VFE | La vinculación de la factura se hace en la transacción en línea (ver Lección 6) |

---

## Lección 1 — Entiende el rubro: cómo se lee y qué marcas tiene

Un rubro (posición del Catálogo de Clasificación Presupuestal, CCP) se lee así:

```
A - 02 - 02 - 02 - 008 - 004
│    │    │    │     │     └─ nivel fino (ítem/subítem)... hasta el MÁXIMO nivel de desagregación
│    │    │    │     └─ Ordinal (con CPC del DANE: sección del producto)
│    │    │    └─ Objeto
│    │    └─ Subcuenta
│    └─ Cuenta:  01 Personal · 02 Adquisición ByS · 03 Transf. corrientes · 04 Transf. capital
│                05 Comercialización · 06 Activos financieros · 07 Disminución pasivos · 08 Tributos
└─ Tipo: A = Funcionamiento, B = Servicio de la deuda, C = Inversión
Inversión (C): Programa - Subprograma - Proyecto BPIN - Subproyecto
```

Cada posición del catálogo tiene **marcas** que cambian cómo se comporta en la obligación:

| Marca | Qué significa para ti |
|---|---|
| Nivel normativo "Desagregado" | Es el nivel al que se desagregó la apropiación (donde vive el saldo) |
| "Afecta Apropiación = SI" | Nivel donde se controlan saldos (CDP/compromiso) |
| **"Requiere Uso Presupuestal = SI"** | Al obligar este rubro, el sistema **te exige** la carpeta/archivo de **Usos Presupuestales** |
| **"Usos Presupuestales = SI"** | Esta posición (de máximo nivel) **ES un uso**: es lo que seleccionas dentro de la carpeta |

### ¿"Atado o no"? — así funcionan las relaciones de usos

- **A-02 (Adquisición de ByS) y A-05 (Comercialización y producción)**: los objetos de gasto a nivel Sub Ordinal quedan con la marca "requiere uso presupuestal" y **vienen relacionados ("atados") POR DEFECTO** con los objetos de gasto de máximo nivel que dependen de ellos. La entidad puede pedir a la Administración SIIF que **desvincule** los que no use.
- **Transferencias corrientes y proyectos de inversión**: la relación **la define cada entidad** (áreas de planeación y presupuesto) y se solicita por correo a **siifsoporte@minhacienda.gov.co** con asunto "Relación de Usos Presupuestales de transferencias corrientes" o "…de proyectos de inversión". En inversión, el sistema muestra la relación según los **productos** del proyecto matriculado en el DNP (BPIN).

**Dónde consultar qué usos tiene "atado" tu rubro:**
1. Catálogos presupuestales publicados por el MHCP: minhacienda.gov.co → SIIF → Ciclo de Negocios → **Parametrizaciones y catálogos Gestión** (archivos Excel de funcionamiento/deuda e inversión).
2. Dentro del SIIF, al crear una obligación de prueba: la carpeta **"Usos Presupuestales"** solo muestra los usos relacionados a tu rubro.
3. El comprobante de una obligación ya creada: `Reportes / EPG / Obligación / Obligación Presupuestal – Comprobante`.

---

## Lección 2 — Las TCON: dónde se buscan y qué define cada una

Las **Tablas de Eventos Contables (T-CON)** son la parametrización, administrada por la Contaduría General de la Nación (CGN), que convierte tu registro presupuestal en un asiento contable automático.

**Dónde se consultan:**
- **Dentro del SIIF**: `CON / Parametrización / TCON007` y `CON / Parametrización / T-CON12`, opción **"Consultar Catálogo"**.
- **Documentación pública**: contaduria.gov.co → Productos → **Macroproceso contable SIIF Nación** → "Implementación de funcionalidades" (allí están las actualizaciones de la TCON07, del atributo 40, la guía de tipologías, etc.) y la página "Preguntas acerca del SIIF y SPGR".

**Las que usa la obligación:**

| Tabla | Qué define | Cuándo la usas |
|---|---|---|
| **TCON012** | (1) Lista de tipos de operación con su lógica (matriz o usos) y la **cuenta del pasivo = CRÉDITO de la obligación**; (2) relación **tipo de operación ↔ rubro**; (3) relación tipo de operación ↔ rubro ↔ **usos contables** | SIEMPRE: para saber el tipo de operación de tu rubro y si va por matriz o por usos |
| **TCON007** | Matriz directa: tipo de operación + rubro + **tipo de gasto → cuenta DÉBITO** | Cuando tu rubro contabiliza **por matriz directa** |
| **TCON012-4** | Cuentas **débito** admisibles por cada **uso contable** | Cuando tu rubro contabiliza **por usos** |
| **TCON008** | Contabilidad de las **deducciones** (créditos 2436xx retefuente, 2407xx recursos a favor de terceros) | Si tu obligación lleva deducciones |
| **TCON009** | Asiento de la **orden de pago** (por tipo de operación + **atributo contable** + medio de pago + tipo de beneficiario) | Cuando el atributo contable ≠ "05 Ninguno" (el asiento se difiere al pago) |

---

## Lección 3 — "Qué va con qué": la cadena rubro → contabilidad, paso a paso

Esta es **la regla de oro** (Circular CGN 001 de 2019, citada en la Guía Financiera No. 12):

> El **DÉBITO** se define por **matriz directa** a partir del **tipo de gasto** (TCON007), o por **usos contables** cuando hay más de una alternativa (TCON012).
> El **CRÉDITO** se define por el **tipo de operación** asociado al rubro (cada rubro tiene UN solo tipo de operación; un tipo de operación puede agrupar varios rubros).

Y el **ATRIBUTO CONTABLE** define el **momento**: con "05 Ninguno" la obligación contabiliza ya (EPG066); con cualquier otro atributo, la contabilidad la hace la **orden de pago** según la TCON009.

### El algoritmo que sigues para cada rubro que vas a obligar

```
PASO 1: toma tu rubro (ej. A-02-02-02-008-004 Servicios de telecomunicaciones)
PASO 2: busca su TIPO DE OPERACIÓN en TCON012 ("Relación tipo de operación–rubro")
        → ej. tipo de operación 75 - Servicios  → ya sabes la cuenta CRÉDITO (pasivo 24xx)
PASO 3: mira en la "Lista de Tipos de Operación" (TCON012) si ese tipo va por MATRIZ o por USOS
        ├─ MATRIZ DIRECTA → elige el TIPO DE GASTO en TCON007 (te da la cuenta DÉBITO)
        │   ej. tipo de gasto 21 "Generales" → débito 5111xx
        └─ USOS CONTABLES → elige el USO CONTABLE (TCON012) y la CUENTA DÉBITO admisible (TCON012-4)
            ej. uso 22 "Gastos de administración" → cuenta 511119001
PASO 4: define el ATRIBUTO CONTABLE
        ├─ recibiste el bien/servicio y pagas contra entrega → 05 NINGUNO (contabiliza ya)
        └─ anticipo (01), avance de viáticos (23), ByS causados antes (40), etc. → contabiliza al pago
PASO 5: si el rubro tiene marca "requiere uso presupuestal" → prepara además los USOS PRESUPUESTALES
        (el detalle del gasto al máximo nivel del CCP; no confundir con el "uso contable" del paso 3)
```

### Ejemplos reales (documentados en guías oficiales)

1. **Servicios con atributo 05-Ninguno** (contrato de telecomunicaciones, rubro A-02-02-02-008-…): débito **5111xx** (tipo de gasto 21 o uso contable 22) / crédito **2401xx** Bienes y servicios + **2436xx** retefuente. El rubro pertenece al tipo de operación 75-Servicios.
2. **Matriz vs. usos en el mismo grupo**: del rubro A-02-01-01-001 (Edificaciones), solo A-02-01-01-001-001-07 "Viviendas para personal militar" está por **matriz directa** en TCON7; los demás van por **usos contables** (TCON12).
3. **Inversión con usos**: el rubro C-1502-0100-039 tiene tipo de operación **17-Gastos de inversión** con usos 9 (PPYE bodega), 15 (intangibles), 21 y 22; al elegir el uso 9 el sistema ofrece cuentas 163501002, 163504001, 163504002…
4. **Anticipo (atributo 01)**: la obligación NO contabiliza; la orden de pago debita **1906xx Avances y anticipos entregados** (TCON009).
5. **Nómina**: dos obligaciones — una con atributo Ninguno (débito 5101xx / crédito 2511xx + 243615xxx) y otra con los rubros de atributo ≠ Ninguno (Nota 30, Guía 12).

> ⚠️ Dos "usos" distintos que no debes confundir:
> - **Uso contable** (campo 12 del archivo Item): define la **cuenta débito** cuando el rubro no va por matriz.
> - **Uso presupuestal** (archivo 4 del paquete): detalle del gasto al **máximo nivel del CCP** (Decreto 412/2018). Uno es contable, el otro es presupuestal.

---

## Lección 4 — Las deducciones: el tipo de cuenta por pagar manda

1. Todo empieza en la **radicación de soportes**: allí eliges el **tipo de cuenta por pagar** (01 Pago sin descuentos, 07 Viáticos, 11 Nómina, 25/26 Adquisición de servicios declarantes/no declarantes, etc. — lista en la pestaña Códigos del Excel).
2. Ese tipo determina **qué deducciones propone el sistema** en la obligación (parametrización TCON008). Si radicaste con el tipo errado: **anula la cuenta por pagar** y radica de nuevo (no es modificable).
3. En la carga masiva, las deducciones van en el **archivo 3**: posición del catálogo no presupuestal (ej. retefuente honorarios declarantes `2-01-04-01-03-01`, rentas de trabajo art. 383 E.T. `2-01-04-01-29`, ICA `2-02-03-01`), naturaleza y NIT del beneficiario de la deducción, base, tarifa (coma, hasta 3 decimales) y valor **redondeado sin decimales**.
4. **ICA**: define el clasificador regional (municipio donde se prestó el servicio) — la territorialidad importa.
5. Las deducciones de la obligación se vinculan **automáticamente** a las órdenes de pago; no hay archivo de deducciones para el pago.
6. El catálogo vigente se descarga de minhacienda.gov.co → SIIF → Ciclo de negocios → **Gestión de gasto → pestaña "Catálogo"** ("Catálogo No Presupuestal de Deducciones, Tipos de Cuentas por Pagar Soporte").
7. Modificaciones posteriores: `EPG / Obligación / Modificar deducciones` (estado "Generada").

---

## Lección 5 — Construye el paquete: los 4 archivos, campo a campo

**Composición oficial (Guía Financiera No. 6 v.2022, sección 3.5):** Maestro + Detalle (ítems) + Deducciones (si aplica) + Usos Presupuestales (si el rubro tiene la marca). **No existe archivo de "Facturas"** (ver Lección 6).

Estructura resumida (el detalle completo, con tipos, longitudes y obligatoriedad, está en el Excel):

**Archivo 1 – MAESTRO** (un registro por obligación, 17 campos):
`Consecutivo | Fecha registro (día de la carga, yyyy/mm/dd) | codPci | Consecutivo Compromiso | Fecha de Pago | Requiere DIP (SI/NO) | Tipo Cuenta por Pagar | Valor IVA | Tipo Doc Soporte | Número Doc | Fecha Doc | Expedidor | Nombre funcionario | Cargo | Observaciones | urlDocumento | urlDescripcion`

```
1|2020/11/12|36-02-00-005-910110|185519|2020/11/10|NO|07|0|7|1488|2020/11/12|11|ANDRES FELIPE RUIZ MARQUEZ|SUBDIRECTOR ( E )|COM 1488, ANDES-JARDIN...||
```

**Archivo 2 – ITEM/Detalle** (los rubros de cada obligación, 13 campos):
`Consecutivo Maestro | NumRegistro | CodDepAfectacion | CodPosicionGasto | CodRecurso | CodFuente (01/02) | CodSituacionFondos (01/02) | ValorEnPesos | Atributo contable | Tipo de Gasto | Tipo de Operación | Uso Contable | Cuenta contable`

```
1|1|910110|C-3603-1300-14-0-3603025-02|10|01|01|80831|23||17|22|511119001
```

**La regla condicional de los campos 9–13** (aquí es donde se aplica todo lo aprendido en la Lección 3):

| Caso | Atributo | Tipo Gasto | Tipo Operación | Uso Contable | Cuenta |
|---|---|---|---|---|---|
| Rubro por **matriz directa** | ✔ | ✔ (TCON007) | ✔ | *(blanco)* | *(blanco)* |
| **Atributo ≠ 05-Ninguno** | ✔ | *(blanco)* | ✔ | *(blanco)* | *(blanco)* |
| Rubro por **usos contables** | ✔ | *(blanco)* | ✔ | ✔ (TCON012) | ✔ (TCON012-4) |

**Archivo 3 – DEDUCCIONES** (si aplica, 8 campos):
```
7|1|2-03-05-01|01|890900286|968700,00|0,400|3875,00
```

**Archivo 4 – USOS PRESUPUESTALES** (si el rubro está marcado, 4 campos):
```
1|1|A-02-02-02-010|64231,00
1|2|A-02-02-02-006-004|16600,00
```

### Formato: las 6 reglas que hacen fallar cargas

1. Separador **`|`** (Alt+124). Campo vacío = se deja en blanco **conservando el separador** (`||`).
2. **Nada de espacios** de tabulación: al pasar de Excel al Bloc de notas, usa Reemplazar-todo (tab → `|`). *"Un espacio en blanco en la carga del archivo puede impedir que ésta sea exitosa."*
3. Fechas `yyyy/mm/dd`; la **fecha de registro debe ser el día en que cargas**.
4. Valores **sin separador de miles**, decimales con **coma**; el valor de deducción **sin decimales** (redondeado).
5. **Códigos, no descripciones** (pestaña Códigos del Excel).
6. Cursor al final del último carácter de la última fila antes de guardar el `.txt`.

### Flujo de construcción

```
Excel (una hoja por archivo: usa las pestañas PLANTILLA_* del Excel adjunto)
   ↓ copiar sin encabezados
Bloc de notas → reemplazar tabulación por | → guardar .txt (un archivo por cada uno)
   ↓
Comprimir cada .txt individualmente → .zip
   ↓
Firmar digitalmente cada .zip con TU certificado (token) → .zip.p7z   [máx. 100 MB]
```

---

## Lección 6 — Cargar, leer el log y corregir

1. Entra al SIIF → menú **CARGA** (Web de Carga) → ruta **EPG** → **Obligación** → selecciona la carga masiva.
2. Con **"Examinar…"** sube el maestro en su campo y cada detalle en el suyo → botón **"Cargar"**. ⚠️ *Una vez inicia, el proceso no se puede cancelar.*
3. El sistema valida **registro a registro**: al terminar, botón **"Ver Log"** / **"Guardar Log"** → verás exitosos y fallidos con el error de cada uno.
4. **Corrige SOLO los fallidos y recarga SOLO esos** — si recargas los exitosos, el sistema **duplica** las obligaciones.
5. Verifica los documentos creados (quedan en estado "Generada", numeración automática, contabilizadas por EPG066 si el atributo era 05):
   - `Reportes / EPG / Obligación / Obligación Presupuestal – Comprobante` (imprime el soporte; ¡nunca edites un reporte exportado!).
   - `CEN / EPG / Listado de Obligaciones` (filtros por fecha, exportable a Excel).

**Errores comunes y su causa:**

| Error | Causa / solución |
|---|---|
| "La extensión del nombre del archivo no es válida" | El archivo no está comprimido y/o firmado (`.zip.p7z`) |
| Rechazo inmediato sin procesar | El firmante NO es el mismo usuario SIIF que carga |
| Registros fallidos en el log | Códigos malos, fecha ≠ día de carga, campos requeridos vacíos, valor > saldo por obligar, tipo de operación/uso que no corresponde al rubro (error tipo "MOTCONGAS" → revisar TCON12/TCON7) |
| Obligaciones duplicadas | Recargaste registros que ya habían pasado |
| No carga por espacios | Tabulaciones sin reemplazar por `\|` |

**Sobre la factura electrónica**: no existe archivo de facturas en la carga masiva. Si el tercero es facturador electrónico (responsabilidad 52) y el uso tiene marca "Requiere Factura = SI", la factura (en estado **"Aprobada"** en el VFE, identificada por su **CUFE**) se **vincula en la transacción en línea** (carpeta Facturas de la obligación). Para volúmenes con factura obligatoria, valida con la Administración SIIF cómo proceder antes de planear la carga.

**No mezcles**: mientras corre una carga masiva, no registres obligaciones manuales.

---

## Lección 7 — Ejercicio guiado completo

**Caso**: obligar $968.700 de un contrato de servicios de aseo (rubro A-02-02-02-008-005, funcionamiento, Nación CSF), compromiso 185519, con retención en la fuente por servicios.

1. **Radicación**: cuenta por pagar tipo **25** (Adq. servicios declarantes). ✔
2. **Rubro**: A-02 → tiene marca "requiere uso presupuestal" (atado por defecto) → necesitarás el archivo 4.
3. **TCON012**: el rubro pertenece al tipo de operación **75 – Servicios** → crédito 24xx definido. La lista de tipos de operación dice que va por **usos contables** → eliges uso **22** (gastos de administración) y cuenta **511123xxx** (TCON012-4).
4. **Atributo**: recibiste el servicio del mes → **05 Ninguno** (contabiliza en la obligación).
5. **Archivos**:
   - Maestro: `1|2026/07/02|XX-XX-XX-XXX-XXXXXX|185519|2026/07/20|NO|25|0|17|FE-12345|2026-06-28|11|…nombre…|…cargo…|Aseo junio||`
   - Item: `1|1|XXXXXX|A-02-02-02-008-005|10|01|01|968700|05||75|22|511123001`
   - Deducciones (retefuente servicios declarantes 4%): `1|1|2-01-04-01-04-01|01|800197268|968700,00|4,000|38748`
   - Usos: `1|1|A-02-02-02-008-005-…(máximo nivel)|968700,00`
6. `.txt` → `.zip` → firma → `.zip.p7z` (4 archivos) → CARGA/EPG/Obligación → Cargar → Ver Log → comprobante.

*(Los códigos de PCI, dependencia, cuenta débito exacta y posición de deducción deben salir de TU parametrización — este ejemplo ilustra el método, no valores para copiar.)*

---

## Chequeo final antes de cargar (imprime esto)

- [ ] Compromiso con saldo ≥ suma de ítems; una obligación por línea de pago.
- [ ] Cuenta por pagar radicada con el tipo correcto.
- [ ] Por cada rubro: tipo de operación verificado en TCON12; matriz o usos resuelto (TCON7 / TCON12-4); atributo definido.
- [ ] Rubros con marca "requiere uso presupuestal" → archivo 4 diligenciado al máximo nivel del CCP.
- [ ] Deducciones: posición, NIT del beneficiario, base, tarifa (coma), valor redondeado.
- [ ] Formato: `|`, sin tabulaciones, fechas del día, valores sin miles y con coma decimal, códigos y no nombres.
- [ ] Máximo 200 obligaciones; 4 archivos `.txt` → `.zip` → `.zip.p7z` firmados por TI.
- [ ] Horario hábil de perfiles de negocio (6:00–12:30 / 13:00–23:00).
- [ ] Después: Ver Log → corregir SOLO fallidos → comprobantes y listado CEN.

---

## Fuentes del curso

- Guía Financiera No. 6 "Cargas Masivas Ejecución Presupuestal del Gasto" (GF-G-006 v.2022, MinDefensa; publicación Armada Nacional 2023) — estructura verbatim de los 4 archivos.
- "Manual para cargas masivas" v.3.0 (11-09-2023), Administrador SIIF Nación (MHCP; espejo pte.gov.co).
- Guía Financiera No. 12 "Ejecución presupuestal del gasto" (MinDefensa/DIMAR) — TCON, atributos (48), tipos de gasto (54), asientos EPG066.
- Circular CGN 001 de 2019 (regla débito/crédito) y documentos CGN "Implementación de funcionalidades" (TCON07 2021, atributo 40 v.4 2025); instructivo CGN CEN19-INS01.
- Circular Externa 035 de 2025 (MHCP) — usos presupuestales por defecto A-02/A-05 y solicitudes a siifsoporte@minhacienda.gov.co.
- Guía "Gestión de Gasto con Factura Electrónica" v1.0 (MHCP, 2021) — vinculación de facturas (responsabilidad 52, marca Requiere Factura).

> ⚠️ La parametrización TCON y los catálogos cambian: antes de producción, verifica la estructura y los códigos vigentes en el propio SIIF (`CON / Parametrización`) y en minhacienda.gov.co (SIIF → Ciclo de Negocios → Cargas Masivas), o con la línea SIIF (601) 602 1270 op. 1.
