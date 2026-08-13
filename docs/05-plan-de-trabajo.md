# 05 · Plan de Trabajo

> El roadmap ejecutable: fases, alcance, equipo, presupuesto y criterios de avance (go/no-go). Diseñado para bootstrap: cada fase se paga con la anterior o con capital ángel pequeño, y ninguna fase construye la siguiente sin validar la actual.

---

## Principios de ejecución

1. **Compliance-first**: pagos y moderación se construyen ANTES que las features. Un producto perfecto sin procesador de pagos es un hobby.
2. **Monetizar desde el mes 1 de lanzamiento**: paywall duro. El free es embudo, no producto.
3. **La escalera de realismo es la hoja de ruta**: texto → voz → fotos → video-clips → videollamada en vivo. Cada peldaño monetiza más y usa lo construido en el anterior.
4. **Todo lo NSFW en infraestructura propia o proveedores tolerantes verificados por escrito** (doc 02). Nada del core sobre APIs que lo prohíben.
5. **Español-nativo primero** (hueco de mercado), inglés desde el MVP (mercado grande), Brasil/portugués en fase de escala.

---

## Fase 0 — Fundación (semanas 1–6) · presupuesto ~US$8–15k + honorarios legales

**Objetivo: poder cobrar legalmente y validar demanda antes de construir en serio.**

| # | Tarea | Detalle |
|---|---|---|
| 0.1 | Asesoría legal/fiscal | Abogado del sector adulto + fiscalista colombiano/internacional. Decidir estructura (LLC US o Chipre + SAS colombiana de desarrollo) |
| 0.2 | Constituir entidades | Merchant entity + SAS; banca/EMI tolerante al sector |
| 0.3 | Aplicar a procesadores | Segpay + CCBill/Epoch en paralelo (semanas de onboarding); preparar el dossier de moderación/controles que exigen (doc 03 §1.2) |
| 0.4 | Contratar verificación de edad | Cotizar Yoti/Incode/VerifyMy/AgeChecker; diseñar doble gate |
| 0.5 | Marca y dominio | Nombre definitivo (doc 01 §7), dominios, marca madre no-explícita |
| 0.6 | Landing + lista de espera | Cuestionario de diseño de compañera como teaser interactivo; captar emails; medir CTR de ads adultas baratas en LATAM ($200–500 de prueba) |
| 0.7 | Prototipo técnico privado | Chat con personalidad + memoria básica sobre OpenRouter (DeepSeek/Grok) + generación de imagen con LoRA de prueba en RunPod. Uso interno/beta cerrada, sin cobrar |
| 0.8 | Redactar políticas | ToS, privacidad, política de contenido, protocolo de crisis (SB 243/AI Act), takedown 48h |

**Go/No-Go**: procesador pre-aprobado o aprobado + >2,000 emails en lista de espera con CAC de prueba <$1 en LATAM + prototipo que "engancha" en pruebas con 20–50 usuarios beta.

---

## Fase 1 — MVP monetizable: chat + voz + fotos (meses 2–4) · presupuesto ~US$25–45k

**Objetivo: producto en producción cobrando. Sin video todavía.**

Alcance del producto:
- Onboarding con **cuestionario de diseño** (doc 01 §3.1) → genera personaje: prompt de personalidad + foto base + LoRA + voz elegida.
- **Chat** con memoria (resúmenes progresivos + pgvector), mensajes proactivos v1.
- **Notas de voz** de ella (Chatterbox/Qwen3-TTS self-hosted, streaming).
- **Fotos bajo demanda** con consistencia de personaje (SDXL + LoRA, cola async).
- **Monetización completa**: suscripción $9.99–12.99 + paquetes de créditos; verificación de edad; checkout con procesador high-risk.
- **Stack de moderación en producción** (filtro de prompts, clasificación de salidas, edad aparente <21, detección de crisis) — condición del adquirente.
- Web/PWA responsive; ES + EN.

Infraestructura: OpenRouter para LLM (migración a vLLM self-host cuando el volumen lo pida), 1–2 GPUs (4090/L40S) para TTS+imagen, LiveKit instalado (para fase 2), Postgres+pgvector, colas.

