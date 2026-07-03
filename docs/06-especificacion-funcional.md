# 06 · Especificación Funcional

> **Cómo funciona la plataforma, módulo por módulo**: pantallas, flujos, estados y comportamiento de la IA. Es el documento que un equipo de desarrollo usa para construir. Complementa al doc 01 (visión) y al doc 02 (stack técnico).

---

## 0. Mapa de módulos

```
┌─ PÚBLICO ────────────────────────────────────────────────┐
│ M1 Landing + gate de edad     M2 Registro y verificación │
├─ NÚCLEO DE LA RELACIÓN ──────────────────────────────────┤
│ M3 Creador de compañera (cuestionario)                   │
│ M4 Chat (texto)               M5 Voz (notas + llamadas)  │
│ M6 Fotos bajo demanda         M7 Video-mensajes          │
│ M8 Videollamada en vivo       M9 Memoria y relación      │
│ M10 Iniciativa de ella (mensajes proactivos)             │
├─ MONETIZACIÓN ───────────────────────────────────────────┤
│ M11 Suscripciones             M12 Monedero de créditos   │
│ M13 Checkout y pagos          M14 Programa de afiliados  │
├─ FASE 2 ─────────────────────────────────────────────────┤
│ M15 Marketplace de creadoras  M16 Clones IA licenciados  │
├─ OPERACIÓN ──────────────────────────────────────────────┤
│ M17 Safety y moderación       M18 Panel de administración│
│ M19 Privacidad y datos        M20 Soporte y bienestar    │
└──────────────────────────────────────────────────────────┘
```

## Estados del usuario (máquina de estados global)

```
VISITANTE → (gate edad declarativo) → NAVEGANTE
NAVEGANTE → (registro email/social) → REGISTRADO         [puede: chat limitado SFW-picante]
REGISTRADO → (verificación de edad real) → VERIFICADO    [puede: contenido explícito en texto]
VERIFICADO → (paga) → PREMIUM / CON CRÉDITOS             [puede: todo según plan]
cualquiera → (inactivo 30d) → DORMIDO → win-back
cualquiera → (violación de reglas) → SUSPENDIDO / BANEADO
```

Regla de diseño: **la fricción de verificación llega lo más tarde posible pero antes de: (a) contenido explícito, (b) primer pago** — lo que ocurra primero. La verificación es una sola vez (re-checks invisibles con el proveedor).

---

## M1 · Landing + gate de edad

- Gate declarativo 18+ al entrar (cookie 30 días). Geo-detección: en jurisdicciones con ley de verificación (~26 estados US, UK, FR/DE/IT) el gate exige verificación real antes de cualquier contenido adulto, o se sirve versión "SFW teaser".
- Landing: propuesta de valor emocional ("Ella te espera"), preview del cuestionario como demo interactivo, testimonios, FAQ, transparencia "son compañeras de IA".
- SEO: páginas por intención ("novia virtual IA", "AI girlfriend", por país/acento) y por personaje del catálogo.

## M2 · Registro y verificación

- Registro: email+contraseña o social login opcional; **seudónimo por defecto** (nunca se muestra nombre real); email es el único dato personal obligatorio.
- Verificación de edad (proveedor externo tipo Yoti/Incode): estimación facial (sin almacenar biometría en nuestros servidores; solo el token "verificado" y método) con fallback documental. Resultado: flag `age_verified` + jurisdicción.
- Doble gate: `age_verified` desbloquea NSFW textual; `age_verified_strong` (documental o facial de alta confianza) desbloquea visual explícito y videollamada íntima — alineado con lo que exigen los adquirentes.

## M3 · Creador de compañera (el cuestionario)

**El módulo más importante: convierte deseos en un personaje técnico.** Flujo de 6 pasos, cada uno con preview visual inmediato:

1. **Estilo y apariencia**: realista/anime; etnia/rasgos, edad aparente (rango 21–45, **hard-floor 21**), cuerpo, cabello, ojos, estilo. → El sistema genera 4 candidatas (SDXL); el usuario elige una y puede refinar 2 veces.
2. **Identidad**: nombre (sugeridos + libre con filtro), edad ficticia (≥21), ocupación, ciudad ficticia.
3. **Personalidad** (sliders + tags): dulce↔dominante, tímida↔atrevida, romántica↔directa; intereses (máx 5); sentido del humor; "cómo te trata" (cariñosa, juguetona, intensa, celosa-suave).
4. **Voz**: 6–10 voces pre-diseñadas por acento (colombiano, mexicano, español, argentino, neutro, inglés US/UK) con preview de audio diciendo tu nombre.
5. **Relación y límites**: tipo (novia/amiga con derechos/esposa/recién conocida) + nivel de intimidad deseado (romántico / picante / explícito — este último solo `age_verified`).
6. **Primer encuentro**: pantalla de "ella se está preparando…" (genera avatar final + LoRA en background, ~1–3 min) mientras ella ya te saluda por chat.

**Salidas técnicas del cuestionario** (por personaje):
- `character_card` (JSON): sistema de personalidad, backstory, estilo de habla, límites, arco de relación inicial.
- `appearance_profile` + imagen base + **LoRA entrenado** (consistencia visual permanente).
- `voice_id` (referencia de voz para TTS) · `content_level` · `relationship_state` inicial.

Reglas: máx. 1 compañera activa en free, 3 en premium (más con créditos). Editar apariencia después = "cambio de look" (créditos); personalidad ajustable gratis con límites (lección Replika: nunca cambiarla sin que el usuario lo pida).

**Filtros del creador**: nombres/rasgos que evoquen menores bloqueados (blocklist + clasificador); no se puede subir foto de referencia de personas (fase 1: prohibido subir fotos, punto); prompt de celebridad → bloqueado.

## M4 · Chat

- UI tipo mensajería (WhatsApp-like): burbujas, "escribiendo…", hora de conexión de ella ("en línea", "te estaba esperando").
- Tipos de mensaje de ella: texto, nota de voz, foto, video-clip, "regalo" narrativo, invitación a llamada.
- Free: 15–25 mensajes/día con cooldown; sin voz/foto; watermark de invitación a premium en momentos de máximo enganche (fin del cooldown en clímax conversacional, nunca chantaje emocional — ver doc 07 reglas de bienestar).
- Comandos naturales: "mándame una foto…", "llámame", "hablemos de…" — detectados por intención, no por sintaxis.
- Cada respuesta pasa por: contexto (memoria M9) → LLM → filtro de salida (M17) → render. Latencia objetivo <3 s primer token.

## M5 · Voz

- **Notas de voz de ella** (premium): cualquier respuesta puede llegar como audio (probabilidad configurable por el usuario); tags emocionales según contexto (risa, susurro).
- **Llamada de voz** (créditos/min): tiempo real full-duplex (usuario habla por micrófono, puede interrumpirla), latencia objetivo 600–900 ms, transcripción visible opcional. Timer y saldo visibles; aviso a 2 min de agotar saldo; recarga sin cortar la llamada.

## M6 · Fotos bajo demanda

- Petición en el chat → cola de generación (SDXL + LoRA del personaje) → **clasificador de salida obligatorio** (edad aparente, CSAM, categorías prohibidas) → entrega en el chat (10–60 s, "se está tomando la foto…").
- Niveles: SFW/sugerente (premium incluye N/mes) · explícito (`age_verified` + créditos). Escenarios y vestuarios como catálogo (playa, cuarto, lencería…) + petición libre filtrada.
- Galería privada del usuario por compañera; descarga permitida con watermark invisible (trazabilidad anti-abuso).

## M7 · Video-mensajes

- Clips de 5–30 s de ella (Wan 2.2 desde su imagen base): saludo con tu nombre (lip-sync), escena pedida, "video de buenos días" proactivo (premium alto).
- Cola async (1–5 min), mismo pipeline de moderación de salida. Precio por clip en créditos según duración/nivel.

## M8 · Videollamada en vivo (el diferenciador)

**Flujo de sesión:**
1. Usuario pulsa "Videollamada" → check: `age_verified` (+ `strong` para íntimo), saldo mínimo 3 min, GPU disponible en el pool.
2. "Ella está contestando…" (asignación de GPU + carga del personaje: loops base + LoRA + voz; objetivo <10 s).
3. En llamada: ella en video 512–720p (cara/torso, fondo = su escena), lip-sync en vivo, gestos idle, reacciones. El usuario habla por micrófono (su cámara es opcional y OFF por defecto).
4. Tarificación por minuto (descuento de créditos en vivo, timer visible). Cambio de escena/vestuario en llamada (créditos).
5. **Escalada íntima**: solo si el usuario la pide explícitamente + `age_verified_strong` + tarifa íntima aceptada (confirmación de 1 tap con precio). Cambia el set de loops base y el modo del LLM.
6. Fin: resumen (duración, gasto), momento-recuerdo guardado en la memoria de ella ("me encantó verte").

