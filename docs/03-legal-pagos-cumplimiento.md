# 03 · Legal, Pagos y Cumplimiento

> **Este documento decide si el negocio puede cobrar y sobrevivir.** En contenido adulto, el riesgo #1 no es la competencia: es quedarse sin procesador de pagos o cruzar una línea penal. Todo lo de abajo fue investigado y contrastado con fuentes primarias en julio 2026.

---

## 0. Las cinco verdades incómodas

1. **Stripe y PayPal están prohibidos** para este negocio — la lista de negocios prohibidos de Stripe veta el contenido adulto **incluyendo explícitamente el generado por IA** (verificado en su ToS); PayPal es igual de hostil (según Segpay, exige remover la IA de comercios adultos y congela fondos hasta 180 días). Usarlos "camuflado" = terminación + lista MATCH (5 años sin poder abrir cuentas merchant).
2. **Procesar pagos costará 10–15% por transacción**, no el 2.9% de una startup normal, más reservas rodantes (0–20% retenidas 90–180 días) y ~US$1,450–2,000/año de registros Visa/MC.
3. **Las reglas de Visa/Mastercard aplican igual (o más duro) al contenido 100% IA.** Precedente: a Civitai su procesador le cortó el servicio en mayo 2025 específicamente por contenido explícito generado por IA.
4. **La verificación de edad de usuarios ya es ley** en ~26 estados de EE.UU. (la Corte Suprema la avaló en junio 2025), Reino Unido (multas de hasta 10% de facturación global) y avanza en la UE.
5. **El CSAM generado por IA es delito federal en EE.UU. y en 45 estados aunque no exista un niño real.** Es riesgo penal existencial y además la razón por la que los bancos desconfían del adulto-IA. La moderación no es un feature: es la licencia para operar.

---

## 1. Pagos: cómo cobrar sin que te cierren

### 1.1 Procesadores high-risk especializados (tarifas verificadas)

| Procesador | Comisión | Notas |
|---|---|---|
| **Segpay** ⭐ | ~4–15% según riesgo | PayFac (no necesitas cuenta merchant propia). **El más documentadamente abierto a sitios de IA adulta** — pero ojo: de sus 7 bancos adquirentes solo 1 en EE.UU. y 2 en Europa aceptan contenido IA. Primera opción. |
| **CCBill** | 10.8–14.5% (plan adulto) | Sin setup ni mensualidad; registro anual $1,000 (adulto); retiene fondos 6 meses al cancelar. |
| **Epoch** | 15% inicial → 13.25% por volumen | IPSP todo incluido; chargeback $12.50; registro Visa/MC $1,450 inicial y anual. |
| **Verotel** | ~13–15.5% + €500/año | Reserva rodante 10% a 6 meses. |
| **Vendo / NetBilling** | A medida | Vendo (Barcelona) especialista UE; NetBilling exige merchant account propia. |

**Estrategia**: aplicar a 2–3 en paralelo desde el día 1 (el onboarding tarda semanas), redundancia multi-adquirente siempre, y **cripto como canal de respaldo** (NOWPayments o similar), nunca como principal. Para LATAM: pasarelas locales tolerantes para PSE/Nequi/OXXO/Pix + cripto; payouts a creadoras (fase 2) típicamente vía Paxum.

### 1.2 Qué te van a exigir en el onboarding (contenido IA)

Los adquirentes que aceptan adulto-IA piden demostrar:
1. Procedencia y derechos del material de entrenamiento de tus modelos.
2. Consentimiento contractual de cualquier imagen/voz real usada.
3. Mecanismo para que una persona solicite remoción de contenido que la represente.
4. **Controles técnicos que impidan generar contenido ilegal** (apariencia de menores, celebridades, no-consentimiento).
5. Lista de herramientas de moderación y equipo humano.

Tu pipeline de generación ES tu "content provider": documenta controles pre-publicación equivalentes a los de un estudio.

### 1.3 Reglas de las redes (aplican vía tu adquirente)

