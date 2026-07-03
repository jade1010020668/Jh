# Aplicación "Liquidador + Obligador" — Diseño funcional v0.1

**Objetivo**: reemplazar el flujo manual en Excel del IDEAM (base "nuevo pack" + hojas de liquidadores + macro de pantallazo + base "obligador uno") por una aplicación que: (1) reciba el código del radicado Orfeo, (2) genere la liquidación de impuestos de contratistas de forma exacta, fácil y trazable, y (3) con todo lo ya liquidado, genere la **carga masiva de obligaciones del SIIF Nación** (varias personas por carga) lista para firmar y subir.

> Estado: diseño inicial basado en la descripción verbal del proceso. **Pendiente de auditoría de las bases reales** (`base completa / nuevo pack` con sus hojas ocultas de ICA y retefuente, y `obligador uno`) para replicar las fórmulas exactamente.

---

## 1. El flujo hoy (como está en Excel)

```
Cuenta de cobro radicada en ORFEO (con código/link delimitado)
   ↓ pegar código en "nuevo pack"
Fórmula divide el texto → extrae: anticipado(A)/vencido(V), saldo, días a pagar,
   radicado Orfeo, contrato, contratista, valor, dependencia, CDP, etc.
   ↓ marcas manuales
Columna AL: ¿facturador electrónico?  ·  Tarifa: 383 o 387 (constante todo el año;
   387 SOLO si paga anticipado "A" mes anterior)
   ↓ bases auxiliares
Medicina prepagada · Intereses de vivienda · Dependientes (hijos) · Cambio de tarifa
   ↓ hoja del liquidador (Sergio / Joana / Portilla / Luzdary / Diana)
Celda B14 = número de radicado contabilidad → trae la línea del "nuevo pack"
   y recalcula TODA la liquidación de impuestos (retefuente + ICA, hojas ocultas)
   ↓ botón N10 (macro)
Pantallazo de la liquidación guardado como "<radicadoOrfeo>_liquidación"
   ↓ base "obligador uno"
Construcción manual de la carga masiva de obligaciones (aquí es donde hoy se "brega")
```

**Dolores que la app elimina**: armado manual del archivo plano (formatos, códigos, `|`), errores de carga difíciles de diagnosticar, liquidación dependiente de fórmulas frágiles y hojas ocultas, sin control de estados ni de quién liquidó qué.

## 2. El código de Orfeo: parser

Ejemplo real (separador `-`, 27 campos):

```
64525_20251210068023-2-64525-HERRERA DIAZ ASTRID CAROLINA-1073671396-9270000-30-SI-9270000-7789915,96638655-A-SI-NO-11-NO-2-SI-20251210068023-Oficina de Informática-2992025-CD 44-64525_20251210068023-2992025-0- -X-324 684 43 53
```

| # | Valor de ejemplo | Interpretación tentativa (confirmar contra las fórmulas del Excel) |
|---|---|---|
| 1 | 64525_20251210068023 | Clave contrato_radicadoOrfeo |
| 2 | 2 | Número de pago/cuota |
| 3 | 64525 | Número de contrato |
| 4 | HERRERA DIAZ ASTRID CAROLINA | Nombre del contratista |
| 5 | 1073671396 | Cédula |
| 6 | 9270000 | Valor mensual de honorarios |
| 7 | 30 | Días a pagar |
| 8 | SI | (por confirmar) |
| 9 | 9270000 | Valor a pagar del período |
| 10 | 7789915,96638655 | Saldo (decimal con coma) |
| 11 | A | **A = anticipado / V = vencido** |
| 12–17 | SI, NO, 11, NO, 2, SI | Marcas (facturador, dependientes…, por confirmar) |
| 18 | 20251210068023 | Radicado Orfeo |
| 19 | Oficina de Informática | Dependencia |
| 20 | 2992025 | CDP/compromiso (299-2025, por confirmar) |
| 21 | CD 44 | Modalidad (contratación directa 44) |
| 22–23 | (repetidos) | Clave y CDP repetidos |
| 24–26 | 0, (vacío), X | Por confirmar |
| 27 | 324 684 43 53 | Teléfono |

**Riesgos detectados desde ya** (para la auditoría): un nombre o dependencia con guion rompería el split ingenuo (hay que dividir por posición/patrón, no solo por `-`); los decimales vienen con coma; los campos vacíos llegan como espacio.

## 3. Arquitectura propuesta

