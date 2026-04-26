// ===== Estado y referencias =====
const $ = (id) => document.getElementById(id);
const els = {
  league: $('league'),
  home: $('home'),
  away: $('away'),
  preview: $('preview'),
  previewHome: $('preview-home'),
  previewAway: $('preview-away'),
  btnPredict: $('btn-predict'),
  btnClear: $('btn-clear'),
  btnConfig: $('btn-config'),
  modal: $('modal'),
  apiKey: $('api-key'),
  model: $('model'),
  btnSave: $('btn-save'),
  btnCancel: $('btn-cancel'),
  status: $('status'),
  resultCard: $('result-card'),
  result: $('result')
};

const STORAGE_KEY = 'football_predictor_config';

// ===== Configuración (API key + modelo) =====
function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function openModal() {
  const cfg = loadConfig();
  els.apiKey.value = cfg.apiKey || '';
  els.model.value = cfg.model || 'claude-sonnet-4-6';
  els.modal.classList.add('visible');
}

function closeModal() {
  els.modal.classList.remove('visible');
}

els.btnConfig.addEventListener('click', openModal);
els.btnCancel.addEventListener('click', closeModal);
els.btnSave.addEventListener('click', () => {
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value;
  if (!apiKey.startsWith('sk-ant-')) {
    alert('La API key debe empezar con "sk-ant-".');
    return;
  }
  saveConfig({ apiKey, model });
  closeModal();
  showStatus('Configuración guardada.', 'loading');
  setTimeout(() => hideStatus(), 1500);
});

els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});

