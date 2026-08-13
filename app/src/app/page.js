'use client';
import { useEffect, useRef, useState } from 'react';

const CHARACTERS = [
  { id: 'amara', name: 'Amara', age: 26, job: 'fotógrafa', personality: 'juguetona', accent: 'colombiana', emoji: '📸',
    appearance: { ethnicity: 'latina', hair: 'castano_ondulado', body: 'curvas', style: 'coqueta' } },
  { id: 'valentina', name: 'Valentina', age: 28, job: 'chef', personality: 'intensa', accent: 'argentina', emoji: '🔥',
    appearance: { ethnicity: 'blanca', hair: 'negro_largo', body: 'voluptuosa', style: 'elegante' } },
  { id: 'sofia', name: 'Sofía', age: 24, job: 'estudiante de arte', personality: 'timida', accent: 'mexicana', emoji: '🎨',
    appearance: { ethnicity: 'morena', hair: 'corto', body: 'esbelta', style: 'casual' } },
  { id: 'lucia', name: 'Lucía', age: 30, job: 'música', personality: 'dulce', accent: 'espanola', emoji: '🎧',
    appearance: { ethnicity: 'blanca', hair: 'rubio', body: 'atletica', style: 'deportiva' } },
];

const TRAIT_OPTIONS = [
  { id: 'celosa', label: '😤 Celosa' },
  { id: 'toxica', label: '🎭 Intensa (tira y afloja)' },
  { id: 'dulce', label: '🍬 Dulce' },
  { id: 'independiente', label: '💅 Independiente' },
  { id: 'cariñosa', label: '🥰 Cariñosa' },
  { id: 'atrevida', label: '😏 Atrevida' },
];

