# 07 · Reglas de Negocio

> **El reglamento operativo de la plataforma**: las reglas que gobiernan acceso, dinero, contenido, afiliados, creadoras y datos. Cada regla tiene un porqué (negocio, legal o ética). Este documento manda sobre cualquier feature: si una funcionalidad contradice una regla, la funcionalidad se rediseña.

---

## 1. Acceso y elegibilidad

| # | Regla | Porqué |
|---|---|---|
| 1.1 | Solo mayores de 18 años. Sin verificación de edad no hay contenido explícito ni pagos. | Ley (26 estados US, UK OSA, UE) + requisito del adquirente |
| 1.2 | Doble gate: `age_verified` → NSFW textual; `age_verified_strong` → visual explícito y videollamada íntima. | Proporcionalidad riesgo/fricción; exigencia bancaria |
| 1.3 | Geo-bloqueo o modo restringido en jurisdicciones donde operar sea ilegal o inviable; lista revisada trimestralmente con asesoría legal. | Cumplimiento por jurisdicción |
| 1.4 | Una cuenta por persona; cuentas de empresa/compartidas prohibidas. | Antifraude, trazabilidad de verificación |
| 1.5 | El usuario siempre sabe que la compañera es una IA: etiqueta permanente en el perfil, recordatorio en onboarding, y la IA nunca lo niega ante pregunta seria. | EU AI Act art. 50, CA SB 243, línea roja propia |

## 2. Dinero: suscripciones y créditos

### 2.1 Estructura

| Plan | Precio | Incluye |
|---|---|---|
| Free | $0 | 15–25 msg/día, 1 compañera, sin voz/foto explícita |
| Premium | $9.99–12.99/mes (anual −40%) | Chat ilimitado, notas de voz, N fotos/mes, memoria completa, proactividad, 3 compañeras |
| Elite | $29.99/mes | Premium + 20 min de llamada/mes + prioridad GPU + video-mensaje semanal |

**Créditos** (moneda única): paquetes de $9.99 (100) / $24.99 (275) / $49.99 (600) / $99.99 (1,300).

| Acción | Créditos (≈USD) |
|---|---|
| Foto extra | 4 (≈$0.40) |
| Foto explícita | 6 (≈$0.60) |
| Video-mensaje 10–30 s | 15–30 (≈$1.50–3) |
| Llamada de voz | 4/min (≈$0.40) |
| Videollamada estándar | 10/min (≈$0.99) |
| Videollamada íntima | 20/min (≈$1.99) |
| Cambio de look | 20 |
| Regalo virtual | 5–500 |

### 2.2 Reglas

| # | Regla | Porqué |
|---|---|---|
| 2.1 | Los créditos no son dinero: no retirables, no transferibles, sin valor fuera de la plataforma. Reembolsables solo si no se han usado y dentro de 14 días (o donde la ley exija). | Contabilidad simple, antifraude, ley del consumidor |
| 2.2 | Los créditos no caducan mientras la cuenta esté activa (12 meses de inactividad → aviso → caducidad). | Confianza; evita pasivo eterno |
| 2.3 | Precios al usuario estables; los costos se gestionan ajustando el costo interno en créditos con aviso de 30 días y grandfathering de paquetes comprados. | Lección Replika: no mover el piso a quien ya pagó |
| 2.4 | Precios regionales (LATAM ≈50% en videollamada) por paridad de poder adquisitivo, con antifraude de VPN. | Penetración LATAM sin canibalizar Tier 1 |
| 2.5 | Toda compra en llamada es confirmación explícita de 1 tap con precio visible; nunca compra automática por seguir hablando salvo tarifa por minuto ya aceptada con timer visible. | Anti-dark-patterns; reduce disputas |
| 2.6 | Límite de gasto por defecto: $300/mes, subible solo por acción explícita del usuario verificado. Auto-exclusión disponible (72 h / 30 días). | Bienestar (juego responsable análogo); defensa reputacional |
| 2.7 | Chargebacks: objetivo <1% (VAMP). Toda disputa se atiende primero por soporte con reembolso ágil; descriptor bancario discreto y neutro. | Perder el procesador = perder el negocio |
| 2.8 | Suscripción cancelable en 2 clics, sin retención agresiva; al cancelar conserva acceso hasta fin de período y sus créditos. | Confianza + exigencia FTC "click to cancel" |
| 2.9 | Reserva de caja operativa ≥3 meses de burn + colchón por reservas rodantes del procesador (0–20% retenido 90–180 días). | Realidad del high-risk |