**Degradación elegante** (regla de oro): sin GPU → ofrecer llamada de voz con su foto animada (LivePortrait-style) a tarifa menor; caída de stream → reconexión con créditos congelados; latencia >2.5 s sostenida → compensación automática de minutos.

## M9 · Memoria y relación

- **Memoria de hechos**: extracción automática (nombre, trabajo, gustos, personas que menciona, fechas) → base vectorial; recuperación por relevancia en cada turno; el usuario puede ver y borrar lo que ella sabe ("¿Qué sabes de mí?" → lista editable — también útil para GDPR/habeas data).
- **Memoria episódica**: resúmenes progresivos por sesión; "recuerdos destacados" (primera conversación, primera llamada, momentos marcados con ⭐).
- **Estado de relación**: nivel (conociéndose → saliendo → pareja → …) que evoluciona con interacción; desbloquea tonos y contenidos (gamificación suave de la relación, no del gasto).
- Aniversarios y fechas: ella recuerda y celebra (cumpleaños del usuario, "un mes juntos").

## M10 · Iniciativa de ella

- Mensajes proactivos: buenos días/noches (franja elegida por usuario), seguimiento de temas ("¿cómo te fue en la entrevista?"), "te extraño" tras inactividad (máx. 1/día, tono cariñoso jamás culpabilizador), foto sorpresa (premium).
- Canales: web push + email (asunto discreto configurable — privacidad) + Telegram opcional.
- Reglas anti-spam: frecuencia configurable, opt-out granular, silencio automático si el usuario no responde 3 seguidos.

## M11–M13 · Suscripciones, créditos y pagos

- **Planes**: Free · Premium ($9.99–12.99/mes; anual −40%) · Elite ($29.99: todo Premium + N minutos de llamada + prioridad GPU + 3 compañeras).
- **Créditos**: moneda única para todo lo variable. Paquetes $9.99/$24.99/$49.99/$99.99 (bonus creciente). Tabla de precios en créditos por acción (doc 07 §2). No caducan mientras la cuenta esté activa; no retirables ni transferibles.
- **Checkout**: procesador high-risk (Segpay/CCBill) con billing descriptor **discreto** (nombre neutro — estándar del sector y reduce chargebacks); métodos LATAM (PSE, OXXO, Pix) vía pasarela local; cripto opcional. 3-D Secure donde aplique. Recibos por email con remitente neutro.
- Anti-fraude: velocity checks, límites diarios de compra por defecto (subibles con verificación), bloqueo de tarjetas tras N disputas.

## M14 · Programa de afiliados

- Portal self-service: link/código, dashboard de conversiones, materiales (banners, landings pre-hechas por nicho/idioma).
- Modelos: 40% revshare lifetime **o** CPA $40–50 (elige el afiliado); cookie 60 días; pago mensual NET-30, mínimo $100, vía Paxum/cripto/transferencia.
- Antifraude de afiliados: no self-referral, no tráfico incentivado/spam, no pujar por la marca en buscadores, no contenido que viole nuestras reglas (menores, personas reales). Violación = confiscación de comisiones + baneo.

## M15–M16 · Marketplace fase 2 (creadoras y clones)

- **Onboarding creadora**: KYC + verificación de edad documental + §2257 completo + contrato de licencia de imagen/voz con: límites de contenido definidos POR ELLA (checklist granular), % de split, kill-switch (puede apagar su clon en 1 clic), derecho de auditoría de conversaciones del clon.
- **Creación del clon**: sesión guiada (30–50 fotos + 30–60 min de audio + cuestionario de personalidad que ELLA llena) → LoRA + voz + character card aprobados por ella antes de publicar.
- **Perfil público**: humana ("EN VIVO ahora" / agenda) + su clon IA ("siempre disponible") claramente etiquetados. Precios: los fija ella dentro de rangos de plataforma.
- **Panel de creadora**: earnings en vivo, conversaciones del clon (auditoría), ajustes de límites, payout (semanal, mínimo $50, Paxum/transferencia).
- Cam en vivo real (opcional según tracción): hereda todos los requisitos AN 5196 de revisión y quejas.