export default function Home() {
  const [user, setUser] = useState(undefined); // undefined=cargando, null=no logueado
  const [character, setCharacter] = useState(null);
  const [traits, setTraits] = useState(['cariñosa']);
  const [providerId, setProviderId] = useState('deepseek');
  const [imgProviderId, setImgProviderId] = useState('novita');
  const [providers, setProviders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [paywall, setPaywall] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [customChars, setCustomChars] = useState([]);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setUser(d.user)).catch(() => setUser(null));
    fetch('/api/providers').then((r) => r.json()).then((d) => {
      setProviders(d.providers || []);
      const c = (d.providers || []).find((p) => p.configured);
      if (c) setProviderId(c.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) fetch('/api/characters').then((r) => r.json()).then((d) => setCustomChars(d.characters || [])).catch(() => {});
  }, [user]);

  // Voz: reproduce audio (ElevenLabs) o habla con la voz del dispositivo (demo).
  async function speak(text, char) {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, character: char || character }),
      });
      const data = await res.json();
      if (data.mode === 'audio' && data.audio) {
        new Audio(data.audio).play().catch(() => {});
      } else if (data.mode === 'browser' && typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text.replace(/[\p{Emoji}]/gu, ''));
        u.lang = data.params?.lang || 'es-ES';
        u.rate = data.params?.rate || 1; u.pitch = data.params?.pitch || 1;
        const v = window.speechSynthesis.getVoices().find((x) => x.lang?.startsWith('es'));
        if (v) u.voice = v;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch {}
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  function pickCharacter(c) {
    // Personajes del catálogo usan los traits elegidos; los personalizados traen los suyos.
    const withTraits = c.custom ? c : { ...c, traits };
    setCharacter(withTraits);
    setMessages([{ role: 'assistant', content: `hola! soy ${c.name} ${c.emoji || '💜'} un gusto conocerte 😊` }]);
    setRelationship(null);
    setPaywall(null);
  }

  async function send(forcedText) {
    const text = (forcedText ?? input).trim();
    if (!text || busy) return;
    if (!forcedText) setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      if (/\b(foto|selfie|imagen|mu[eé]strame|m[aá]ndame una|env[ií]ame una)\b/i.test(text)) {
        await requestPhoto(text);
        return;
      }
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, message: text, providerId, character }),
      });
      const data = await res.json();
      if (data.paywall) {
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
        setPaywall(data.reason);
      } else if (data.error) {
        setMessages((m) => [...m, { role: 'assistant', content: '⚠️ ' + data.error }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
        setMeta({ provider: data.provider, latencyMs: data.latencyMs, facts: data.factsLearned, freeLeft: data.freeLeft });
        if (voiceOn && data.reply) speak(data.reply);
        if (data.relationship) {
          setRelationship(data.relationship);
          if (data.relationship.leveledUp) {
            setMessages((m) => [...m, { role: 'system', content: `💗 Tu relación con ${character.name} subió a: ${data.relationship.level}` }]);
          }
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Error: ' + e.message }]);
    } finally {
      setBusy(false);
    }
  }

  async function requestPhoto(scene) {
    setMessages((m) => [...m, { role: 'assistant', content: '📸 ' + character.name + ' se está tomando una foto…' }]);
    try {
      const res = await fetch('/api/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, scene, providerId: imgProviderId }),
      });
      const data = await res.json();
      if (data.error) setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: data.error }]);
      else setMessages((m) => [...m.slice(0, -1), { role: 'assistant', image: data.image }]);
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: '⚠️ ' + e.message }]);
    }
  }

  async function upgrade() {
    const res = await fetch('/api/checkout-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'premium', characterId: character.id }),
    });
    const data = await res.json();
    setPaywall(null);
    setMessages((m) => [...m, { role: 'system', content: '✅ ' + data.message }]);
  }

  if (user === undefined) return <Center><div style={{ opacity: 0.6 }}>Cargando…</div></Center>;
  if (!user) return <Auth onAuth={setUser} />;
  if (!user.ageVerified) return <AgeGate onVerified={() => setUser({ ...user, ageVerified: true })} />;
  if (creating) return <Creator onDone={(c) => { setCreating(false); if (c) { setCustomChars((cur) => [...cur, c]); pickCharacter(c); } }} />;
  if (!character) return <Picker traits={traits} setTraits={setTraits} onPick={pickCharacter} customChars={customChars} onCreate={() => setCreating(true)} onLogout={() => setUser(null)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 680, margin: '0 auto' }}>
      <header style={header}>
        <button onClick={() => setCharacter(null)} style={backBtn}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{character.name} {character.emoji}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {relationship ? `${relationship.level} · afinidad ${relationship.affinity}` : 'en línea'}
            {meta?.freeLeft != null ? ` · ${meta.freeLeft} gratis` : ''}
          </div>
        </div>
        <button onClick={() => { setVoiceOn(!voiceOn); if (voiceOn && window.speechSynthesis) window.speechSynthesis.cancel(); }}
          style={{ ...voiceToggle, ...(voiceOn ? voiceToggleOn : {}) }} title="Voz de ella">
          {voiceOn ? '🔊' : '🔇'}
        </button>
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={select}>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.label}{p.configured ? '' : ' (demo)'}</option>)}
        </select>
      </header>

      {relationship && (
        <div style={progressWrap}>
          <div style={{ ...progressBar, width: barWidth(relationship) }} />
        </div>
      )}

      <div ref={scrollRef} style={chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : m.role === 'system' ? 'center' : 'flex-start' }}>
            {m.image ? <img src={m.image} alt="foto" style={photoBubble} />
              : m.role === 'system' ? <div style={systemMsg}>{m.content}</div>
              : m.role === 'assistant'
                ? <div style={bubbleAI}>{m.content}<button onClick={() => speak(m.content)} style={playBtn} title="Escuchar">🔊</button></div>
                : <div style={bubbleUser}>{m.content}</div>}
          </div>
        ))}
        {busy && <div style={{ ...bubbleAI, opacity: 0.6 }}>escribiendo…</div>}
      </div>

      {paywall && (
        <div style={paywallBar}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>💜 Hazte premium</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>Chat ilimitado, notas de voz, fotos y más intimidad con {character.name}.</div>
          <button onClick={upgrade} style={upgradeBtn}>Quiero premium — $9.99/mes</button>
        </div>
      )}

      <div style={inputBar}>
        <button onClick={() => requestPhoto('')} disabled={busy} style={photoBtn}>📷</button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Escríbele a ${character.name}…`} style={textInput} />
        <button onClick={() => send()} disabled={busy} style={sendBtn}>➤</button>
      </div>
    </div>
  );
}

// ---------- Pantallas ----------
function Auth({ onAuth }) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else onAuth(data.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Center><div style={card}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Amara 💜</h1>
      <p style={{ opacity: 0.7, fontSize: 14, marginTop: 0 }}>Tu compañera IA. Solo adultos 18+.</p>
      <input placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
      <input placeholder="contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} />
      {err && <div style={{ color: '#ff6b8a', fontSize: 13, margin: '8px 0' }}>{err}</div>}
      <button onClick={submit} disabled={busy} style={btnPrimary}>{mode === 'register' ? 'Crear cuenta' : 'Entrar'}</button>
      <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')} style={linkBtn}>
        {mode === 'register' ? '¿Ya tienes cuenta? Entra' : '¿Nuevo? Crea tu cuenta'}
      </button>
    </div></Center>
  );
}

function AgeGate({ onVerified }) {
  async function verify() { await fetch('/api/auth/verify-age', { method: 'POST' }); onVerified(); }
  return (
    <Center><div style={card}>
      <h2 style={{ marginTop: 0 }}>Confirma tu edad</h2>
      <p style={{ opacity: 0.8, lineHeight: 1.5 }}>Debes ser <b>mayor de 18 años</b>. Las compañeras son personajes de IA, no personas reales.</p>
      <button onClick={verify} style={btnPrimary}>Tengo 18 años o más</button>
      <p style={{ fontSize: 12, opacity: 0.5, marginTop: 12 }}>En producción: verificación de edad real (docs/03).</p>
    </div></Center>
  );
}

function Picker({ traits, setTraits, onPick, customChars, onCreate, onLogout }) {
  function toggle(t) { setTraits((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]); }
  return (
    <Center><div style={{ ...card, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Elige y personaliza</h2>
        <button onClick={async () => { await fetch('/api/auth/me', { method: 'DELETE' }); onLogout(); }} style={linkBtn}>Salir</button>
      </div>

      {customChars.length > 0 && (
        <>
          <p style={{ opacity: 0.7, fontSize: 13, marginBottom: 8 }}>Tus compañeras</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 18 }}>
            {customChars.map((c) => (
              <button key={c.id} style={{ ...charCard, borderColor: 'var(--accent, #b043ff)' }} onClick={() => onPick(c)}>
                <div style={{ fontSize: 40 }}>{c.emoji || '💜'}</div>
                <div style={{ fontWeight: 600 }}>{c.name}, {c.age}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{c.job}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{c.accent}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <button onClick={onCreate} style={createBtn}>✨ Crear mi compañera desde cero</button>

      <p style={{ opacity: 0.7, fontSize: 13, margin: '18px 0 8px' }}>O elige del catálogo (empiezan como amigos y la relación avanza):</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TRAIT_OPTIONS.map((t) => (
          <button key={t.id} onClick={() => toggle(t.id)}
            style={{ ...traitChip, ...(traits.includes(t.id) ? traitChipOn : {}) }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
        {CHARACTERS.map((c) => (
          <button key={c.id} style={charCard} onClick={() => onPick(c)}>
            <div style={{ fontSize: 40 }}>{c.emoji}</div>
            <div style={{ fontWeight: 600 }}>{c.name}, {c.age}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{c.job}</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{c.accent}</div>
          </button>
        ))}
      </div>
    </div></Center>
  );
}

// Creador de compañera desde cero (docs/06 M3). Guarda en la base de datos.
// Creador de personaje (docs/06 M3): hombre o mujer, opciones amplias y
// VISTA PREVIA EN VIVO — la imagen se actualiza mientras eliges.
const OPCIONES = {
  mujer: {
    hair: [['negro_largo','Negro largo'],['castano_ondulado','Castaño ondulado'],['rubio','Rubio'],['rojo','Pelirrojo'],['corto','Corto'],['rizado','Rizado'],['trenzas','Trenzas'],['colorido','De colores']],
    body: [['esbelta','Esbelta'],['curvas','Con curvas'],['atletica','Atlética'],['voluptuosa','Voluptuosa'],['menuda','Menuda'],['plus','Plus size']],
    style: [['casual','Casual'],['elegante','Elegante'],['deportiva','Deportiva'],['coqueta','Coqueta'],['oficina','Oficina'],['urbana','Urbana'],['playa','Playa']],
  },
  hombre: {
    hair: [['corto_oscuro','Corto oscuro'],['ondulado','Ondulado'],['largo','Largo'],['rapado','Rapado'],['rizado','Rizado'],['barba','Con barba'],['barba_larga','Barba completa'],['canoso','Canoso']],
    body: [['atletico','Atlético'],['delgado','Delgado'],['fornido','Fornido'],['normal','Normal'],['fitness','Fitness'],['grande','Grande y alto']],
    style: [['casual','Casual'],['elegante','Elegante'],['deportivo','Deportivo'],['urbano','Urbano'],['oficina','Oficina'],['motero','Motero'],['playa','Playa']],
  },
};
const ETNIAS = [['latina','Latina'],['morena','Morena'],['blanca','Blanca'],['afro','Afro'],['asiatica','Asiática'],['arabe','Árabe'],['mestiza','Mestiza']];
const PERSONALIDADES = [['dulce','Dulce'],['juguetona','Juguetona'],['intensa','Intensa'],['timida','Tímida'],['protectora','Protectora'],['divertida','Divertida']];
const ACENTOS = [['colombiana','Colombiano'],['mexicana','Mexicano'],['argentina','Argentino'],['espanola','Español'],['chilena','Chileno'],['venezolana','Venezolano'],['neutra','Neutro']];

function Creator({ onDone }) {
  const [f, setF] = useState({
    gender: 'mujer', name: '', age: 25, job: '', personality: 'dulce', accent: 'colombiana',
    ethnicity: 'latina', hair: 'castano_ondulado', body: 'curvas', style: 'coqueta',
    traits: ['cariñosa'], bio: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleTrait = (t) => setF((s) => ({ ...s, traits: s.traits.includes(t) ? s.traits.filter((x) => x !== t) : [...s.traits, t].slice(0, 4) }));

  function setGender(g) {
    const o = OPCIONES[g];
    setF((s) => ({ ...s, gender: g, hair: o.hair[0][0], body: o.body[0][0], style: o.style[0][0] }));
  }

  // Vista previa en vivo: se regenera poco después del último cambio visual.
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoadingPrev(true);
      try {
        const res = await fetch('/api/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: f.name,
            appearance: { gender: f.gender, ethnicity: f.ethnicity, hair: f.hair, body: f.body, style: f.style },
          }),
        });
        const d = await res.json();
        if (d.image) setPreview(d.image);
      } catch {} finally { setLoadingPrev(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [f.gender, f.ethnicity, f.hair, f.body, f.style]);

  async function create() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/characters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name, gender: f.gender, age: f.age, job: f.job, personality: f.personality,
          accent: f.accent, traits: f.traits, bio: f.bio,
          appearance: { gender: f.gender, ethnicity: f.ethnicity, hair: f.hair, body: f.body, style: f.style },
        }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else onDone(data.character);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const opts = OPCIONES[f.gender];
  const Row = ({ label, k, pairs }) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pairs.map(([v, lbl]) => (
          <button key={v} onClick={() => set(k, v)} style={{ ...traitChip, ...(f[k] === v ? traitChipOn : {}) }}>{lbl}</button>
        ))}
      </div>
    </div>
  );

  return (
    <Center><div style={{ ...card, maxWidth: 900, textAlign: 'left', maxHeight: '94dvh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Crea tu personaje ✨</h2>
        <button onClick={() => onDone(null)} style={linkBtn}>Cancelar</button>
      </div>
      <p style={{ fontSize: 12.5, opacity: 0.6, margin: '4px 0 14px' }}>
        100% ficticio. No se permite usar la imagen ni el nombre de personas reales.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) minmax(200px,260px)', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>¿Quién quieres que sea?</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setGender('mujer')} style={{ ...genderBtn, ...(f.gender === 'mujer' ? traitChipOn : {}) }}>👩 Mujer</button>
            <button onClick={() => setGender('hombre')} style={{ ...genderBtn, ...(f.gender === 'hombre' ? traitChipOn : {}) }}>👨 Hombre</button>
          </div>

          <input placeholder="Nombre" value={f.name} onChange={(e) => set('name', e.target.value)} style={field} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Edad" type="number" value={f.age} onChange={(e) => set('age', e.target.value)} style={{ ...field, width: 110 }} />
            <input placeholder="Ocupación" value={f.job} onChange={(e) => set('job', e.target.value)} style={field} />
          </div>

          <Row label="Etnia" k="ethnicity" pairs={ETNIAS} />
          <Row label="Cabello" k="hair" pairs={opts.hair} />
          <Row label="Complexión" k="body" pairs={opts.body} />
          <Row label="Estilo" k="style" pairs={opts.style} />
          <Row label="Personalidad" k="personality" pairs={PERSONALIDADES} />
          <Row label="Acento y voz" k="accent" pairs={ACENTOS} />

          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 6px' }}>Rasgos (máx. 4)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {TRAIT_OPTIONS.map((t) => (
              <button key={t.id} onClick={() => toggleTrait(t.id)} style={{ ...traitChip, ...(f.traits.includes(t.id) ? traitChipOn : {}) }}>{t.label}</button>
            ))}
          </div>

          <textarea placeholder="Su historia (opcional): cómo se conocieron, su forma de ser…" value={f.bio}
            onChange={(e) => set('bio', e.target.value)} style={{ ...field, minHeight: 60, resize: 'vertical' }} />
        </div>

        <div style={previewPanel}>
          <div style={{ fontSize: 11.5, opacity: 0.6, marginBottom: 8, textAlign: 'center' }}>
            Vista previa {loadingPrev ? '· actualizando…' : 'en vivo'}
          </div>
          <div style={previewFrame}>
            {preview
              ? <img src={preview} alt="vista previa" style={{ width: '100%', display: 'block', opacity: loadingPrev ? 0.55 : 1, transition: 'opacity .3s' }} />
              : <div style={{ padding: 40, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>Elige opciones…</div>}
          </div>
          <div style={{ fontSize: 12, textAlign: 'center', marginTop: 10, fontWeight: 600 }}>
            {f.name || 'Sin nombre'}{f.age ? `, ${f.age}` : ''}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.6, textAlign: 'center' }}>{f.job || '—'}</div>
        </div>
      </div>

      {err && <div style={{ color: '#ff6b8a', fontSize: 13, margin: '8px 0' }}>{err}</div>}
      <button onClick={create} disabled={busy} style={btnPrimary}>{busy ? 'Creando…' : 'Crear y conocerle'}</button>
    </div></Center>
  );
}

function barWidth(r) {
  if (!r?.nextLevel) return '100%';
  const span = r.nextLevel.at - (r.affinity - (r.affinity % Math.max(1, r.nextLevel.at)));
  const pct = Math.min(100, Math.round((r.affinity / r.nextLevel.at) * 100));
  return pct + '%';
}

// ---------- estilos ----------
const Center = ({ children }) => <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>{children}</div>;
const card = { background: '#16131f', border: '1px solid #2a2438', borderRadius: 20, padding: 24, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.4)' };
const field = { width: '100%', boxSizing: 'border-box', margin: '6px 0', padding: '12px 14px', borderRadius: 12, border: '1px solid #2a2438', background: '#1c1828', color: '#f4f2f8', fontSize: 15 };
const btnPrimary = { marginTop: 12, width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' };
const linkBtn = { marginTop: 10, background: 'none', border: 'none', color: '#b98cff', cursor: 'pointer', fontSize: 13 };
const traitChip = { padding: '8px 12px', borderRadius: 20, border: '1px solid #2a2438', background: '#1c1828', color: '#f4f2f8', cursor: 'pointer', fontSize: 13 };
const traitChipOn = { background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', border: '1px solid transparent' };
const charCard = { background: '#1c1828', border: '1px solid #2a2438', borderRadius: 16, padding: 16, cursor: 'pointer', color: '#f4f2f8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #221d30', background: '#100e18' };
const backBtn = { fontSize: 26, background: 'none', border: 'none', color: '#f4f2f8', cursor: 'pointer', lineHeight: 1 };
const select = { background: '#1c1828', color: '#f4f2f8', border: '1px solid #2a2438', borderRadius: 10, padding: '6px 8px', fontSize: 12 };
const progressWrap = { height: 4, background: '#221d30' };
const progressBar = { height: 4, background: 'linear-gradient(90deg,#b043ff,#ff4d8d)', transition: 'width .5s' };
const chatArea = { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 };
const bubbleBase = { padding: '10px 14px', borderRadius: 18, maxWidth: '78%', lineHeight: 1.4, fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
const bubbleUser = { ...bubbleBase, background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', borderBottomRightRadius: 6 };
const bubbleAI = { ...bubbleBase, background: '#1c1828', border: '1px solid #2a2438', borderBottomLeftRadius: 6 };
const systemMsg = { fontSize: 12, opacity: 0.7, padding: '4px 12px', background: '#231b33', borderRadius: 12, textAlign: 'center' };
const photoBubble = { maxWidth: '60%', borderRadius: 18, borderBottomLeftRadius: 6, border: '1px solid #2a2438' };
const paywallBar = { margin: 12, padding: 16, borderRadius: 16, background: 'linear-gradient(135deg,#2a1840,#3a1a2e)', border: '1px solid #4a2a5a', textAlign: 'center' };
const upgradeBtn = { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const inputBar = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #221d30', background: '#100e18', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' };
const textInput = { flex: 1, background: '#1c1828', border: '1px solid #2a2438', borderRadius: 22, padding: '12px 16px', color: '#f4f2f8', fontSize: 15, outline: 'none' };
const sendBtn = { width: 46, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', fontSize: 18, cursor: 'pointer' };
const photoBtn = { width: 46, borderRadius: '50%', border: '1px solid #2a2438', background: '#1c1828', fontSize: 18, cursor: 'pointer' };
const voiceToggle = { width: 38, height: 38, borderRadius: '50%', border: '1px solid #2a2438', background: '#1c1828', fontSize: 15, cursor: 'pointer' };
const voiceToggleOn = { background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', border: '1px solid transparent' };
const playBtn = { marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.6, padding: 0 };
const createBtn = { width: '100%', padding: '14px', borderRadius: 14, border: '1px dashed #b043ff', background: 'rgba(176,67,255,.1)', color: '#d9b8ff', fontWeight: 650, fontSize: 15, cursor: 'pointer' };
const genderBtn = { flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #2a2438', background: '#1c1828', color: '#f4f2f8', cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const previewPanel = { background: '#120f1b', border: '1px solid #2a2438', borderRadius: 16, padding: 14, position: 'sticky', top: 0 };
const previewFrame = { borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2438', background: '#1c1828', minHeight: 120 };