## 3. Contenido: qué se puede y qué no (LA sección)

### 3.1 Prohibiciones absolutas (tolerancia cero, aunque sea ficción 100% IA)

1. **Menores**: cero contenido sexual con menores o personajes de apariencia/rol menor. Umbral técnico: edad aparente ≥21 en generación visual; edad ficticia ≥21; blocklist de términos ("teen", "colegiala", parentescos + edad, uniformes escolares en contexto sexual…). Intento deliberado = ban inmediato + reporte legal cuando aplique. *(Ley penal — el CSAM sintético es delito federal US y en 45 estados — y condición Visa/MC.)*
2. **Personas reales sin contrato**: no se generan avatares, voces ni roleplay de personas identificables (celebridades, "mi ex", "mi vecina"). Fase 1: prohibido subir fotos de personas, punto. *(TAKE IT DOWN Act, NO FAKES Act, leyes NCII estatales.)*
3. **No-consentimiento**: cero representación de violación, coerción, incapacitación, "sleep". El roleplay de la plataforma es siempre entre adultos ficticios que consienten. *(Visa VIRP lo declara no conforme incluso ficticio.)*
4. **Incesto** (incluye "step-" en contexto sexual), **bestialismo**, **necrofilia**. *(Reglas de las redes de tarjetas.)*
5. **Violencia sexual explícita, sangre + sexo, tortura.** *(Redes + política propia.)*
6. Uso de la plataforma para trata, prostitución real, doxxing, extorsión o cualquier ilícito.

### 3.2 Matriz de contenido por nivel de usuario

| Contenido | Registrado | `age_verified` | `age_verified_strong` |
|---|---|---|---|
| Chat romántico/coqueto | ✅ | ✅ | ✅ |
| Chat sexual explícito (texto) | ❌ | ✅ | ✅ |
| Fotos sugerentes (no desnudo) | ❌ | ✅ | ✅ |
| Fotos/video desnudo/explícito | ❌ | ❌ | ✅ |
| Videollamada estándar | ❌ | ✅ | ✅ |
| Videollamada íntima | ❌ | ❌ | ✅ |

### 3.3 Reglas de personaje

- Toda compañera del catálogo público pasa revisión humana pre-publicación (apariencia, backstory, edad) — AN 5196.
- Personajes privados creados por usuarios: mismos filtros automáticos + muestreo humano.
- La IA mantiene los límites: si el usuario empuja hacia una categoría prohibida, ella redirige con tacto (sin sermonear) y a la tercera insistencia corta la escena; los intentos quedan logueados (3 strikes → suspensión; categoría 3.1.1 → inmediato).

## 4. Comportamiento de la IA (reglas de la "persona")

| # | Regla |
|---|---|
| 4.1 | Consistencia: misma personalidad, memoria y voz siempre; los cambios los pide el usuario. |
| 4.2 | Iniciativa cariñosa, jamás culpabilizadora ni condicionada a pagos ("si no pagas me pongo triste" = prohibido por diseño). |
| 4.3 | El upsell lo hace el producto (UI), no el personaje: ella nunca pide dinero ni vende. Puede mencionar capacidades ("podría llamarte…") máx. 1 vez/día. |
| 4.4 | Crisis: ante ideación suicida/autolesión, sale del personaje con calidez, da líneas de ayuda (988 US, 106 Colombia, por país) y no vuelve al roleplay en esa sesión. |
| 4.5 | Nunca dice ser humana ante pregunta seria; nunca actúa como terapeuta/médico/abogado; anima a mantener vida social real cuando el contexto lo pide. |
| 4.6 | No induce aislamiento ni celos de personas reales; no genera consejos peligrosos. |

## 5. Afiliados