```
┌──────────────────────────────── APLICACIÓN ────────────────────────────────┐
│ 1. CAPTURA        Pegar 1..N códigos Orfeo → parser → registros "Radicado" │
│ 2. MAESTROS       (editables solo por ADMINISTRADOR, con histórico)        │
│    · Contratistas (cédula, contrato, dependencia, facturador, teléfono)    │
│    · Medicina prepagada (persona, valor mensual, soporte, vigencia)        │
│    · Intereses de vivienda (persona, valor, vigencia)                      │
│    · Dependientes (persona, sí/no)                                         │
│    · Tarifa 383/387 por persona y vigencia + cambios de tarifa             │
│    · Parámetros: UVT del año, tabla art. 383, tarifas ICA, topes           │
│ 3. MOTOR DE LIQUIDACIÓN (réplica exacta del Excel, con test de regresión)  │
│    entrada: radicado + maestros → salida: liquidación (retefuente, ICA,    │
│    deducciones, neto) + validaciones de reglas                             │
│ 4. COMPROBANTE    PDF "<radicadoOrfeo>_liquidacion.pdf" (reemplaza macro)  │
│ 5. FLUJO/ESTADOS  Radicado → Liquidado → Revisado → En carga → Cargado     │
│ 6. OBLIGADOR      Selecciono N liquidaciones aprobadas → genera los 4      │
│    archivos SIIF (Maestro|Item|Deducciones|Usos) validados, .txt listos    │
│    para zip+firma — o los vuelca a una hoja de Google Sheets               │
│ 7. AUDITORÍA      Quién liquidó, qué maestro cambió, log de cargas         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reglas de negocio ya identificadas (se validan en el motor, no en la cabeza del usuario)

1. **Tarifa constante**: si el contratista inicia el año con procedimiento 383, todo el año es 383; ídem 387. La app **bloquea** el cambio salvo registro en el maestro "cambio de tarifa" por el administrador.
2. **387 solo anticipado**: la única condición para 387 es pagar anticipado (marca `A`, "mes anterior"). Si llega un radicado `V` para una persona 387 → **alerta, no liquida**.
3. **Facturador electrónico** (columna AL de hoy): se hereda del maestro de contratistas, no se marca a mano cada vez. Impacta la obligación en SIIF (vinculación de factura, responsabilidad 52).
4. **Deducciones de la base de retención**: medicina prepagada, intereses de vivienda y dependientes salen de los maestros (con topes legales parametrizados por UVT del año).
5. **ICA**: replicar la lógica de las hojas ocultas (tarifa por actividad y territorialidad) — pendiente auditoría.
6. La liquidación queda guardada e inmutable como `<radicadoOrfeo>_liquidacion` (PDF + registro), con versión si se reliquida.

### Generador de carga masiva (usa lo documentado del SIIF — capítulo 22 del modelo)

- Toma todas las liquidaciones en estado "Revisado" que el usuario seleccione (varias personas por carga, **máx. 200**).
- Produce los **4 archivos oficiales**: Maestro (17 campos), Item (13, con la regla atributo/tipo de gasto/tipo de operación/uso), Deducciones (8: posición del catálogo — p. ej. rentas de trabajo art. 383 `2-01-04-01-29` —, NIT del beneficiario de la deducción, base, tarifa con coma, valor redondeado sin decimales) y Usos presupuestales (si el rubro tiene la marca).
- **Valida antes de exportar** todo lo que hoy hace fallar la carga: separador `|`, sin tabulaciones, fecha de registro = día de la carga, decimales con coma, códigos y no nombres, campos requeridos, suma de ítems vs. valores, compromiso/PCI presentes.
- Exporta: `.txt` listos (solo queda comprimir y firmar con el token) **y/o** hoja de Google Sheets espejo. Registra el lote y, tras la carga en SIIF, permite pegar el log para marcar exitosos/fallidos y reprocesar solo los fallidos.

### Plataforma (recomendación)

**Aplicación web** (una sola página, con base de datos y usuarios/roles: liquidador, revisor, administrador) — es lo que permite bloqueos de reglas, histórico, PDF automático y generación validada de archivos. Como paso intermedio o plan B, todo el motor puede vivir en **Google Sheets + Apps Script** (menús propios, sin fórmulas frágiles), pero la meta es la app.

## 4. Plan de trabajo

| Fase | Entregable | Requisito |
|---|---|---|
| 1. Auditoría | Informe de las bases reales: mapa de campos del código Orfeo, fórmulas de liquidación (incl. hojas ocultas de ICA/retefuente), macro N10, estructura de "obligador uno" | **Los archivos Excel** |
| 2. Motor de liquidación | App que liquida igual que el Excel, probada contra N casos reales (mismo radicado → mismos valores) | Casos de prueba (radicados con su resultado esperado) |
| 3. Maestros + comprobantes | Administración de prepagada/vivienda/dependientes/tarifas + PDF `<radicado>_liquidacion` | — |
| 4. Obligador | Generador de los 4 archivos SIIF validados + export a Google Sheets + control de lotes/logs | Parametrización SIIF de la entidad (PCI, dependencia, rubros, posiciones de deducción) |

## 5. Lo que necesito que me envíes

1. **El Excel "base completa / nuevo pack"** (con las hojas ocultas — sin desprotegerlas no puedo replicar el ICA/retefuente) y **"obligador uno"**.
2. 3–5 **radicados reales con su liquidación esperada** (para el test de regresión: cambiar B14 de 1 a 200 y comparar, como indicaste).
3. Confirmación del significado de los campos 8, 12–17 y 24–26 del código Orfeo (o lo deduzco de las fórmulas al auditar).
4. La parametrización SIIF que usan hoy en el obligador: PCI, dependencia de afectación, rubro(s) de contratistas, tipo de cuenta por pagar, posiciones de deducción, atributo.
