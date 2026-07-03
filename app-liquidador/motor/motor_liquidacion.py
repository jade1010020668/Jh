# -*- coding: utf-8 -*-
"""Motor de liquidación de impuestos para contratistas (IDEAM).

Réplica exacta de las fórmulas auditadas en BASE_COMPLETA (hojas ocultas
'383' e 'ica'; ver AUDITORIA.md). Es la implementación de referencia del
backend de la aplicación: recibe los datos del radicado + maestros y
devuelve la liquidación (retefuente, ICA y bases).
"""
from dataclasses import dataclass, field
import math


def round_excel(x, num_digits):
    """ROUND de Excel: mitad SIEMPRE lejos de cero (no bancario)."""
    if x is None:
        return None
    m = 10 ** num_digits
    return math.copysign(math.floor(abs(x) * m + 0.5), x) / m


def roundup_excel(x, num_digits):
    """ROUNDUP de Excel: siempre lejos de cero."""
    m = 10 ** num_digits
    return math.copysign(math.ceil(round(abs(x) * m, 10)), x) / m


@dataclass
class Parametros:
    """Parámetros por vigencia (administrables en la app)."""
    uvt: float = 49799            # UVT 2025
    pct_salud: float = 0.125
    pct_pension: float = 0.16
    pct_arl: float = 0.01044      # riesgo II (Concepto 0912/2018)
    pct_ibc: float = 0.40         # base de cotización = 40% del honorario
    pct_dependientes: float = 0.10
    pct_exenta_387: float = 0.25  # renta exenta sólo tarifa 387
    iva: float = 0.19
    # tabla art. 383 E.T.: (desde_uvt, hasta_uvt, tarifa_marginal, adicion_uvt)
    tabla_383: tuple = (
        (0, 95, 0.0, 0),
        (95, 150, 0.19, 0),
        (150, 360, 0.28, 10),
        (360, 640, 0.33, 69),
        (640, 945, 0.35, 162),
        (945, 2300, 0.37, 268),
        (2300, float("inf"), 0.39, 770),
    )


@dataclass
class Radicado:
    """Datos del radicado (post-parser, ya editables por el usuario)."""
    honorarios: float          # honorario mensual (campo 6 del código)
    dias: float                # días a pagar (campo 7)
    responsable_iva: str       # SI/NO (campo 8)
    planilla: str              # 'A' anticipado / 'V' vencido (campo 11)
    pensionado: str            # SI/NO (campo 13)
    zona: int                  # zona operativa (campo 14; 11 = Bogotá)
    dependientes: str          # SI/NO (campo 15)
    tarifa: int                # 383 o 387 (maestro CAMBIO DE TARIFA)
    compromiso: str            # RP (campo 3)
    viaticos: float = 0.0


@dataclass
class Maestros:
    """Maestros administrables (prepagada, vivienda, zonas)."""
    prepagada: dict = field(default_factory=dict)   # compromiso -> valor mensual
    vivienda: dict = field(default_factory=dict)    # compromiso -> valor mensual
    zonas: dict = field(default_factory=dict)       # zona -> {'lugar', 'tarifa'}


def liquidar(r: Radicado, m: Maestros, p: Parametros = Parametros()) -> dict:
    """Liquida un radicado. Devuelve todas las bases y valores intermedios
    (los mismos que producen las hojas ocultas '383' e 'ica')."""
    # --- Comunes -----------------------------------------------------------
    hon_periodo = r.honorarios * r.dias / 30                    # PAC!F
    neto = hon_periodo / (1 + p.iva) if r.responsable_iva == "SI" else hon_periodo  # PAC!G
    anticipado = str(r.planilla).strip().upper() == "A"
    pensionado = str(r.pensionado).strip().upper() == "SI"

    # --- ICA (hoja 'ica') ---------------------------------------------------
    base_aporte = neto * p.pct_ibc                              # ica!I
    salud_ica = roundup_excel(base_aporte * p.pct_salud, -2)    # ica!J
    pension_ica = roundup_excel(base_aporte * p.pct_pension, -2)  # ica!K
    if int(r.zona) == 11:                                       # sólo Bogotá depura
        if anticipado and not pensionado:
            base_ica = neto - salud_ica - pension_ica           # ANO
        elif anticipado and pensionado:
            base_ica = neto - salud_ica                         # ASI
        else:
            base_ica = neto                                     # VNO / VSI
    else:
        base_ica = neto
    base_ica += r.viaticos                                      # ica!R
    zona_info = m.zonas.get(int(r.zona), {})
    tarifa_ica = zona_info.get("tarifa", 0) or 0
    ica = base_ica * tarifa_ica                                 # ica!U (sin redondeo)

    # --- Retefuente (hoja '383') ---------------------------------------------
    ibc = neto * p.pct_ibc                                      # 383!C
    salud = ibc * p.pct_salud if anticipado else 0.0            # 383!D (sin redondeo)
    pension = ibc * p.pct_pension if anticipado else 0.0        # 383!E
    arl = ibc * p.pct_arl if anticipado else 0.0                # 383!F
    ded_dependientes = neto * p.pct_dependientes if str(r.dependientes).strip().upper() == "SI" else 0.0
    prepagada = float(m.prepagada.get(str(r.compromiso), 0) or 0)
    vivienda = float(m.vivienda.get(str(r.compromiso), 0) or 0)
    renta_liquida = neto - salud - pension - arl - ded_dependientes - prepagada - vivienda  # 383!K
    pct_exenta = p.pct_exenta_387 if int(r.tarifa) == 387 else 0.0  # 383!L
    base_retefuente = renta_liquida - renta_liquida * pct_exenta    # 383!N
    base_uvt = base_retefuente / p.uvt                              # 383!O

    retefuente = 0.0
    for desde, hasta, tarifa_m, adicion in p.tabla_383:
        if desde < base_uvt <= hasta or (hasta == float("inf") and base_uvt > desde):
            if tarifa_m == 0:
                retefuente = 0.0
            else:
                retefuente = round_excel((base_uvt - desde) * tarifa_m * p.uvt + adicion * p.uvt, -3)
            break

    return dict(
        hon_periodo=hon_periodo, neto=neto,
        base_ica=base_ica, tarifa_ica=tarifa_ica, ica=ica,
        salud=salud, pension=pension, arl=arl,
        dependientes=ded_dependientes, prepagada=prepagada, vivienda=vivienda,
        renta_liquida=renta_liquida, pct_exenta=pct_exenta,
        base_retefuente=base_retefuente, base_uvt=base_uvt, retefuente=retefuente,
        lugar=zona_info.get("lugar", ""),
    )