Lanzamiento (mes 4): programa de afiliados (CrakRevenue) activo el día 1 + SEO español/inglés + Telegram bot embudo + comunidades. $1–3k/mes de ads adultas LATAM al validar funnel.

**KPIs / Go-No-Go (mes 6)**: 15–20k registrados, conversión ≥3%, ARPPU ≥$15, churn mensual <25%, MRR ≥$15–20k, chargebacks <1% (crítico para el adquirente).

---

## Fase 2 — Voz en vivo + video-clips (meses 4–8) · presupuesto ~US$30–60k (parcialmente autofinanciado)

**Objetivo: subir el realismo y el ARPPU con lo que más margen deja antes del video en vivo.**

- **Llamadas de voz en tiempo real** (LiveKit Agents + Deepgram/Whisper + TTS streaming; objetivo <1s voz-a-voz) cobradas por minuto (~$0.30–0.60/min en créditos).
- **Video-mensajes** (clips 5–30s con Wan 2.2 self-hosted desde la foto del personaje): "ella te mandó un video" — $1–3/clip.
- Memoria avanzada (mem0/Letta self-hosted), arcos de relación, aniversarios, modos de personalidad.
- **Fine-tune propio**: LoRA de roleplay en español LATAM (dataset propio) + inicio del dataset de voz emocional con actrices contratadas (contratos de cesión).
- Métodos de pago LATAM (PSE/Nequi/OXXO/Pix vía pasarela tolerante) + cripto.
- Migrar chat a vLLM self-hosted si volumen >50–100M tokens/mes.

**KPIs (mes 8)**: MRR $50–80k, ≥30% de pagadores usan voz, margen bruto ≥55%, CAC payback <2 meses.

---

## Fase 3 — La videollamada en vivo (meses 8–14) · presupuesto ~US$60–120k (autofinanciado + ángeles si se acelera)

**Objetivo: el diferenciador. "Webcam con tu compañera IA", cobrado por minuto.**

- Pipeline en vivo (doc 02 §4.2): loops pre-renderizados por personaje/escena (Wan 2.2 offline) + **MuseTalk/Ditto en vivo** + LiveKit. Partir del proyecto LiveTalking y optimizar latencia a ~1s.
- Beta cerrada con power users (lista por gasto) → GA con tarifas $0.99/min estándar y $1.99/min modo íntimo (LATAM ~50%).
- Escenas/vestuarios; escalada íntima solo con verificación reforzada + saldo.
- GPU pool con autoscaling (RunPod/Vast por segundo), multiplexado 2–4 streams/GPU, modo degradado (foto animada + voz) sin GPU disponible.
- Optimización de costos continua: objetivo <$0.10/min total; margen >85% en llamadas.

**KPIs (mes 14)**: MRR $150–250k; ≥15% de pagadores prueban videollamada y ≥40% de esos repiten; margen bruto blended ≥60%; NPS/retención estable tras el lanzamiento (el video no debe canibalizar la relación por chat, que es la retención).

---

## Fase 4 — Marketplace: creadoras reales + clones licenciados (meses 14–24)

**Objetivo: de "app de IA" a plataforma. La IA es la puerta; el ecosistema es el negocio.**

- **Clones IA licenciados** de creadoras reales: contrato con límites de contenido definidos por ella, kill-switch, auditoría, §2257 completo, licencia de imagen/voz. Split 50–70% según tier. Reclutamiento inicial: industria webcam colombiana (agencias/estudios) + creadoras hispanas en Fanvue/OF.
- **Cam real / contenido de creadoras** (opcional según tracción): eleva requisitos Mastercard (revisión pre-publicación, KYC performer) — el sistema ya existe desde fase 1.
- El clon atiende 24/7; la llamada con la creadora real es el tier premium (precio cam: $2–9/min, split cam).
- Prensa y fichajes ancla como motor de adquisición (playbook OhChat).

**KPIs (mes 24)**: 30–50 creadoras activas, ≥20% del GMV del marketplace, MRR total ≥$400–700k. Aquí el negocio ya es financiable por VCs de creator economy si se quiere acelerar.

