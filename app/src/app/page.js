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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  function pickCharacter(c) {
    const withTraits = { ...c, traits };
    setCharacter(withTraits);
    setMessages([{ role: 'assistant', content: `hola! soy ${c.name} ${c.emoji} un gusto conocerte 😊` }]);
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
  if (!character) return <Picker traits={traits} setTraits={setTraits} onPick={pickCharacter} user={user} onLogout={() => setUser(null)} />;

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
              : <div style={m.role === 'user' ? bubbleUser : bubbleAI}>{m.content}</div>}
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

function Picker({ traits, setTraits, onPick, user, onLogout }) {
  function toggle(t) { setTraits((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]); }
  return (
    <Center><div style={{ ...card, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Elige y personaliza</h2>
        <button onClick={async () => { await fetch('/api/auth/me', { method: 'DELETE' }); onLogout(); }} style={linkBtn}>Salir</button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 13 }}>¿Cómo quieres que sea? (empiezan como amigos y la relación avanza)</p>
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
