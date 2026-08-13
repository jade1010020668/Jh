# 04 · Modelo de Negocio

> Mercado, competencia, precios, economía unitaria y adquisición. Cifras investigadas y verificadas contra fuentes primarias en julio 2026 (las estimaciones no auditadas se marcan como tales).

---

## 0. Resumen ejecutivo

- **El mercado es real y crece rápido.** Solo las apps móviles de compañía IA (donde el NSFW está prohibido) van camino de $120M+ en 2025 (+64% interanual, Appfigures — verificado). El dinero grande del segmento adulto está en la **web**: Candy.ai declara ~$25M ARR bootstrapped (cifra del CEO, no auditada; estimaciones de terceros la sitúan entre $50–120M en 2026), Fanvue pasó de $40M a **~$100M ARR en 2025** (verificado; $200M run-rate en may-2026) con ~15% de ingresos de creadoras IA, y Chai reporta ~$80M ARR.
- **El hueco identificado en la idea existe de verdad, pero la ventana se cierra.** La videollamada NSFW fotorrealista en tiempo real estilo webcam casi no existe: solo Kindroid la roza (beta, sin posicionamiento adulto/cam). Pero Byborg (dueño de LiveJasmin) ya compró CutiesAI en 2025 para entrar, y xAI normalizó los companions NSFW con "Ani". **Ser primero en "webcam IA" en español es una ventana de quizá 12–18 meses.**
- **Español/LATAM es el segundo hueco verificable**: Brasil es #3 y México #7 mundial en descargas de companions; los competidores en español son pequeños y sin voz/video de calidad. Los líderes atienden el idioma por traducción.
- **La economía funciona**: margen bruto alcanzable 60–75% después de pagar el 10–15% de procesamiento high-risk. La videollamada IA a $0.99–1.99/min contra un costo de $0.03–0.09/min es el mejor margen del producto.
- **Financiación**: el VC clásico está bloqueado por "vice clauses". El sector se bootstrapea (Candy.ai, Muah) o levanta en lo adyacente (Fanvue $22M). Plan: **bootstrap + ángeles**, el negocio es rentable temprano si el funnel funciona.
- **Es un mercado winner-takes-most**: el top 10% de apps captura el 89% del revenue. Se gana por diferenciación (video en vivo + español + memoria), no por clonar a Candy.ai.

---

## 1. El mercado

| Segmento | Dato (verificado salvo indicación) |
|---|---|
| Apps móviles companion (solo app stores, SFW) | $82M en H1-2025, proyección $120M+ en 2025 (+64% YoY); 60M descargas H1-2025 (+88%); revenue por descarga $0.52→$1.18 |
| Mercado "AI companion" amplio (incluye enterprise) | ~$37B en 2025, CAGR ~31% (Grand View/Precedence — definición amplia, usar con cautela) |
| Web NSFW (no aparece en app stores) | Candy.ai ~$25M ARR declarado (no auditado) con ~38M visitas/mes; Fanvue ~$100M ARR 2025 (verificado), 15% de ingresos por creadoras IA; Chai ~$80M ARR |
| Cam tradicional (referencia) | Industria de miles de millones; solo la webcam colombiana factura >$1,000M/año |
| LATAM | Brasil 10% y México 7% de las descargas mundiales de companions; CAGR regional ~21%; oferta en español precaria |
| Demografía típica | ~82% hombres, 25–34 años |

## 2. Competencia (julio 2026)

### Líderes NSFW web (chat + imágenes, sin video en vivo)
- **Candy.ai** — el líder. $5.99–13.99/mes + tokens ($9.99/100); imagen ≈ 4 tokens; "Live Action" (clips animados 120s, NO llamada en vivo) ≈ $1.50–2/min; usuario activo real gasta $25–60/mes. Voz con latencia mejorada en 2026.
- **DreamGF, Kupid, FantasyGF, Nectar, GirlfriendGPT, HeraHaven, Muah** — variaciones del mismo playbook ($9.99–49.99/mes + créditos); ninguno con videollamada en vivo.

### Los que ya tocan el video en vivo (la amenaza directa)
- **Kindroid** — único con videollamada en vivo real (lip-sync + gestos en tiempo real, beta), cobrada por minuto en créditos. Generalista, no adult-first, no cam-style, no español.
- **Grok "Ani" (xAI)** — companion 3D animado NSFW por $30/mes. Estilo anime, no fotorrealista, pero normalizó la categoría en mainstream.
- **CutiesAI (Byborg/LiveJasmin)** — la compra de 2025 que anuncia la entrada del gigante cam. Aún chat/imagen/video generado, con capital y tráfico enormes detrás.