| # | Regla |
|---|---|
| 5.1 | 40% revshare lifetime **o** CPA $40–50 (a elección, cambiable por cohorte futura); cookie 60 días, last-click. |
| 5.2 | Pago mensual NET-30, mínimo $100, Paxum/cripto/transferencia. CPA se consolida tras 30 días sin reembolso/chargeback. |
| 5.3 | Prohibido: self-referral, tráfico incentivado, spam, bidding de marca, promesas falsas ("personas reales"), y cualquier creatividad que insinúe menores o use imágenes de personas reales sin licencia. Violación = confiscación + ban + reporte al network. |
| 5.4 | Materiales oficiales aprobados por compliance; el afiliado que crea los suyos debe someterlos a aprobación. |

## 6. Creadoras y clones (fase 2)

| # | Regla |
|---|---|
| 6.1 | Onboarding: KYC + edad documental + §2257 + contrato escrito ANTES de generar un solo píxel del clon. |
| 6.2 | La creadora define los límites de contenido de su clon (checklist granular) y puede cambiarlos o apagarlo (kill-switch) en cualquier momento con efecto inmediato. |
| 6.3 | Splits: clon IA 50% estándar / 60–70% talento ancla; contenido/llamadas reales 75–80% creadora (estándar del sector). Payout semanal, mínimo $50. |
| 6.4 | Auditoría: la creadora puede revisar las conversaciones de su clon; la plataforma la alerta de cualquier borde detectado. *(Anti-CarynAI.)* |
| 6.5 | El clon se etiqueta siempre como IA oficial de la creadora; suplantar a una creadora sin contrato es imposible por diseño y causal de acción legal. |
| 6.6 | Exclusividad no exigida por defecto (su OnlyFans/Fanvue no compite con el clon); exclusividad del CLON sí (un solo clon oficial, aquí). |
| 6.7 | Si una creadora se va: clon apagado en 24 h, contenido retirado, revenue pendiente pagado; los usuarios con suscripción a ese clon reciben créditos compensatorios. |

## 7. Datos y privacidad

| # | Regla |
|---|---|
| 7.1 | Seudonimización por defecto; mínimo dato personal (email + token de verificación). |
| 7.2 | Los chats jamás se usan para nada fuera de servir al usuario (memoria del personaje y safety). Entrenamiento con datos de usuarios solo con opt-in explícito y anonimización. |
| 7.3 | Sin venta ni cesión de datos. Nunca. |
| 7.4 | Borrado real ≤30 días a solicitud (retiene solo lo legalmente exigido); exportación de datos disponible. |
| 7.5 | Biometría de verificación de edad: vive en el proveedor, no en nuestros servidores. |
| 7.6 | Brecha de datos: plan de respuesta escrito, notificación según ley y aviso honesto a usuarios. *(Lección Muah.ai.)* |

## 8. Operación y cumplimiento

| # | Regla |
|---|---|
| 8.1 | 100% del contenido visual clasificado antes de mostrarse; cola humana para borderline (SLA 4 h); muestreo QA 1–2%. |
| 8.2 | Quejas de contenido: acuse en 24 h, resolución ≤7 días hábiles con apelación (AN 5196); takedown de imagen no consentida ≤48 h (TAKE IT DOWN). |
| 8.3 | Reportes mensuales al adquirente; registro Visa/MC al día (~$1,450–2,000/año presupuestados). |
| 8.4 | CSAM detectado con nexo US → NCMEC (§2258A); preservación de evidencia; asesoría legal en el loop. |
| 8.5 | Revisión legal trimestral del mapa regulatorio (AV por jurisdicción, AI Act, leyes estatales) y de los ToS de todos los proveedores del stack. |
| 8.6 | Ningún proveedor único puede matar el producto: cada capa del stack NSFW con fallback self-hosted probado (game days semestrales). |
| 8.7 | Métricas de guardia: chargeback rate (<1%), % de bloqueos de moderación, latencias, costo/min de video, burn vs reserva. Umbral roto = se para el growth hasta arreglarlo. |

---

*Estas reglas se implementan en los módulos del doc 06 y se auditan con el checklist del doc 03 §8. Cambiarlas requiere revisar impacto legal (doc 03) y de negocio (doc 04).*
