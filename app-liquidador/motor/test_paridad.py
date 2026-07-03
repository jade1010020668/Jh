# -*- coding: utf-8 -*-
"""Prueba de regresión: el motor debe coincidir 100% con el Excel de IDEAM.

Corre el motor contra banco_pruebas.json (valores reales calculados por
BASE_COMPLETA) y exige coincidencia exacta (±1 peso por flotantes) en
retefuente, ICA y ambas bases. Uso: python3 test_paridad.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from motor_liquidacion import liquidar, Radicado, Maestros, Parametros


def num(x, default=None):
    if x is None or x in ('', ' '):
        return default
    try:
        return float(str(x).replace(',', '.'))
    except ValueError:
        return default


def main():
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'banco_pruebas.json')
    data = json.load(open(ruta))
    m = Maestros(
        prepagada=data['prepagada'], vivienda=data['vivienda'],
        zonas={int(k): {'lugar': v['lugar'], 'tarifa': float(v['tarifa'])}
               for k, v in data['zonas'].items() if str(k).isdigit()})
    p = Parametros(uvt=float(data['uvt']))

    total = fallos = 0
    for f in data['filas']:
        hon, dias, tarifa = num(f['honorarios']), num(f['dias']), num(f['tarifa'])
        if hon is None or dias is None or tarifa not in (383.0, 387.0):
            continue  # el Excel tampoco liquida estas filas (tarifa pendiente)
        r = Radicado(honorarios=hon, dias=dias,
                     responsable_iva=str(f['resp_iva']).strip().upper(),
                     planilla=str(f['planilla'] or '').strip(),
                     pensionado=str(f['pensionado'] or 'NO'),
                     zona=int(num(f['zona'], 11)),
                     dependientes=str(f['dependientes'] or 'NO'),
                     tarifa=int(tarifa), compromiso=str(f['compromiso']))
        res = liquidar(r, m, p)
        total += 1
        for campo, esperado in [('retefuente', num(f['retefuente'])),
                                ('ica', num(f['ica'])),
                                ('base_retefuente', num(f['base_rf'])),
                                ('base_ica', num(f['base_ica']))]:
            if esperado is not None and abs(res[campo] - esperado) > 1:
                fallos += 1
                print(f"DIFERENCIA #{f['num']} {f['key']} {campo}: excel={esperado} motor={res[campo]}")
    print(f"{total} liquidaciones evaluadas, {fallos} diferencias")
    return 1 if fallos else 0


if __name__ == '__main__':
    raise SystemExit(main())
