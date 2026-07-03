# Auditoría de las bases IDEAM: BASE_COMPLETA y OBLIGADOR_1

**Archivos auditados**: `BASE_COMPLETA_Al_1.xlsx` (25 hojas, 16 ocultas) y `OBLIGADOR_1_1.xlsx` (11 hojas, 3 ocultas). Fecha: 2026-07-03.

---

## 1. Cómo funciona el sistema (ingeniería inversa completa)

### 1.1 El código de Orfeo — mapeo REAL de campos (corregido)

En `NUEVO PAC!B` se pega el código y `C2 = IFERROR(TEXTSPLIT(B2,"-"),"AGREGAR CODIGO")` lo derrama en las columnas **C→AC (27 campos)**:

| Col | Campo | Col | Campo |
|---|---|---|---|
| C | key (contrato_orfeo) | Q | Dependientes (SI/NO) |
| D | # de cuenta (pago) | R | Nivel de riesgo ARL (1-5) |
| E | Compromiso | S | Facturador electrónico (SI/NO) |
| F | Nombre | T | # Orfeo |
| G | Identificación | U | Dependencia |
| H | Honorarios mensuales | V | # CTO (RP) |
| I | Días (siempre 30) | W | Dcto. equivalente # |
| J | Responsable de IVA (SI/NO) | X | KEY (repetida) |
| K | Valor honorario | Y | Contrato (repetido) |
| L | Valor honorario responsables | Z, AA, AB | 0, vacío, X (relleno) |
| M | Planilla **A**nticipado/**V**encido | AC | Teléfono |
| N | Declarante (SI/NO) | | |
| O | Pensionado (SI/NO) | | |
| P | Zona operativa (11 = Bogotá) | | |

Columnas calculadas: `AD` mes anterior y `AE` tarifa 383/387 (lookup a `Hoja1`, que a su vez lee `CAMBIO DE TARIFA`); `AI` validación (ERROR si días ≠ 30; FACTURADOR; convenios mixtos); `AJ/AK` cruce con `COMPROMISOS`; `AL/AP` estado CXP/OBL contra la hoja oculta `OBLIGADOR 1`.

### 1.2 Cadena de hojas (flujo de datos)

```
NUEVO PAC (captura+split) → BASE DE DATOS (espejo, neto de IVA: J=I/1,19 si responsable)
   → PAC (por radicado: honorario período F=C×D/30, neto G; junta ICA y retefuente)
        ← ica  (hoja oculta: base y valor de ICA)
        ← 383  (hoja oculta: base y valor de retefuente)
   → SERGIO/JOHANNA/PORTILLA/LUZ DARY/DIANA (comprobante GF-F031 v03: B14 = radicado)
   → OBLIGADOR 1 (oculta: cruza key↔COMPROMISOS↔PAC; estados CXP/OBL; valida nombre del
     compromiso = nombre del código, col O)
COMPROMISOS = export del listado SIIF (CEN) con rubro, fuente, recurso, saldos y estados
```

### 1.3 Motor de retefuente (hoja oculta `383`) — art. 383/388 E.T.

Parámetros: **UVT = 49.799** (2025) · salud 12,5% · pensión 16% · ARL 1,044% (riesgo II).

```
B  Honorario del período (neto de IVA)               ← PAC!G
C  IBC = 40% del honorario
D/E/F  Aportes salud/pensión/ARL sobre el IBC — SOLO si planilla = "A"
H  Dependientes: 10% del honorario si marca SI
I/J  Medicina prepagada / intereses de vivienda — lookup por COMPROMISO
     en 'PREPAGADA Y VIVIENDA' (valores mensuales; algunos = anual/12)
K  Renta líquida = B − D − E − F − H − I − J
L  25% renta exenta SOLO si tarifa = 387 (X=IF(387;25%;0%)); 383 → 0%
N  Base gravable = K − K×L    →   O = N / UVT
W  Retefuente por tabla marginal art. 383 (redondeada a miles):
   0–95 UVT: 0 · 95–150: 19% · 150–360: 28%+10 UVT · 360–640: 33%+69 ·
   640–945: 35%+162 · 945–2300: 37%+268 · >2300: 39%+770
```

### 1.4 Motor de ICA (hoja oculta `ica`)

```
I  Base aporte = 40% honorario;  J = salud 12,5% (ROUNDUP a centenas);  K = pensión 16% (ROUNDUP)
O  Código = planilla & pensionado → ANO / ASI / VNO / VSI
P  Base ICA (solo zona 11 Bogotá):  ANO = C−J−K · ASI = C−J · V** = C (plena)
   Zonas ≠ 11: base plena
R = P + viáticos;  T = tarifa por zona ('PREPAGADA Y VIVIENDA'!C: Bogotá 0,766%,
Medellín 0,18%, Barranquilla 1,16%, Bucaramanga 0,9%, Cali 0 → "ELIMINAR", etc.)
U  ICA = R × T
```

### 1.5 Comprobante (hojas SERGIO/…, formato GF-F031 v03)

`B14` = radicado contabilidad → trae nombre/cédula/dependencia/contrato (BASE DE DATOS), radicado Orfeo, honorario y factura (PAC). Conceptos: **Retefuente** (NIT DIAN 800197268), **ReteICA** (tarifa y NIT de alcaldía por zona), **ReteIVA** 15% sobre IVA teórico (si responsable: (honorario/1,19)×19%×15%), **Pro-universidades** 0,5% (zona 7 Pasto → U. de Nariño 800118954), **Pro-hospitales** (zonas 8/10), **Sobretasa bomberil** 2% (zona 5 → Gobernación del Magdalena 800103920) y filas manuales (embargo, libranza, AFC). Total con SUBTOTAL.

### 1.6 Generador de carga masiva (`OBLIGADOR_1_1.xlsx`)

- **`RP al 24052024`** y **`Exportar (81)`**: exports del SIIF (compromisos) → dependencia, rubro, fuente, recurso, situación, saldos.
- **`A OBLIGAR`**: arma el lote (key → compromiso), valida saldo del RP contra lo ya obligado en ITEM.
- **`CXP`**: radicación de cuentas por pagar — PCI `32-02-00-000` (IDEAM), fecha = HOY, tipo doc `03`, cuenta = cédula, **tipo cuenta 103**, valor = honorario neto (PAC!G), doc soporte tipo `11` (cuenta de cobro) + # factura/Orfeo, expedidor `11`, texto "`KEY` PAGO HONORARIOS".
- **`MAESTRO`**: archivo 1 del SIIF (fechaRegistro=HOY, fechaPago=+2 días, DIP NO, IVA, doc soporte, expedidor) — coincide con la estructura oficial de 17 campos.
- **`ITEM`**: archivo 2 — dependencia y rubro desde el export del RP; fuente/recurso/situación mapeados; **valor = neto** (CXP!H); atributo **25 si CONVENIO, si no 5 (Ninguno)**; tipo gasto / tipo operación / uso contable / cuenta desde una **tabla de parametrización embebida (V6:AC33)** por rubro, p. ej.: `A-02-02-02-008-002 → tipoGasto 21, tipoOp 74` (matriz directa) · `A-02-02-02-008-003 → tipoOp 188, uso 22, cuenta 511179001` (usos) · inversión `C-… → tipoOp 17, uso 22, cuenta 511179001`; y sección USOS (rubro a máximo nivel, ej. `A-02-02-02-008-003-09`, valor = ítem).
- **`DEDUCCIONES`**: por persona genera **fila de ICA** — posición `2-01-05-01-01-03-05` si zona 11 (Bogotá, NIT 899999061) o `2-01-05-01-97` con NIT de la alcaldía según zona — y **fila de RETEFUENTE** cuando hay valor: posición `2-01-04-01-29` (rentas de trabajo), NIT DIAN 800197268, base = PAC!R, valor = PAC!S, tarifa recalculada `ROUND(valor/base×100;5)`. Cali (tarifa 0) marca "ELIMINAR".

---

## 2. Hallazgos de auditoría (riesgos y errores)

| # | Hallazgo | Gravedad | Detalle |
|---|---|---|---|
| 1 | **Fórmulas rotas `#REF!`** | Alta | `BASE DE DATOS!N` (zona operativa) contiene `XLOOKUP(...,#REF!,#REF!)`: el respaldo cuando la zona viene "0" está roto |
| 2 | **Umbral desactualizado 4.471.175** | Alta | Las hojas de liquidador muestran la base de retefuente solo si > 4.471.175 (= 95 UVT de **2024**); la hoja `383` ya usa UVT 49.799 (2025 → 95 UVT = 4.730.905). Inconsistencia entre motor y comprobante |
| 3 | **Vínculos externos `[1]`** | Alta | `OBLIGADOR_1` depende de referencias externas a `BASE_COMPLETA` (`[1]PAC!`, `[1]BASE DE DATOS!`): si el libro no está abierto/actualizado, la carga se construye con valores viejos |
| 4 | **TEXTSPLIT por `-`** | Alta | Un nombre o dependencia con guion desplaza TODAS las columnas del código (liquidación con datos corridos). No hay validación de número de campos = 27 |
| 5 | **La macro del pantallazo no existe en el archivo** | Media | `BASE_COMPLETA_Al_1.xlsx` es `.xlsx` (sin macros): el botón N10 perdió su VBA; el guardado `<radicado>_liquidación` es manual/otro archivo |
| 6 | **Redondeos heterogéneos** | Media | Retefuente a miles (`ROUND -3` y `ROUND(...,-0.2)` — este último es un argumento inválido/no estándar que Excel trunca a 0), aportes a centenas (`ROUNDUP -2`), tarifa de deducción con 5 decimales. Riesgo de descuadres de ±1 peso contra SIIF (que exige deducción sin decimales) |
| 7 | **Tipo de cuenta por pagar `103`** | Media | `CXP!G = 103` no corresponde a los códigos del catálogo oficial documentado (01, 25, 26, 93…). Verificar contra el catálogo vigente del SIIF (posible código válido nuevo o error heredado) |
| 8 | **Controles manuales de duplicados** | Media | El "¿ya tiene CXP/OBL?" se resuelve con lookups a la hoja oculta `OBLIGADOR 1` (AL/AP de NUEVO PAC); nada impide obligar dos veces el mismo radicado |
| 9 | **Sin validaciones de la carga** | Media | No hay chequeo de máx. 200 registros, de campos requeridos, ni generación del `.txt` con `\|` (se copia a mano al Bloc de notas) |
| 10 | **Fechas frágiles** | Baja | `fechaRegistro = TODAY()` es volátil: si el archivo se abre otro día, cambia; `fechaPago = registro+2` fija |
| 11 | **Datos incrustados en fórmulas** | Baja | NITs (DIAN, alcaldías, U. de Nariño), tarifas (25%, 10%, 12,5%, 16%, 15% reteIVA, 0,5%, 2%) y la tabla art. 383 están dispersos en fórmulas y hojas — deben ser **parámetros por vigencia** en la app |
| 12 | **Redundancias heredadas** | Info | `I2=F2*G2/G2`, `+1-1` por doquier (coerción a número), hojas espejo triples (NUEVO PAC → BASE DE DATOS → PAC) — en la app esto es una sola tabla |

## 3. Reglas de negocio confirmadas (para el motor de la app)

1. Días siempre 30 (otro valor → ERROR); honorario del período = honorario × días/30.
2. Si responsable de IVA: base = honorario/1,19; reteIVA = base×19%×15%.
3. Aportes (salud 12,5%, pensión 16%, ARL según riesgo, sobre IBC 40%) se restan solo si planilla = **A**; pensionado no resta pensión en la base ICA.
4. 25% de renta exenta solo con tarifa **387**; 383 → 0% (regla de la entidad).
5. Dependientes: 10% del honorario. Prepagada y vivienda: valores mensuales por compromiso (mantenidos por el admin).
6. ICA solo depura seguridad social en zona 11 (Bogotá); tarifa y NIT de la alcaldía por zona; Cali tarifa 0 → sin fila.
7. Deducciones SIIF: ICA → `2-01-05-01-01-03-05` (Bogotá) / `2-01-05-01-97` (resto); Retefuente → `2-01-04-01-29` (DIAN).
8. Obligación SIIF: valor = **neto de IVA**, atributo 5 (25 si convenio), parametrización contable por rubro (tabla embebida), usos presupuestales al máximo nivel.
9. El export del SIIF (listado de compromisos CEN) es el insumo para dependencia/rubro/fuente/recurso/situación y para validar saldos.
10. Devoluciones al área (hoja DEV): motivo estandarizado, responsable y fechas — módulo de devoluciones en la app.

## 4. Conclusión

El sistema es coherente y reproducible: **captura (split del código) → maestros → motor 383/ICA → comprobante → lote → 4 archivos SIIF**. Todos los cálculos están ahora documentados campo a campo, lo que permite construir el motor de la aplicación con **paridad exacta** y un banco de pruebas de regresión contra los valores del Excel (cambiar B14 = 1…N y comparar). Los hallazgos 1–4 son los que hoy producen los errores "misteriosos" en las cargas y quedan eliminados por diseño en la app (parser validado, datos en base de datos, sin vínculos externos, validaciones SIIF antes de exportar).