// ===== Selectores de liga / equipos =====
function populateLeagues() {
  for (const [key, league] of Object.entries(LEAGUES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = league.name;
    els.league.appendChild(opt);
  }
}

function populateTeams(selectEl, teams, exclude) {
  selectEl.innerHTML = '<option value="">— Selecciona equipo —</option>';
  teams.forEach((t) => {
    if (t === exclude) return;
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectEl.appendChild(opt);
  });
  selectEl.disabled = false;
}

els.league.addEventListener('change', () => {
  const key = els.league.value;
  if (!key) {
    els.home.disabled = true;
    els.away.disabled = true;
    els.home.innerHTML = '<option>—</option>';
    els.away.innerHTML = '<option>—</option>';
    updateState();
    return;
  }
  const teams = LEAGUES[key].teams;
  populateTeams(els.home, teams);
  populateTeams(els.away, teams);
  updateState();
});

els.home.addEventListener('change', () => {
  const key = els.league.value;
  if (key) populateTeams(els.away, LEAGUES[key].teams, els.home.value);
  updateState();
});

els.away.addEventListener('change', updateState);

function updateState() {
  const home = els.home.value;
  const away = els.away.value;
  if (home && away && home !== away) {
    els.preview.style.display = 'flex';
    els.previewHome.textContent = home;
    els.previewAway.textContent = away;
    els.btnPredict.disabled = false;
  } else {
    els.preview.style.display = 'none';
    els.btnPredict.disabled = true;
  }
}

els.btnClear.addEventListener('click', () => {
  els.league.value = '';
  els.home.innerHTML = '<option>—</option>';
  els.away.innerHTML = '<option>—</option>';
  els.home.disabled = true;
  els.away.disabled = true;
  els.resultCard.classList.remove('visible');
  hideStatus();
  updateState();
});

// ===== UI helpers =====
function showStatus(msg, type = 'loading') {
  els.status.className = type;
  els.status.innerHTML = type === 'loading'
    ? `<span class="spinner"></span>${msg}`
    : msg;
}

function hideStatus() {
  els.status.className = '';
  els.status.innerHTML = '';
}

// Markdown -> HTML mínimo (encabezados, negritas, listas, links, código)
function renderMarkdown(md) {
  // Escapar HTML primero
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Encabezados
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Negritas y cursivas
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Código inline
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links [texto](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Listas no ordenadas
  html = html.replace(/(^|\n)((?:[-*] .+\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^[-*]\s+/, ''));
    return pre + '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
  });

  // Listas ordenadas
  html = html.replace(/(^|\n)((?:\d+\.\s.+\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s+/, ''));
    return pre + '<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
  });

  // Párrafos: dividir por dobles saltos
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(b => {
    if (/^\s*<(h2|h3|ul|ol|p)/.test(b)) return b;
    if (b.trim() === '') return '';
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return html;
}

// ===== Llamada a la API de Claude =====
const SYSTEM_PROMPT = `Eres un analista deportivo profesional especializado en fútbol. Tu trabajo es generar pronósticos detallados, honestos y bien fundamentados para partidos de fútbol.

REGLAS CRÍTICAS:
1. Usa la herramienta de búsqueda web para obtener datos REALES y actualizados. NO inventes estadísticas.
2. Si no encuentras información sobre algo (ej. lesiones, alineación), dilo explícitamente. Es preferible decir "no hay datos confirmados" que inventar.
3. Sé honesto sobre la incertidumbre. NUNCA prometas certeza del 99% o 100%. El fútbol tiene factores impredecibles.
4. Cita las fuentes consultadas al final.

DATOS QUE DEBES BUSCAR:
- Forma reciente de ambos equipos (últimos 5-10 partidos: V/E/D, goles a favor/en contra)
- Posición en la tabla y rendimiento como local/visitante
- Historial de enfrentamientos directos (H2H) recientes
- Lesiones, sanciones y bajas confirmadas para este partido
- Estadísticas ofensivas y defensivas (promedio de goles, xG si está disponible)
- Cuotas de las casas de apuestas si están disponibles (te da idea del consenso del mercado)
- Contexto: jornada, importancia, motivación, rachas

FORMATO DE RESPUESTA (Markdown estricto):

## 🎯 Marcador más probable
**[Equipo Local] X - Y [Equipo Visitante]**

Breve justificación del marcador (1-2 frases).

## 📊 Probabilidades 1X2
- Victoria local: XX%
- Empate: XX%
- Victoria visitante: XX%

(Las tres deben sumar 100%)

## ⚽ Mercados adicionales
- **Over/Under 2.5 goles:** [Recomendación] (probabilidad estimada)
- **Ambos equipos anotan (BTTS):** Sí/No (probabilidad)
- **Hándicap asiático sugerido:** [Ej: Local -0.5, Visitante +1.5]
- **Doble oportunidad recomendada:** [1X / X2 / 12]
- **Córners totales (estimado):** [rango]
- **Tarjetas totales (estimado):** [rango]

## 🔍 Análisis fundamentado

### Forma reciente
[Resumen real de los últimos partidos de cada equipo con datos]

### Estadísticas clave
[Goles promedio, defensa, posición en tabla, rendimiento local/visitante]

### Bajas e información del partido
[Lesionados, sancionados, regresos. Si no hay datos confirmados, decirlo]

### Historial directo (H2H)
[Últimos enfrentamientos con resultados]

### Factores contextuales
[Motivación, racha, presión, contexto de la jornada]

## 💡 Apuestas sugeridas (con nivel de confianza)

1. **[Apuesta]** — Confianza: 🟢 Alta / 🟡 Media / 🔴 Baja
   - Razón: [justificación con datos]
2. ...
3. ...

(Máximo 4 sugerencias. Sé selectivo.)

## ⚠️ Riesgos y factores impredecibles
[Lista breve de cosas que podrían cambiar el pronóstico: lesión de última hora, cambio táctico, clima, etc.]

## 📚 Fuentes consultadas
[Lista de URLs reales que citaste]

---
**Recordatorio:** Este pronóstico es un análisis estadístico, no una garantía. Apuesta con responsabilidad.`;

async function generatePrediction(league, home, away) {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    showStatus('Primero configura tu Anthropic API key (botón ⚙️ arriba).', 'error');
    return;
  }

  const userPrompt = `Genera un pronóstico detallado para el siguiente partido:

**Liga:** ${LEAGUES[league].name}
**Local:** ${home}
**Visitante:** ${away}

Busca en la web información actualizada sobre el próximo partido entre estos equipos (o el más reciente programado). Quiero un análisis riguroso, sin invención. Si algún dato no está disponible, dilo. Sigue exactamente el formato Markdown indicado en tus instrucciones.`;

  showStatus('Buscando estadísticas en la web y analizando... (puede tardar 20-60 segundos)', 'loading');
  els.btnPredict.disabled = true;
  els.resultCard.classList.remove('visible');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: cfg.model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 8
          }
        ],
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();

    // Concatenar todos los bloques de texto de la respuesta final
    const finalText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n\n');

    if (!finalText.trim()) {
      throw new Error('La respuesta del modelo vino vacía.');
    }

    els.result.innerHTML = renderMarkdown(finalText);
    els.resultCard.classList.add('visible');
    hideStatus();
    els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    showStatus(`❌ ${err.message}. Verifica tu API key, conexión y créditos en la consola de Anthropic.`, 'error');
  } finally {
    els.btnPredict.disabled = false;
  }
}

els.btnPredict.addEventListener('click', () => {
  const league = els.league.value;
  const home = els.home.value;
  const away = els.away.value;
  if (!league || !home || !away) return;
  generatePrediction(league, home, away);
});

// ===== Init =====
populateLeagues();

// Si no hay API key, abrir modal automáticamente
window.addEventListener('load', () => {
  if (!loadConfig().apiKey) {
    setTimeout(openModal, 400);
  }
});