### Marketplace creadoras + IA (fase 2 del proyecto)
- **Fanvue** — $100M ARR (verificado), split 80/20 pro-creador, partnership con ElevenLabs para voz. Creadoras IA sintéticas, no clones.
- **OhChat** — clones IA oficiales de ~250 creadoras/celebridades (Carmen Electra…), 400k usuarios, creadora retiene 80%. Validación directa de la fase 2.
- **OnlyFans prohíbe personas 100% IA** y Fansly vetó el fotorrealismo IA (jun-2025) → el nicho queda abierto.

### Lecciones de los muertos y heridos
| Caso | Lección para el proyecto |
|---|---|
| Replika "lobotomy" (2023) | Definir política NSFW desde el día 1 y NO cambiarla retroactivamente: destruye la confianza y el negocio |
| Muah.ai breach (1.9M usuarios, extorsión) | Seguridad de datos nivel banca; los chats íntimos son material de extorsión. Y filtros CSAM innegociables |
| CarynAI (cerró en <8 meses) | Clones de creadoras: contrato con límites de contenido + kill-switch para la creadora + continuidad operativa |
| Soulmate AI (cierre con 1 semana de aviso) | La dependencia emocional crea deber de cuidado; plan de continuidad/exportación |
| Character.AI (demandas, menores) | Verificación de edad seria y protocolos de crisis: primera pregunta de reguladores, bancos e inversionistas |

## 3. Monetización

### 3.1 Estructura de precios propuesta (ancla en benchmarks verificados)

| Ítem | Precio | Referencia de mercado |
|---|---|---|
| Free | 15–25 mensajes/día, 1 personaje, sin voz/foto | Embudo; límite duro (cada pagador subsidia 20–30 free) |
| Suscripción Premium | **$9.99–12.99/mes** (descuento anual) | Candy $5.99–13.99; el precio de lista es ancla, no el ARPPU real |
| Créditos | Paquetes $9.99 / $24.99 / $49.99 / $99.99 | Patrón Candy/DreamGF |
| Foto bajo demanda | ~$0.30–0.40 en créditos | Candy: imagen ≈ 4 tokens ≈ $0.40 |
| Video-mensaje (clip 10–30s) | $1–3 en créditos | Candy Live Action $1.50–2/min |
| **Videollamada estándar** | **$0.99/min** (LATAM ~$0.49) | Bajo el privado cam humano ($2–9/min): argumento de venta |
| **Videollamada íntima** | **$1.99/min** (LATAM ~$0.99) | CarynAI cobró $1/min en 2023; Kindroid cobra por minuto |
| Regalos/propinas | $1–50 | Mecánica cam; margen ~100% |

Patrón validado por el sector: **suscripción = acceso y hábito (70–85% del revenue); créditos = todo lo caro de servir**. El usuario activo real debe poder gastar $25–60/mes sin fricción.

### 3.2 Economía unitaria (por usuario pagador/mes, ARPPU objetivo $25)

| Concepto | Costo |
|---|---|
| Chat LLM (~750k tokens, self-host/OpenRouter) | $0.75–1.50 |
| Voz (30 min) | $0.45–2.40 |
| Imágenes (30) | $0.10–0.30 |
| Videollamada (15 min × $0.15 costo) | $2.25 |
| Procesamiento high-risk (10–12%) | $2.50–3.00 |
| Infra, CDN, moderación | ~$1.00 |
| **Total costo de servir** | **$7–10.5** |
| **Margen bruto** | **~58–72%** |

Supuestos prudentes de funnel: conversión free→paid **3–8%** (mediana freemium ~2.1%, hard paywall ~10.7%; Candy-like con paywall duro apunta arriba), churn mensual 15–25% (las apps IA tienen churn ~36% peor que la media — la memoria/relación es el antídoto), payback de CAC en 1–2 meses.

### 3.3 Escenarios de ingresos (ilustrativos, no promesas)