- **Visa VIRP** (ex-GBPP): registro high-risk **US$950/año por adquirente** + Integrity Risk Fee de $0.10/transacción + 10 bps sobre volumen (MCC 5967/7273/7975). Considera **no conformes** los sitios cuyo contenido principal sean representaciones — *incluso ficticias* — de bestialismo o sexo no consentido.
- **Mastercard AN 5196**: (a) verificar edad e identidad de toda persona representada; (b) contrato escrito con cada proveedor de contenido; (c) **revisión de todo el contenido antes de publicar**; (d) proceso de quejas que resuelva en ≤7 días hábiles con apelación; (e) takedown inmediato y reportes mensuales al adquirente. Registro anual ~$500.
- **Traducción para IA pura**: prohibido generar (y prohibido *permitir prompts que pidan*): apariencia de menores, incesto, bestialismo, no-consentimiento, imagen de personas reales sin contrato. Los filtros de prompt y de salida deben bloquearlo y quedar logueados.

---

## 2. Verificación de edad de usuarios (2025–2026: obligatoria)

- **EE.UU.**: *Free Speech Coalition v. Paxton* (Corte Suprema, 27-jun-2025) avaló la ley de Texas; a julio 2026 hay **~26 estados con leyes vigentes** (Texas multa hasta $10,000/día). Opciones: verificación por estado o gate global.
- **Reino Unido**: Online Safety Act exige desde jul-2025 "highly effective age assurance" (estimación facial, ID, operador móvil; NO vale autodeclaración). Multas hasta £18M o 10% de facturación mundial; Ofcom ya multó £1M a un operador adulto.
- **UE**: directrices DSA + blueprint de verificación interoperable (jul-2025); Francia/Alemania/Italia ya exigen AV a sitios porno. **EU AI Act art. 50** (desde 2-ago-2026): obligación de revelar que se interactúa con una IA y etiquetar contenido sintético — multas hasta €15M o 3% global.
- **Proveedores**: Yoti, Incode (bueno para LATAM), VerifyMy, AgeChecker (desde $25/mes + por chequeo). Estimación facial: céntimos; chequeo documental: ~US$1+. Negociar por volumen.
- **Diseño recomendado (y lo que pedirá el adquirente)**: doble gate — declaración+verificación ligera al registrarse, verificación reforzada única (no por sesión) antes de contenido explícito o de pagar.

## 3. California SB 243 — la primera ley de "companion chatbots" (vigente 1-ene-2026)

Aplica si tienes usuarios en California: divulgación clara de que es IA, **protocolos publicados de prevención de suicidio/autolesión con derivación a líneas de crisis**, reporte anual desde 2027, y acción privada con daños mínimos de $1,000 por violación. Cumplirla globalmente es barato y te blinda: clasificador de ideación suicida que corta el roleplay y deriva (988 EE.UU., Línea 106 Colombia), prohibición de que la IA se presente como terapeuta, disclaimers permanentes de ficción, recordatorios de pausa opcionales.

## 4. Contenido IA: leyes específicas

- **TAKE IT DOWN Act** (EE.UU., ley desde may-2025): imágenes íntimas no consentidas, incluidas "digital forgeries" IA = delito; las plataformas deben tener **takedown en 48h** (vigente desde may-2026, lo aplica la FTC). Si permites subir fotos de referencia, eres plataforma cubierta → mejor **no permitir subir fotos de personas** en fase 1.
- **NO FAKES Act**: aún no es ley, pero avanzó en el Senado (jun-2026). Crearía derecho federal sobre voz/imagen. Tu regla "solo clones con contrato" te deja bien parado si pasa. Además ~30 estados ya tienen leyes NCII/deepfake.
- **CSAM sintético**: delito federal (18 U.S.C. §1466A) con condenas recientes aunque no exista menor real; 45 estados lo criminalizan explícitamente. Si detectas CSAM con nexo EE.UU., **reporte obligatorio a NCMEC** (§2258A).
- **18 U.S.C. §2257** (fase 2, creadoras reales): por cada performer — ID oficial con foto, nombre legal, alias, fechas, copia de la obra, URL; todo indexado, con Custodian of Records y declaración en cada página. Penas de hasta 5–10 años. El contenido 100% IA queda fuera del literal, pero Mastercard te exige récords equivalentes igual. Montar el sistema antes de lanzar el marketplace.

## 5. El stack de moderación (condición para pagos y ley)