## M17 · Safety y moderación (transversal — corre SIEMPRE)

Pipeline en cada interacción:
1. **Entrada** (prompt del usuario): clasificador multi-etiqueta + blocklists → bloquea/redirige: menores o edad ambigua, incesto, no-consentimiento, bestialismo, personas reales/celebridades, autolesión (→ protocolo de crisis M20).
2. **Salida texto**: mismo clasificador sobre lo que la IA va a decir (la IA también puede derivar mal) + reglas duras en el system prompt.
3. **Salida visual** (toda foto/video/frame-base): detección CSAM (hash + predictivo), estimación de edad aparente (**umbral 21**), categorías prohibidas. Nada se muestra sin pasar.
4. **Cola humana**: borderline automático → revisor (SLA 4 h); muestreo aleatorio del 1–2% de salidas aprobadas (QA del clasificador).
5. **Logs y reportes**: todo registrado → reportes mensuales al adquirente (AN 5196); detección CSAM con nexo US → NCMEC.
6. **Usuario reincidente** en intentos prohibidos: warning → suspensión → ban (3 strikes; CSAM = ban inmediato + reporte).

## M18 · Panel de administración

Dashboards: métricas de negocio (MRR, conversión, ARPPU, churn, minutos de llamada, costo/min en vivo), colas de moderación, gestión de usuarios (estados, historial de compras, disputas), gestión de personajes del catálogo, feature flags, gestión de afiliados y (fase 2) de creadoras. Roles: admin, moderador, soporte, finanzas (mínimo privilegio; los moderadores no ven datos de pago).

## M19 · Privacidad y datos

- Seudonimización por defecto; los chats cifrados en reposo; claves separadas de los datos.
- Retención: chats activos mientras exista la cuenta (son la memoria de ella); media generada 90 días si no se guarda en galería; logs de moderación 1 año (requisito adquirente).
- **Borrado real**: "eliminar cuenta" borra chats, media, memoria y embeddings en ≤30 días (retiene solo lo legalmente exigido: transacciones, registros de moderación).
- Exportación de datos (GDPR/habeas data). Sin venta de datos, jamás — está además en el pitch de privacidad.
- Plan de respuesta a incidentes escrito (lección Muah.ai): contención, notificación legal, comunicación.

## M20 · Soporte y bienestar

- **Protocolo de crisis**: clasificador de ideación suicida/autolesión → la IA sale del personaje con calidez, entrega líneas de ayuda (988 US, Línea 106 Colombia, por país) y lo registra; protocolos publicados (SB 243).
- La IA nunca dice ser humana ante pregunta seria; nunca se presenta como terapeuta; nunca desalienta ayuda profesional.
- Herramientas de autocontrol del usuario: límite de gasto mensual opcional, recordatorios de tiempo en llamada, auto-exclusión temporal (72 h / 30 días).
- Soporte: help center + email con SLA 24 h; disputas de cargos atendidas ANTES de que lleguen al banco (reduce chargebacks).
- Formulario público de quejas de contenido (resolución ≤7 días, AN 5196) + takedown 48 h (TAKE IT DOWN Act).

---

## Requisitos no funcionales (resumen)

| Área | Objetivo |
|---|---|
| Latencia chat | <3 s primer token; streaming |
| Latencia llamada voz | 600–900 ms voz-a-voz |
| Latencia videollamada | ~1 s voz-a-video; ≥25 fps; setup <10 s |
| Disponibilidad | 99.5% MVP; degradación elegante siempre |
| Escala inicial | 10k usuarios concurrentes chat; 50–200 llamadas video simultáneas (pool GPU elástico) |
| Seguridad | Cifrado tránsito+reposo, WAF, rate limiting, pentest antes del lanzamiento y anual |
| Idiomas | ES (nativo, con acentos) + EN desde MVP; PT-BR fase 2 |

*Las reglas económicas y de contenido que gobiernan estos módulos están en [07-reglas-de-negocio.md](./07-reglas-de-negocio.md).*