---

## Equipo

| Rol | Cuándo | Nota |
|---|---|---|
| Fundador/CEO (tú) | Día 1 | Producto, pagos/legal, growth |
| Full-stack senior | Fase 0–1 | Web, billing, backend |
| ML/infra engineer | Fase 1 | vLLM, difusión, LoRAs, GPU ops; en fase 3 se suma un segundo (video en vivo) |
| Diseñador/a (contrato) | Fase 1 | UX del cuestionario y la relación |
| Moderación + soporte | Lanzamiento | Part-time → equipo; obligatorio por AN 5196 |
| Growth/afiliados | Fase 1–2 | Puede ser el fundador al inicio; luego manager de afiliados |
| Legal (retainer) | Fase 0 | Sector adulto + fiscal internacional |

Total nómina lean hasta fase 2: 3–5 personas full-time equivalentes. Colombia da ventaja de costos en talento técnico y de moderación.

## Presupuesto resumido (bootstrap)

| Fase | Rango | Principales rubros |
|---|---|---|
| 0 | $8–15k | Legal/constitución, landing, pruebas de demanda |
| 1 | $25–45k | Nómina 2–3, GPUs, verificación edad, moderación, lanzamiento |
| 2 | $30–60k | Nómina, datasets propios (voz/roleplay ES), pagos LATAM |
| 3 | $60–120k | 2º ML eng, GPU pool video, optimización | 
| **Total a videollamada en vivo** | **~$125–240k** | Financiable con ahorros + ángeles + revenue desde el mes 4–6 |

## Riesgos de ejecución (los 5 que más duelen)

1. **Onboarding de pagos se atasca** → empezar fase 0 HOY con 2–3 procesadores en paralelo; tener cripto y LATAM local como puente.
2. **La latencia de la videollamada decepciona** → el escalón de video-clips (fase 2) monetiza mientras tanto; beta cerrada antes de GA; modo degradado siempre.
3. **Calidad del español mediocre** → dataset propio temprano (fase 2), evaluación con hablantes nativos por país (acentos importan).
4. **Costo GPU se come el margen** → medir costo/min desde el día 1, multiplexar, resolución adaptativa, precios en créditos ajustables sin cambiar precios de lista.
5. **Fundador único** → documentar todo, automatizar moderación con revisión humana, y buscar un cofundador técnico o ML-lead fuerte temprano: este proyecto es demasiado grande para una sola persona.

## Los primeros 30 días (checklist concreto)

- [ ] Semana 1: contactar 2 abogados (adulto/fiscal) y 3 procesadores (Segpay, CCBill, Epoch) — pedir requisitos de onboarding para adulto-IA
- [ ] Semana 1: reservar marca/dominios; abrir cuentas RunPod/Vast/OpenRouter
- [ ] Semana 2: prototipo de chat con personalidad (OpenRouter + character card + memoria simple) — probarlo con 10 personas del público objetivo
- [ ] Semana 2: probar generación de personaje consistente (SDXL + LoRA en RunPod) y TTS español (Chatterbox/Qwen3-TTS demo)
- [ ] Semana 3: landing con cuestionario-teaser + lista de espera; $200–500 en ExoClick/TrafficJunky LATAM para medir interés real
- [ ] Semana 3: decidir estructura societaria con los abogados; iniciar constitución
- [ ] Semana 4: dossier de moderación/compliance (doc 03) listo para los procesadores; elegir proveedor de verificación de edad
- [ ] Semana 4: decisión go/no-go de fase 1 con datos de la landing y el prototipo

---

## Nota final sobre las líneas rojas

Todo este plan asume el cumplimiento estricto del doc 01 §5 y doc 03: solo adultos verificados, cero apariencia de menores, cero personas reales sin contrato, categorías prohibidas por Visa/MC bloqueadas técnicamente, transparencia de IA y salvaguardas de crisis. No son frenos al negocio: **son la razón por la que un banco te procesa pagos, un regulador no te cierra y una creadora firma contigo**. Los competidores que las ignoren (Muah y compañía) son precisamente los que dejan el mercado servido para quien las cumpla.
