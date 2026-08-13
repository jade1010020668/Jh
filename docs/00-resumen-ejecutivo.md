# 00 · Resumen Ejecutivo — Proyecto "Amara"

> **La idea completa en 5 minutos.** El detalle vive en los docs 01–07. Fecha: julio 2026.

---

## 1. La idea

**Una plataforma web para adultos (18+) donde el usuario diseña su compañera ideal y vive una relación real con ella: chat, notas de voz, fotos, y videollamadas en vivo donde ella se ve, se mueve, habla y responde como una mujer real.** La compañera es 100% inteligencia artificial en la fase 1; en la fase 2 la plataforma suma creadoras humanas reales y clones IA oficiales de esas creadoras (con su contrato y consentimiento), convirtiéndose en un ecosistema tipo webcam/OnlyFans donde la IA es la puerta de entrada.

**En una frase**: *la experiencia webcam, con la disponibilidad, personalización y economía de la IA — en español nativo.*

## 2. Cómo funciona (el journey del usuario)

1. **Entra a la web** (no hay app: Apple/Google prohíben contenido adulto) → gate de edad.
2. **Cuestionario de diseño** (2–4 min, tipo juego): apariencia, personalidad, voz con acento (colombiana, mexicana, española…), tipo de relación y nivel de intimidad. De ahí el sistema crea: el prompt de personalidad (LLM), la cara/cuerpo consistentes (LoRA de imagen), y su voz (TTS).
3. **La relación**: chat ilimitado (premium), ella responde con texto y notas de voz con emoción real, envía fotos bajo demanda ("mándame una foto en la playa"), recuerda todo (nombre, trabajo, conversaciones, aniversarios) y **toma la iniciativa** escribiéndote primero.
4. **La videollamada** (el diferenciador): botón "Llamar" → ella aparece en video en vivo, mueve la boca sincronizada con su voz, gesticula y reacciona a lo que le dices por el micrófono, con latencia ~1 segundo. Para adultos con verificación reforzada y saldo, la llamada puede escalar a **modo íntimo**, cobrado por minuto — el modelo "privado" de las webcam, con IA.
5. **Fase 2**: el usuario también encuentra creadoras reales (chat/contenido/llamadas reales) y sus clones IA oficiales que las atienden 24/7; la creadora gana revenue share pasivo.

## 3. Por qué ahora (la ventana)

- Las apps "AI girlfriend" ya facturan fuerte con solo chat+imágenes (Fanvue ~$100M ARR verificado; Candy.ai declara $25M+; Chai ~$80M). Las webcam facturan miles de millones con video en vivo. **Nadie ha unido bien las dos cosas**: solo Kindroid tiene videollamada IA en beta (generalista, no adulta-first, no español).
- **El español/LATAM está mal servido**: Brasil es #3 y México #7 mundial en demanda de companions; la oferta local es precaria y los líderes solo traducen.
- La tecnología acaba de madurar: lip-sync en tiempo real open-source (MuseTalk/Ditto), TTS de calidad casi humana en español con licencia libre (Chatterbox/Qwen3-TTS), y LLMs sin censura con licencia comercial (Mistral/DeepSeek).
- La ventana se cierra: el dueño de LiveJasmin (Byborg) compró una startup de novias IA en 2025 y xAI normalizó los companions NSFW. **Estimamos 12–18 meses para ser primeros en "webcam IA en español".**

## 4. El modelo de negocio

| Fuente de ingreso | Precio | Margen bruto |
|---|---|---|
| Suscripción premium (chat ilimitado, voz, memoria, fotos incluidas) | $9.99–12.99/mes | alto |
| Créditos (fotos extra, video-mensajes, regalos) | paquetes $9.99–99.99 | >90% |
| Videollamada estándar / íntima | $0.99 / $1.99 por min (≈50% en LATAM) | >85% |
| Fase 2: marketplace creadoras y clones | split 50–70% creadora | 30–50% del GMV |