| Escenario | Usuarios registrados | Pagadores (5%) | ARPPU | MRR | Margen bruto |
|---|---|---|---|---|---|
| Validación (mes 4–6) | 20,000 | 1,000 | $20 | $20,000 | ~$12,000 |
| Tracción (mes 9–12) | 100,000 | 5,000 | $25 | $125,000 | ~$80,000 |
| Escala (año 2) | 500,000 | 25,000 | $28 | $700,000 | ~$450,000 |

Sensibilidad: la conversión (3% vs 8%) mueve más que cualquier otra variable; después, el mix de videollamada (minutos/usuario) porque es el ítem de mayor margen absoluto.

## 4. Adquisición (Google/Meta/TikTok prohíben ads de adulto)

1. **Afiliados — el canal #1 del sector.** 47% del tráfico desktop de Candy.ai es afiliado. Estándar vía CrakRevenue: **40–50% revshare lifetime o $40–50 por venta**. Lanzar el programa el día 1 con kits listos.
2. **SEO** — el playbook documentado de Candy.ai: long-tail "AI girlfriend + X", reviews, directorios de herramientas IA, YouTubers. **El español está casi virgen** ("novia virtual IA", "novia IA en español"…).
3. **Redes de ads adultas** — TrafficJunky (CPM $2–5 Tier 1, céntimos en LATAM), ExoClick, JuicyAds. Encender solo cuando el funnel convierta. **CAC LATAM estimado $5–15 vs $40–60 Tier 1.**
4. **Reddit/Telegram/Discord** — comunidades del nicho; un **bot de Telegram "lite"** (chat SFW-picante) como embudo de captación hacia la web es táctica probada en el nicho y barata para LATAM. (No replicar el bot-farming de Muah: baneos.)
5. **Prensa/influencers** — la fase 2 con creadoras reales genera prensa por sí sola (playbook OhChat).

## 5. Fase 2: marketplace de creadoras y clones licenciados

- Modelo validado: OhChat (clones oficiales, creadora retiene 80%) y Fanvue ($100M ARR, 80/20). Fansly/OnlyFans dejaron el hueco al vetar personas 100% IA.
- **Propuesta de split para clones IA**: 50% estándar / 60–70% creadoras ancla — defendible porque la plataforma pone cómputo, tecnología y marketing y el ingreso de la creadora es 100% pasivo. (El 80% de OhChat/Fanvue es la referencia que las creadoras conocerán: preparar la negociación.)
- **Colombia como ventaja**: reclutar entre las decenas de miles de modelos webcam locales — talento que ya entiende el negocio, en su idioma, con estudios y agencias establecidas.
- Contratos anti-CarynAI: límites de contenido definidos por la creadora, kill-switch, auditoría de conversaciones del clon, y §2257 + licencia de imagen/voz firmada antes de encender nada.

## 6. Financiación

- VC tradicional: bloqueado por "vice clauses" de los LPs. No perder tiempo ahí al inicio.
- Ruta del sector: **bootstrap** (Candy.ai declara rentabilidad desde el mes 3; Muah autofinanciada) + **ángeles/family offices** + fondos especializados (Vice Ventures).
- El capital institucional llega en fase marketplace/"creator economy" (Fanvue $22M Series A en 2026) cuando hay métricas y la marca es "creator platform con IA", no "porno IA".

## 7. Riesgos de negocio y mitigación

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Pérdida de procesador de pagos | Media-alta | Existencial | Multi-adquirente día 1, compliance impecable, cripto de respaldo, reservas de caja 3–6 meses |
| Byborg/CutiesAI u otro grande lanza "webcam IA" antes | Media | Alto | Velocidad + nicho español/LATAM + memoria/relación como switching cost |
| OpenAI/xAI abaratan el chat NSFW genérico | Media | Medio | El moat no es el chat: es video en vivo + personaje persistente + marketplace |
| Cambio de licencia/política de un modelo base | Media | Medio | Stack open-weights self-hosted, pesos descargados y versionados, fallbacks por capa |
| Regulación de verificación de edad se endurece | Alta | Medio | Ya diseñada dentro del producto; es barrera de entrada que te favorece una vez cumplida |
| Crisis reputacional (menores, deepfake, suicidio) | Baja si hay controles | Existencial | Las líneas rojas del doc 01 + moderación del doc 03 + auditoría externa periódica |
| Churn alto del nicho | Alta | Medio | Memoria de largo plazo, mensajes proactivos, arcos narrativos, comunidad |

---

*Siguiente: [05-plan-de-trabajo.md](./05-plan-de-trabajo.md) — el roadmap ejecutable.*
