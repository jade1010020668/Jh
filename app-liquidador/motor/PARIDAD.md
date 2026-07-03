# Prueba de paridad del motor de liquidación

**Resultado: 78/78 liquidaciones reales coinciden al 100% con el Excel** (retefuente, ICA, base de retefuente y base de ICA, tolerancia ±1 peso por aritmética de flotantes).

- Banco de pruebas: `banco_pruebas.json` — 392 filas extraídas de la hoja oculta `PAC` de `BASE_COMPLETA_Al_1.xlsx` con los valores que el propio Excel tiene calculados.
- Universo evaluable: 78 filas con tarifa asignada (383: 42, 387: 36). Las 314 restantes están en estado "AGREGAR TRIBUTO" (tarifa = 0) y **el Excel tampoco las liquida** (ninguna tiene retefuente calculada).
- Motor: `motor_liquidacion.py` — réplica de las hojas ocultas `383` e `ica` con redondeos idénticos a Excel (ROUND mitad-lejos-de-cero, ROUNDUP para aportes en la base ICA).
- Ejecutar: `python3 test_paridad.py` (sale con código 1 si hay cualquier diferencia).

Este test es la puerta de calidad de la Fase 1: cualquier cambio al motor debe seguir dando 0 diferencias.