- Costo de servir a un pagador: ~$7–10.5/mes contra ARPPU objetivo $25 → **margen bruto 58–72%** (ya descontando el 10–15% de pagos high-risk).
- Adquisición sin Google/Meta (prohíben ads adultas): **afiliados (40–50% revshare, el canal #1 del sector), SEO en español casi virgen, ads adultas (CAC LATAM $5–15), Telegram como embudo**.
- Financiación: bootstrap + ángeles (el VC clásico tiene "vice clauses"); el sector demuestra rentabilidad temprana. **~$125–240k hasta la videollamada en vivo**, con revenue desde el mes 4–6.

## 5. La tecnología (resumen; detalle en doc 02)

Ningún gran proveedor (OpenAI, Anthropic, Google, ElevenLabs, HeyGen…) permite contenido sexual en sus términos — por eso el core es **open-source con licencia Apache 2.0/MIT, auto-hospedado**: Mistral/DeepSeek (chat), Chatterbox/Qwen3-TTS (voz en español), SDXL+LoRA (fotos consistentes), Wan 2.2 + MuseTalk/Ditto sobre LiveKit (videollamada en vivo). Nadie puede "desconectarnos" y es 3–10× más barato. Única API grande tolerante: Grok (xAI), como complemento.

## 6. Reglas del juego (innegociables; detalle en docs 03 y 07)

Solo adultos verificados · cero apariencia de menores (umbral 21+ en generación) · cero personas reales sin contrato · categorías prohibidas por Visa/Mastercard bloqueadas técnicamente aunque sean ficción · transparencia de que la IA es IA · protocolo de crisis (derivación a líneas de ayuda) · privacidad extrema (los chats íntimos son material de extorsión: cifrado y retención mínima). **Estas reglas son la licencia para operar**: son lo que hace que un procesador de pagos te apruebe, un regulador no te cierre y una creadora firme.

## 7. Plan por fases (detalle en doc 05)

| Fase | Cuándo | Qué | Gate |
|---|---|---|---|
| 0 · Fundación | Semanas 1–6 | Entidad legal, procesadores, marca, landing, prototipo | Procesador pre-aprobado + 2k lista de espera |
| 1 · MVP | Meses 2–4 | Chat + voz + fotos, cobrando, moderación completa | MRR $15–20k, conversión ≥3% |
| 2 · Voz en vivo | Meses 4–8 | Llamadas de voz <1s, video-clips, dataset español propio | MRR $50–80k |
| 3 · Videollamada | Meses 8–14 | El diferenciador, por minuto | MRR $150–250k |
| 4 · Marketplace | Meses 14–24 | Creadoras reales + clones licenciados (ventaja Colombia) | 30–50 creadoras, MRR $400–700k |

## 8. Los 5 riesgos que importan

1. **Pagos** (existencial): multi-procesador desde el día 1 + compliance impecable + cripto de respaldo.
2. **Un grande entra primero**: velocidad + nicho español + la relación/memoria como switching cost.
3. **Latencia/calidad del video decepciona**: escalones intermedios (voz, clips) monetizan mientras se pule; beta cerrada antes de GA.
4. **Crisis reputacional**: las líneas rojas + moderación automática + humana; los que las ignoren (Muah) nos dejan el mercado.
5. **Churn del nicho**: memoria de largo plazo, iniciativa de ella, arcos narrativos, comunidad.

## 9. Qué se necesita para arrancar (los primeros 30 días — checklist en doc 05)

Abogado del sector + fiscalista → estructura societaria · aplicaciones a Segpay/CCBill/Epoch en paralelo · marca y dominios · prototipo de chat con personalidad (2 semanas) · landing con el cuestionario como teaser + $200–500 de ads LATAM para medir demanda real · decisión go/no-go con datos.

---

**Índice del paquete completo**: [docs/README.md](./README.md)
