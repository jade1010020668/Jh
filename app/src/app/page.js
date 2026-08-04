'use client';
import { useEffect, useRef, useState } from 'react';

const CHARACTERS = [
  { id: 'amara', name: 'Amara', age: 26, job: 'fotógrafa', personality: 'juguetona', accent: 'colombiana', relationship: 'conociendose', emoji: '📸',
    appearance: { ethnicity: 'latina', hair: 'castano_ondulado', body: 'curvas', style: 'coqueta' } },
  { id: 'valentina', name: 'Valentina', age: 28, job: 'chef', personality: 'intensa', accent: 'argentina', relationship: 'conociendose', emoji: '🔥',
    appearance: { ethnicity: 'blanca', hair: 'negro_largo', body: 'voluptuosa', style: 'elegante' } },
  { id: 'sofia', name: 'Sofía', age: 24, job: 'estudiante de arte', personality: 'timida', accent: 'mexicana', relationship: 'conociendose', emoji: '🎨',
    appearance: { ethnicity: 'morena', hair: 'corto', body: 'esbelta', style: 'casual' } },
  { id: 'lucia', name: 'Lucía', age: 30, job: 'música', personality: 'dulce', accent: 'espanola', relationship: 'conociendose', emoji: '🎧',
    appearance: { ethnicity: 'blanca', hair: 'rubio', body: 'atletica', style: 'deportiva' } },
];