1. **Filtro de prompts** (entrada): clasificador + blocklists — menores/edad ambigua ("teen", "colegiala"…), incesto, no-consentimiento, bestialismo, celebridades/personas reales.
2. **Clasificación de TODA salida visual antes de mostrarla**: detección CSAM (Hive AI con tecnología Thorn/Safer + hash-matching NCMEC/IWF; alternativas PhotoDNA, Rekognition) + **estimación de edad aparente con umbral conservador (rechazar apariencia <21 para NSFW)**.
3. Clasificador de texto para chat (CSE, crisis suicida).
4. Revisión humana de casos borderline y del contenido premium pre-publicación (AN 5196).
5. Logs de todo → reportes mensuales al adquirente.

Presupuestarlo como costo variable core (~$0.01+/ítem clasificado), no como opcional.

## 6. Colombia y estructura societaria

- **Operar desde Colombia es legal** (libertad de empresa; la industria webcam local factura >US$1,000M/año con ~15,000 estudios registrados como empresas normales). Obligaciones: Ley 679/2001 y 1336/2009 (deberes anti-explotación infantil para operadores web), Ley 1581/2012 (habeas data — y los datos de verificación de edad/biométricos son sensibles).
- **Pero los procesadores adultos casi nunca onboardean entidades colombianas.** Estructura estándar del sector (la usan Aylo, Stripchat, xHamster): **entidad merchant en EE.UU. (LLC Delaware/Wyoming) o Chipre + SAS colombiana como subsidiaria de desarrollo** que factura servicios a la matriz (precios de transferencia). Advertencias: banca chipriota es hostil al adulto (se usa EMI/banca en otros países); entidad US te somete de lleno a 2257/TAKE IT DOWN/leyes estatales de AV; y la Ley 2277 (Presencia Económica Significativa) grava 3% de ingresos brutos o retención del 10% si vendes a usuarios colombianos desde una entidad extranjera. **Contratar asesoría fiscal colombiana + internacional ANTES de constituir. La DIAN ya anunció fiscalización de plataformas de contenido adulto.**

## 7. Bienestar del usuario (ética que además es defensa legal)

El precedente Character.AI (demandas por suicidios, acuerdos revelados en ene-2026, prohibición de menores desde nov-2025) fijó el estándar de facto, y California lo hizo ley:

- 18+ verificado sin excepciones (el modelo web-only 18+ ya elimina el peor escenario).
- Divulgación permanente de que es IA (también EU AI Act art. 50 desde ago-2026).
- Detección de crisis → cortar roleplay → derivar a líneas de ayuda; protocolos publicados.
- La IA nunca se presenta como terapeuta ni desalienta buscar ayuda humana.
- Sin dark patterns emocionales ("si no pagas, me pongo triste" = veto de diseño).
- **Privacidad extrema**: el hackeo de Muah.ai (1.9M usuarios expuestos, extorsión con sus chats sexuales) demuestra que los logs de chat íntimo son material de extorsión. Cifrado, retención mínima, seudonimización, borrado real a solicitud.

Documentar todo esto **mejora el onboarding de pagos**: los adquirentes ya preguntan por salvaguardas de bienestar.

---

## 8. Checklist de cumplimiento pre-lanzamiento

- [ ] Entidad merchant US/Chipre constituida + SAS colombiana de desarrollo (con asesoría fiscal)
- [ ] Aplicaciones en paralelo a Segpay + CCBill/Epoch/Verotel; cripto de respaldo
- [ ] Verificación de edad integrada (doble gate) con proveedor contratado
- [ ] Filtro de prompts + clasificación de salida (CSAM, edad aparente <21, categorías Visa/MC) en producción y logueado
- [ ] Takedown 48h + formulario de quejas con SLA 7 días
- [ ] Disclosure de IA permanente + protocolo de crisis publicado (SB 243 / AI Act)
- [ ] Términos de servicio, política de privacidad, política de contenido redactados por abogado del sector adulto
- [ ] No se permite subir fotos/voces de personas reales (fase 1)
- [ ] Seguridad: cifrado en reposo, retención mínima, plan de respuesta a incidentes
- [ ] Registro Visa/MC vía adquirente (~$1,450–2,000/año presupuestados)

---

*Siguiente: [04-modelo-de-negocio.md](./04-modelo-de-negocio.md) — mercado, competencia y números.*
