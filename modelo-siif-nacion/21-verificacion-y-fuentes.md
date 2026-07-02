# 21. Verificación de hallazgos, fuentes y advertencias metodológicas

Este modelo se construyó con dos procesos paralelos: (a) una investigación profunda con verificación adversarial (65 afirmaciones extraídas de 16 fuentes; las 25 principales sometidas a votación de 3 verificadores independientes cada una: 20 confirmadas, 5 refutadas y excluidas) y (b) un enjambre de 21 agentes de investigación especializados, uno por módulo o dimensión del sistema, más un crítico de completitud que ordenó cubrir los vacíos detectados (DYC/facturación, CCP, CSF/SSF, interoperabilidad y novedades 2024-2026).

## Afirmaciones confirmadas (votación 3-0)

1. **Definición y naturaleza**: SIIF Nación es una herramienta modular, transversal y transaccional del MHCP que consolida la información financiera de las entidades del PGN (excepto empresas estatales) en línea y tiempo real. *(Fuentes: minhacienda.gov.co/siif/siif-nacion/informacion-general; contaduria.gov.co/preguntas-acerca-del-siif-y-spgr)*
2. **Portal documental**: minhacienda.gov.co/siif organiza la documentación en Información General, Formatos, Capacitaciones en Línea, Capacitación, Estadísticas, Acceso Consulta de Pagos, Normativa, Ciclo de Negocios y Aspectos Técnicos.
3. **Aspectos Técnicos**: catálogo de ~10 documentos (manual VPN SSL, componente de firma digital actualizado en 2025, esquema de interconexión, ancho de banda, canales de contingencia, lista de chequeo, configuración de clientes y servidores).
4. **Cargas Masivas**: funcionalidad oficial con manual y ~37 documentos de estructuras de archivos (terceros ligeros, cuentas bancarias, usuarios VFE, módulos APR y EPG).
5. **Perfiles**: dos tipos — Administrativo (MHCP, CGN, DGCPTN, sin restricción horaria) y de Negocio (`Entidad – …`, horario 6:00 a.m.–12:30 p.m. y 1:00–11:00 p.m.). *(Guía Financiera No. 65, MinDefensa, 2016; vigencia del horario confirmada por fuentes 2023-2025)*
6. **Obligatoriedad**: Decreto 1068 de 2015, art. 2.9.1.1.3 (compila Decreto 2674 de 2012, art. 3); las CAR, EICE y sociedades de economía mixta que reciben recursos del PGN lo usan solo para el giro de esos recursos.
7. **Cadena del gasto**: cinco etapas oficiales (CDP, compromiso, radicación de cuenta por pagar, obligación, orden de pago — con efecto contable en las dos últimas) y siete pasos transaccionales con perfil y ruta de menú (Guía Financiera No. 12, MinDefensa, 2019), previas las configuraciones preliminares (roles, dependencias de afectación y ordenadores del gasto, desagregación de apropiaciones, PAC/Cupo PAC).
8. **Alcance funcional**: programación presupuestal, apropiaciones, PAC, ingresos, pagos, contabilidad automática y manual mediante tablas de eventos contables (T-CON), comisiones y viáticos, tesorería.
9. **Pago a beneficiario final**: art. 2.9.1.2.1 del Decreto 1068 de 2015; el traslado a pagaduría es excepcional (Comité Operativo y de Seguridad) y la DGCPTN puede bloquear órdenes o reducir PAC.

## Afirmaciones refutadas (excluidas del modelo o marcadas con cautela)

| Afirmación descartada | Votación |
|---|---|
| El portal SIIF se organiza en solo 3 secciones (Circulares, Ciclo de Negocios, Documentos Técnicos) | 0-3 |
| Lista exacta y cerrada de ~25 perfiles de negocio | 1-2 |
| Matriz específica de incompatibilidades de perfiles atribuida al MHCP tal como la describía la fuente | 0-3 |
| Detalle del trámite de privilegios con correo atencioncliente@ como canal vigente | 1-2 |
| Definición del sistema tomada del PDF del DNP ("herramienta modular automatizada… y sus entidades descentralizadas") | 0-3 |

> Nota: los capítulos 02 y 09 describen perfiles e incompatibilidades a partir de guías oficiales de entidades usuarias y circulares (013/2021, 044/2022); trátense como referencia operativa, no como lista taxativa vigente — el catálogo oficial de perfiles lo define el Comité Operativo y de Seguridad y cambia con el tiempo.

## Advertencias metodológicas

- **Protección anti-bot**: minhacienda.gov.co bloquea la lectura automatizada directa (Radware). Las páginas del MHCP se verificaron mediante snapshots de Wayback Machine (abril–junio de 2025) e índices de buscadores; los conteos de documentos (10 en Aspectos Técnicos, 37 en Cargas Masivas) son válidos a la fecha del snapshot.
- **Fuentes espejo**: buena parte del detalle operativo (rutas de transacción, perfiles, flujos paso a paso) proviene de guías financieras del Ministerio de Defensa (dimar.mil.co) y de instructivos de la DIAN, el ICBF y otras entidades usuarias, que transcriben la documentación estándar del Administrador SIIF. Coinciden entre sí, pero su fecha de vigencia varía (2016–2025).
- **Autodescripción institucional**: los atributos "segura" y "en tiempo real" son descripciones del propio MHCP/CGN, no auditoría técnica independiente.
- **Cifras cambiantes**: horarios, calendarios de cierre, versiones del aplicativo y catálogos se actualizan cada año por circular externa; ante cualquier decisión operativa debe consultarse la circular vigente en minhacienda.gov.co/siif/normativa.

## Preguntas abiertas (sin respuesta verificada en fuentes públicas)

1. Arquitectura interna del backend (motor de base de datos, servidor de aplicaciones) más allá de los requisitos de acceso (VPN SSL Juniper/Pulse Secure-Ivanti, firma digital).
2. Listado oficial, exhaustivo y vigente de los perfiles de negocio y su matriz formal de incompatibilidades.
3. Cifra oficial consolidada de usuarios activos del sistema.
4. Catálogo completo de circulares y comunicados vigentes a 2026 (la carpeta Normativa se actualiza continuamente).

## Fuentes primarias principales

- https://www.minhacienda.gov.co/siif — portal oficial SIIF Nación
- https://www.minhacienda.gov.co/siif/siif-nacion/informacion-general
- https://www.minhacienda.gov.co/siif/aspectos-tecnicos
- https://www.minhacienda.gov.co/siif/ciclo-de-negocios/cargas-masivas
- https://www.minhacienda.gov.co/siif/ciclo-de-negocios/gestion-gasto
- https://www.minhacienda.gov.co/siif/ciclo-de-negocios/programacion-presupuestal
- https://www.contaduria.gov.co/preguntas-acerca-del-siif-y-spgr — FAQ oficial CGN
- Guía Financiera No. 12 "Ejecución presupuestal del gasto" (MinDefensa/DIMAR, 2019)
- Guía Financiera No. 65 "Perfiles SIIF Nación" (MinDefensa/DIMAR, 2016)
- Decreto 2674 de 2012 y Decreto 1068 de 2015 (normogramas de Función Pública, CRC y MinTIC)
- Instructivo IT8.P3.GF ICBF "Generación de reportes de ejecución presupuestal SIIF Nación" (v3, 2024)

Cada capítulo (01–20) incluye además su propia tabla de documentos e instructivos con enlaces.