function newSessionId() {
  const k = 'amara_session';
  let v = typeof localStorage !== 'undefined' && localStorage.getItem(k);
  if (!v) { v = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
  return v;
}

export default function Home() {
  const [ageOk, setAgeOk] = useState(false);
  const [character, setCharacter] = useState(null);
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState('deepseek');
  const [imgProviderId, setImgProviderId] = useState('novita');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      setAgeOk(localStorage.getItem('amara_age_ok') === '1');
      sessionRef.current = newSessionId();
    }
    fetch('/api/providers').then((r) => r.json()).then((d) => {
      setProviders(d.providers || []);
      const configured = (d.providers || []).find((p) => p.configured);
      if (configured) setProviderId(configured.id);
    }).catch(() => {});
    fetch('/api/image-providers').then((r) => r.json()).then((d) => {
      const configured = (d.providers || []).find((p) => p.configured);
      if (configured) setImgProviderId(configured.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  function confirmAge() {
    localStorage.setItem('amara_age_ok', '1');
    setAgeOk(true);
  }

  function pickCharacter(c) {
    setCharacter(c);
    setMessages([{ role: 'assistant', content: `Hola, soy ${c.name} ${c.emoji}` }]);
  }

  // Detecta si el usuario está pidiendo una foto en lenguaje natural.
  function isPhotoRequest(text) {
    return /\b(foto|selfie|imagen|f[oó]tico|mu[eé]strame|env[ií]ame una|m[aá]ndame una)\b/i.test(text);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      if (isPhotoRequest(text)) {
        await requestPhoto(text);
        return;
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionRef.current, message: text, providerId, character }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((m) => [...m, { role: 'assistant', content: '⚠️ ' + data.error }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
        setMeta({ provider: data.provider, latencyMs: data.latencyMs, model: data.model, facts: data.factsLearned, blocked: data.blocked });
        if (data.relationship) setRelationship(data.relationship);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Error de red: ' + e.message }]);
    } finally {
      setBusy(false);
    }
  }

  async function requestPhoto(scene) {
    setMessages((m) => [...m, { role: 'assistant', content: '📸 ' + character.name + ' se está tomando una foto…' }]);
    try {
      const res = await fetch('/api/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, scene, providerId: imgProviderId }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: data.error }]);
      } else {
        setMessages((m) => [...m.slice(0, -1), { role: 'assistant', image: data.image, content: '' }]);
        setMeta({ provider: 'imagen · ' + data.provider, latencyMs: data.latencyMs, model: 'seed ' + data.seed });
      }
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: '⚠️ Error generando la foto: ' + e.message }]);
    }
  }

  // --- Gate de edad ---
  if (!ageOk) {
    return (
      <Center>
        <div style={card}>
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>Amara 💜</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
            Este espacio es solo para <b>adultos mayores de 18 años</b>. Las compañeras son
            personajes de inteligencia artificial, no personas reales.
          </p>
          <button style={btnPrimary} onClick={confirmAge}>Tengo 18 años o más — Entrar</button>
          <p style={{ fontSize: 12, opacity: 0.5, marginTop: 14 }}>
            En producción aquí va verificación de edad real (ver docs/03). Esto es una demo.
          </p>
        </div>
      </Center>
    );
  }

  // --- Selección de personaje ---
  if (!character) {
    return (
      <Center>
        <div style={{ ...card, maxWidth: 620 }}>
          <h2 style={{ marginTop: 0 }}>Elige con quién hablar</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
            {CHARACTERS.map((c) => (
              <button key={c.id} style={charCard} onClick={() => pickCharacter(c)}>
                <div style={{ fontSize: 40 }}>{c.emoji}</div>
                <div style={{ fontWeight: 600 }}>{c.name}, {c.age}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{c.job}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{c.accent}</div>
              </button>
            ))}
          </div>
        </div>
      </Center>
    );
  }

  // --- Chat ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 680, margin: '0 auto' }}>
      <header style={header}>
        <button onClick={() => setCharacter(null)} style={backBtn}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{character.name} {character.emoji}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>en línea · {character.accent}</div>
        </div>
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={select}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.label}{p.configured ? '' : ' (demo)'}</option>
          ))}
        </select>
      </header>

      <div ref={scrollRef} style={chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.image ? (
              <img src={m.image} alt="foto" style={photoBubble} />
            ) : (
              <div style={m.role === 'user' ? bubbleUser : bubbleAI}>{m.content}</div>
            )}
          </div>
        ))}
        {busy && <div style={{ ...bubbleAI, opacity: 0.6 }}>escribiendo…</div>}
      </div>

      {meta && (
        <div style={metaBar}>
          {meta.provider} · {meta.latencyMs}ms{meta.model ? ` · ${meta.model}` : ''}
          {meta.facts?.length ? ` · 🧠 aprendió: ${meta.facts.join(' ')}` : ''}
          {meta.blocked ? ` · 🛡️ ${meta.blocked}` : ''}
        </div>
      )}

      <div style={inputBar}>
        <button onClick={() => requestPhoto('')} disabled={busy} style={photoBtn} title="Pídele una foto">📷</button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Escríbele a ${character.name}…`}
          style={textInput}
        />
        <button onClick={send} disabled={busy} style={sendBtn}>➤</button>
      </div>
    </div>
  );
}

// --- estilos ---
const Center = ({ children }) => (
  <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>{children}</div>
);
const card = { background: '#16131f', border: '1px solid #2a2438', borderRadius: 20, padding: 24, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.4)' };
const btnPrimary = { marginTop: 16, width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' };
const charCard = { background: '#1c1828', border: '1px solid #2a2438', borderRadius: 16, padding: 16, cursor: 'pointer', color: '#f4f2f8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #221d30', background: '#100e18' };
const backBtn = { fontSize: 26, background: 'none', border: 'none', color: '#f4f2f8', cursor: 'pointer', lineHeight: 1 };
const select = { background: '#1c1828', color: '#f4f2f8', border: '1px solid #2a2438', borderRadius: 10, padding: '6px 8px', fontSize: 12 };
const chatArea = { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 };
const bubbleBase = { padding: '10px 14px', borderRadius: 18, maxWidth: '78%', lineHeight: 1.4, fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
const bubbleUser = { ...bubbleBase, background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', borderBottomRightRadius: 6 };
const bubbleAI = { ...bubbleBase, background: '#1c1828', border: '1px solid #2a2438', borderBottomLeftRadius: 6 };
const photoBubble = { maxWidth: '60%', borderRadius: 18, borderBottomLeftRadius: 6, border: '1px solid #2a2438' };
const photoBtn = { width: 46, borderRadius: '50%', border: '1px solid #2a2438', background: '#1c1828', fontSize: 18, cursor: 'pointer' };
const metaBar = { fontSize: 11, opacity: 0.55, padding: '4px 14px', textAlign: 'center' };
const inputBar = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #221d30', background: '#100e18', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' };
const textInput = { flex: 1, background: '#1c1828', border: '1px solid #2a2438', borderRadius: 22, padding: '12px 16px', color: '#f4f2f8', fontSize: 15, outline: 'none' };
const sendBtn = { width: 46, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#b043ff,#ff4d8d)', color: '#fff', fontSize: 18, cursor: 'pointer' };
