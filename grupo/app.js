/* Grupo CUN — la app del grupo de estudio.
   Página de una sola vista (rutas con #) que habla con /api/grupo (Netlify Function). */
(function () {
  "use strict";

  const API = "/api/grupo";
  const TZ = "America/Bogota";
  const TIPOS = { entrega: "Entrega", parcial: "Parcial / examen", reunion: "Reunión", clase: "Clase / sesión", otro: "Otro" };
  const CATEGORIAS = { solucion: "Solución de parcial", entrega: "Entrega / trabajo", material: "Material de clase", guia: "Guía / enunciado", otro: "Otro" };
  const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const $app = document.getElementById("app");
  const guardado = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  let token = guardado.get("grupo-token");
  let D = null;          // datos del servidor
  let pantalla = "";     // modo previo a entrar: sin-grupo | entrar | registro

  /* ------------------------------------------------------------ utilidades */

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enlazar = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => {
    const corto = u.length > 45 ? u.slice(0, 42) + "…" : u;
    return `<a href="${u}" target="_blank" rel="noopener">${corto}</a>`;
  });
  const primerNombre = (u) => (u && u.nombre ? u.nombre.split(" ")[0] : "—");
  const usuario = (uid) => (D && D.usuarios[uid]) || null;

  // Partes de una fecha vistas en hora de Colombia
  const fmtPartes = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  function partes(d) {
    const p = {};
    for (const x of fmtPartes.formatToParts(d)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day, h: p.hour, min: p.minute, dia: `${p.year}-${p.month}-${p.day}` };
  }
  const hoyStr = () => partes(new Date()).dia;
  function diaSemana(diaStr) { // 0 = lunes
    const [y, m, d] = diaStr.split("-").map(Number);
    return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  }
  function fmtFecha(iso) {
    const p = partes(new Date(iso));
    let h = +p.h % 12 || 12;
    return `${DIAS[diaSemana(p.dia)]} ${p.d} de ${MESES[p.m - 1]}, ${h}:${p.min} ${+p.h < 12 ? "a. m." : "p. m."}`;
  }
  function relativo(iso) {
    const s = (new Date(iso) - Date.now()) / 1000, a = Math.abs(s);
    let t;
    if (a < 3600) t = `${Math.max(1, Math.floor(a / 60))} min`;
    else if (a < 86400) t = `${Math.floor(a / 3600)} h`;
    else { const d = Math.floor(a / 86400); t = `${d} día${d !== 1 ? "s" : ""}`; }
    return s < 0 ? `hace ${t}` : `en ${t}`;
  }
  function estado(f) {
    if (f.listo) return "hecho";
    const ms = new Date(f.cuando) - Date.now();
    if (ms < 0) return "vencido";
    if (partes(new Date(f.cuando)).dia === hoyStr()) return "hoy";
    if (ms <= 3 * 864e5) return "pronto";
    if (ms <= 7 * 864e5) return "semana";
    return "luego";
  }
  const tamano = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  function waLink(u) {
    let d = String(u.whatsapp || u.telefono || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 10) d = "57" + d;
    return "https://wa.me/" + d;
  }
  const valorLocal = (iso) => { const p = partes(new Date(iso)); return `${p.dia}T${p.h}:${p.min}`; };

  function alarmas() {
    const ahora = Date.now();
    return D.fechas.filter((f) => !f.listo && new Date(f.cuando) >= ahora - 7 * 864e5 && new Date(f.cuando) <= ahora + 7 * 864e5)
      .sort((a, b) => new Date(a.cuando) - new Date(b.cuando));
  }
  const urgentes = () => alarmas().filter((f) => ["vencido", "hoy", "pronto"].includes(estado(f))).length;

  function aviso(msg, error) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast" + (error ? " error" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), error ? 5000 : 2500);
  }

  /* ------------------------------------------------------------ servidor */

  async function llamar(metodo, cuerpo, ruta = "", tipo = "application/json") {
    const headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (cuerpo !== undefined) headers["Content-Type"] = tipo;
    const r = await fetch(API + ruta, {
      method: metodo, headers, cache: "no-store",
      body: cuerpo === undefined ? undefined : tipo === "application/json" ? JSON.stringify(cuerpo) : cuerpo,
    });
    let json = {};
    try { json = await r.json(); } catch (e) {}
    if (r.status === 401 && token && !["entrar"].includes(cuerpo && cuerpo.op)) { cerrarSesion(); throw new Error(json.error || "Tu sesión expiró."); }
    if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
    return json;
  }

  function recibir(json) {
    if (json.token) { token = json.token; guardado.set("grupo-token", token); }
    if (json.estado === "ok") D = json;
    else { D = null; pantalla = json.estado; }
    if (json.grupo) document.title = json.grupo.nombre;
  }

  async function op(datos, ok) {
    const r = await llamar("POST", datos);
    recibir(r);
    if (ok) aviso(ok);
    pintar();
    return r;
  }

  async function cargar() {
    try {
      recibir(await llamar("GET"));
    } catch (e) {
      $app.innerHTML = `<main class="container"><div class="card center"><h2>No se pudo conectar</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div></main>`;
      return;
    }
    pintar();
  }

  function cerrarSesion() {
    token = null; D = null; pantalla = "entrar";
    guardado.del("grupo-token");
  }

  /* ------------------------------------------------------------ piezas */

  function pill(f) {
    const st = estado(f);
    const t = { hecho: "✔ Listo", vencido: "⚠ Vencido", hoy: "⏰ Hoy", pronto: "🔥 " + relativo(f.cuando) }[st] || relativo(f.cuando);
    return `<span class="pill st-${st}">${t}</span>`;
  }

  function filaFecha(f) {
    const n = D.comentarios.filter((c) => c.fecha === f.id).length;
    return `<li class="event-row st-${estado(f)}">
      <div class="kind k-${f.tipo}">${TIPOS[f.tipo]}</div>
      <div class="grow">
        <a class="title" href="#/fecha/${f.id}">${esc(f.titulo)}</a>
        <div class="muted small">🗓️ ${fmtFecha(f.cuando)}${f.materia ? " · 📚 " + esc(f.materia) : ""}${n ? " · 💬 " + n : ""}</div>
      </div>
      ${pill(f)}
      <button class="icon-btn" data-act="fecha-listo" data-id="${f.id}" title="${f.listo ? "Marcar pendiente" : "Marcar como listo"}">${f.listo ? "↺" : "✔"}</button>
    </li>`;
  }

  function urlArchivo(r, descargar) {
    return `${API}/archivo/${r.id}?t=${encodeURIComponent(token)}${descargar ? "&descargar=1" : ""}`;
  }

  function filaRecurso(r, borrable) {
    const icono = r.tipo === "link" ? "🔗" : r.mime.startsWith("image/") ? "🖼️" : r.mime === "application/pdf" ? "📕" : "📄";
    const href = r.tipo === "link" ? r.url : urlArchivo(r);
    return `<li class="res-row">
      <div class="res-icon">${icono}</div>
      <div class="grow">
        <a class="title" href="${esc(href)}" target="_blank" rel="noopener">${esc(r.titulo)}</a>
        <div class="muted small">${CATEGORIAS[r.categoria]}${r.materia ? " · 📚 " + esc(r.materia) : ""}${r.tipo === "archivo" ? " · " + tamano(r.tamano) : ""} · ${esc(primerNombre(usuario(r.por)))}, ${relativo(r.creado)}</div>
        ${r.nota ? `<div class="small">${enlazar(r.nota)}</div>` : ""}
      </div>
      ${r.tipo === "archivo" ? `<a class="icon-btn" href="${esc(urlArchivo(r, true))}" title="Descargar">⬇</a>` : ""}
      ${borrable ? `<button class="icon-btn danger" data-act="recurso-borrar" data-id="${r.id}" title="Eliminar">🗑</button>` : ""}
    </li>`;
  }

  function post(c) {
    return `<div class="post ${c.fijado ? "pinned" : ""}">
      <div class="post-head">
        <strong>${esc(primerNombre(usuario(c.por)))}</strong>
        <span class="muted small">${relativo(c.creado)}${c.fijado ? " · 📌 fijado" : ""}</span>
        <span class="grow"></span>
        ${c.fecha ? "" : `<button class="link-btn small" data-act="fijar" data-id="${c.id}">${c.fijado ? "Desfijar" : "Fijar"}</button>`}
        ${c.por === D.yo ? `<button class="link-btn small danger" data-act="comentario-borrar" data-id="${c.id}">Borrar</button>` : ""}
      </div>
      <div class="post-body">${enlazar(c.texto)}</div>
    </div>`;
  }

  const materias = () => [...new Set([...D.fechas.map((f) => f.materia), ...D.recursos.map((r) => r.materia)].filter(Boolean))].sort();
  const listaMaterias = () => `<datalist id="materias">${materias().map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`;

  /* ------------------------------------------------------------ vistas sin sesión */

  function vistaSinGrupo() {
    return `<div class="auth">
      <h1>🎓 Crear el grupo</h1>
      <p class="muted">Eres la primera persona en entrar. Ponle nombre al grupo y escoge el <strong>código</strong>
        que los demás usarán para registrarse (pásalo solo por el chat del grupo).</p>
      <form class="card form" data-form="crear-grupo">
        <label>Nombre del grupo <input name="grupo" value="Grupo CUN" required maxlength="60"></label>
        <label>Código del grupo <input name="codigo" required minlength="4" placeholder="ej. cun-gerencia-2026"></label>
        <hr>
        <label>Tu nombre completo <input name="nombre" required></label>
        <label>Usuario (para entrar) <input name="usuario" required autocomplete="username" placeholder="ej. laura.g"></label>
        <label>Contraseña <input name="clave" type="password" minlength="6" required autocomplete="new-password"></label>
        <label>WhatsApp <input name="whatsapp" placeholder="3001234567"></label>
        <button class="btn">Crear grupo y entrar</button>
      </form>
    </div>`;
  }

  function vistaEntrar() {
    return `<div class="auth">
      <h1>🎓 ${esc(document.title)}</h1>
      <p class="muted">Fechas, entregas, archivos y contactos del grupo, en un solo lugar.</p>
      <form class="card form" data-form="entrar">
        <label>Usuario <input name="usuario" autocomplete="username" required autofocus></label>
        <label>Contraseña <input name="clave" type="password" autocomplete="current-password" required></label>
        <button class="btn">Entrar</button>
      </form>
      <p class="center">¿Primera vez? <a href="#" data-act="ir-registro">Crea tu cuenta con el código del grupo</a></p>
    </div>`;
  }

  function vistaRegistro() {
    return `<div class="auth">
      <h1>Crear cuenta</h1>
      <p class="muted">Necesitas el <strong>código del grupo</strong>; así nadie de afuera puede entrar.</p>
      <form class="card form" data-form="registro">
        <label>Código del grupo <input name="codigo" required></label>
        <label>Tu nombre completo <input name="nombre" required></label>
        <label>Usuario (para entrar) <input name="usuario" autocomplete="username" required placeholder="ej. laura.g"></label>
        <label>Contraseña <input name="clave" type="password" minlength="6" autocomplete="new-password" required></label>
        <label>Correo <input name="correo" type="email"></label>
        <label>WhatsApp <input name="whatsapp" placeholder="3001234567"></label>
        <button class="btn">Crear cuenta</button>
      </form>
      <p class="center"><a href="#" data-act="ir-entrar">Ya tengo cuenta</a></p>
    </div>`;
  }

  /* ------------------------------------------------------------ vistas con sesión */

  function vistaInicio() {
    const yo = usuario(D.yo);
    const al = alarmas();
    const ahora = Date.now();
    const despues = D.fechas.filter((f) => !f.listo && new Date(f.cuando) > ahora + 7 * 864e5)
      .sort((a, b) => new Date(a.cuando) - new Date(b.cuando)).slice(0, 5);
    const hoy = hoyStr();
    const [hy, hm, hd] = hoy.split("-").map(Number);
    const hoyUTC = Date.UTC(hy, hm - 1, hd);
    const cumples = Object.values(D.usuarios).filter((u) => u.cumple).map((u) => {
      const [, m, d] = u.cumple.split("-").map(Number);
      let t = Date.UTC(hy, m - 1, d);
      if (t < hoyUTC) t = Date.UTC(hy + 1, m - 1, d);
      return { u, dias: Math.round((t - hoyUTC) / 864e5), d, m };
    }).filter((x) => x.dias <= 14).sort((a, b) => a.dias - b.dias);
    const muro = D.comentarios.filter((c) => !c.fecha);
    const fijados = muro.filter((c) => c.fijado).reverse();
    const recientes = muro.filter((c) => !c.fijado).slice(-4).reverse();
    const ultimos = D.recursos.slice(-5).reverse();

    return `<div class="page-head">
        <h1>Hola, ${esc(primerNombre(yo))} 👋</h1>
        <div class="actions"><a class="btn" href="#/nueva">+ Fecha / entrega</a><a class="btn ghost" href="#/archivos">+ Archivo o link</a></div>
      </div>
      <section class="card">
        <h2>🔔 Alarmas</h2>
        ${al.length ? `<ul class="list">${al.map(filaFecha).join("")}</ul>` : `<p class="muted">Nada pendiente en los próximos 7 días. 🎉</p>`}
        ${despues.length ? `<h3>Más adelante</h3><ul class="list compact">${despues.map(filaFecha).join("")}</ul>` : ""}
        <p class="small"><a href="#/fechas">Ver todas las fechas →</a></p>
      </section>
      ${cumples.length ? `<section class="card"><h2>🎂 Cumpleaños cercanos</h2><ul class="plain">${cumples.map((c) => `<li><strong>${esc(c.u.nombre)}</strong> — ${c.d}/${c.m}
        ${c.dias === 0 ? `<span class="pill st-hoy">¡Hoy!</span>` : `<span class="muted small">en ${c.dias} día${c.dias !== 1 ? "s" : ""}</span>`}
        ${waLink(c.u) ? ` · <a href="${waLink(c.u)}" target="_blank" rel="noopener">Felicitar por WhatsApp</a>` : ""}</li>`).join("")}</ul></section>` : ""}
      <div class="grid2">
        <section class="card"><h2>📌 Muro</h2>
          ${fijados.concat(recientes).map(post).join("") || `<p class="muted">Todavía no hay mensajes.</p>`}
          <p class="small"><a href="#/muro">Ir al muro →</a></p></section>
        <section class="card"><h2>📂 Lo último subido</h2>
          ${ultimos.length ? `<ul class="list">${ultimos.map((r) => filaRecurso(r)).join("")}</ul>` : `<p class="muted">Aún no hay archivos ni links.</p>`}
          <p class="small"><a href="#/archivos">Ver biblioteca →</a></p></section>
      </div>`;
  }

  function vistaFechas(q) {
    const ver = q.get("ver") || "pendientes", tipo = q.get("tipo") || "";
    const ahora = Date.now();
    let lista = D.fechas.slice();
    if (ver === "pendientes") lista = lista.filter((f) => !f.listo).sort((a, b) => new Date(a.cuando) - new Date(b.cuando));
    else if (ver === "pasadas") lista = lista.filter((f) => f.listo || new Date(f.cuando) < ahora).sort((a, b) => new Date(b.cuando) - new Date(a.cuando));
    else lista.sort((a, b) => new Date(b.cuando) - new Date(a.cuando));
    if (tipo) lista = lista.filter((f) => f.tipo === tipo);
    const chip = (v, t, label) => `<a class="chip ${ver === v && tipo === t ? "on" : ""}" href="#/fechas?ver=${v}${t ? "&tipo=" + t : ""}">${label}</a>`;
    return `<div class="page-head"><h1>🗓️ Fechas y entregas</h1><div class="actions"><a class="btn" href="#/nueva">+ Nueva fecha</a></div></div>
      <div class="filters">
        ${[["pendientes", "Pendientes"], ["pasadas", "Pasadas / listas"], ["todas", "Todas"]].map(([v, l]) => `<a class="chip ${ver === v ? "on" : ""}" href="#/fechas?ver=${v}${tipo ? "&tipo=" + tipo : ""}">${l}</a>`).join("")}
        <span class="sep"></span>
        ${chip(ver, "", "Todo tipo")}${Object.entries(TIPOS).map(([k, l]) => chip(ver, k, l)).join("")}
      </div>
      <section class="card">${lista.length ? `<ul class="list">${lista.map(filaFecha).join("")}</ul>` : `<p class="muted">No hay fechas aquí. <a href="#/nueva">Agrega la primera</a>.</p>`}</section>`;
  }

  function vistaFormFecha(idFecha) {
    const f = idFecha ? D.fechas.find((x) => x.id === idFecha) : null;
    if (idFecha && !f) return vistaNoEncontrado();
    const def = new Date(Date.now() + 7 * 864e5);
    const pd = partes(def);
    const cuando = f ? valorLocal(f.cuando) : `${pd.dia}T23:59`;
    return `<h1>${f ? "Editar fecha" : "Nueva fecha o entrega"}</h1>
      <form class="card form" data-form="fecha">
        ${f ? `<input type="hidden" name="id" value="${f.id}">` : ""}
        <label>Título <input name="titulo" required maxlength="200" value="${esc(f ? f.titulo : "")}" placeholder="ej. Taller 2 de Estadística"></label>
        <div class="row">
          <label>Tipo <select name="tipo">${Object.entries(TIPOS).map(([k, l]) => `<option value="${k}" ${(f ? f.tipo : "entrega") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Fecha y hora límite <input type="datetime-local" name="cuando" required value="${cuando}"></label>
        </div>
        <label>Materia / módulo <input name="materia" list="materias" value="${esc(f ? f.materia : "")}"></label>
        ${listaMaterias()}
        <label>Detalles <textarea name="detalle" rows="5" placeholder="Qué hay que entregar, quién hace qué, formato, etc.">${esc(f ? f.detalle : "")}</textarea></label>
        <label>Link (plataforma, enunciado, Drive…) <input name="link" value="${esc(f ? f.link : "")}" placeholder="https://"></label>
        <div class="actions"><button class="btn">Guardar</button><a class="btn ghost" href="${f ? "#/fecha/" + f.id : "#/fechas"}">Cancelar</a></div>
      </form>`;
  }

  function googleCal(f) {
    const ini = new Date(f.cuando), fin = new Date(ini.getTime() + 3600e3);
    const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const p = new URLSearchParams({ action: "TEMPLATE", text: `[${D.grupo.nombre}] ${f.titulo}`, dates: `${z(ini)}/${z(fin)}`, details: [f.detalle, f.link].filter(Boolean).join("\n\n") });
    return "https://calendar.google.com/calendar/render?" + p;
  }
  function waCompartir(f) {
    let t = `📌 *${TIPOS[f.tipo]}: ${f.titulo}*\n🗓️ ${fmtFecha(f.cuando)}`;
    if (f.materia) t += `\n📚 ${f.materia}`;
    if (f.link) t += `\n🔗 ${f.link}`;
    t += `\n\n${location.origin}${location.pathname}#/fecha/${f.id}`;
    return "https://wa.me/?text=" + encodeURIComponent(t);
  }

  function vistaFecha(idFecha) {
    const f = D.fechas.find((x) => x.id === idFecha);
    if (!f) return vistaNoEncontrado();
    const coms = D.comentarios.filter((c) => c.fecha === f.id);
    const st = estado(f);
    return `<p class="small"><a href="#/fechas">← Fechas</a></p>
      <section class="card event-detail st-${st}">
        <div class="page-head"><div><span class="kind k-${f.tipo}">${TIPOS[f.tipo]}</span><h1>${esc(f.titulo)}</h1></div>${pill(f)}</div>
        <p class="big">🗓️ ${fmtFecha(f.cuando)}</p>
        ${f.materia ? `<p>📚 ${esc(f.materia)}</p>` : ""}
        ${f.detalle ? `<div class="desc">${enlazar(f.detalle)}</div>` : ""}
        ${f.link ? `<p>🔗 <a href="${esc(f.link)}" target="_blank" rel="noopener">${esc(f.link)}</a></p>` : ""}
        <p class="muted small">Agregada por ${esc(usuario(f.por) ? usuario(f.por).nombre : "—")}, ${relativo(f.creado)}</p>
        <div class="actions wrap">
          <button class="btn" data-act="fecha-listo" data-id="${f.id}">${f.listo ? "↺ Marcar pendiente" : "✔ Marcar como listo"}</button>
          <a class="btn ghost" href="${esc(googleCal(f))}" target="_blank" rel="noopener">📅 Agregar a mi Google Calendar</a>
          <a class="btn ghost" href="${esc(waCompartir(f))}" target="_blank" rel="noopener">💬 Avisar por WhatsApp</a>
          <a class="btn ghost" href="#/editar/${f.id}">✏️ Editar</a>
          <button class="btn ghost danger" data-act="fecha-borrar" data-id="${f.id}">🗑 Borrar</button>
        </div>
      </section>
      <section class="card" id="comentarios"><h2>💬 Comentarios</h2>
        ${coms.map(post).join("") || `<p class="muted">Sin comentarios todavía.</p>`}
        <form class="form" data-form="comentar">
          <input type="hidden" name="fecha" value="${f.id}">
          <textarea name="texto" rows="3" required placeholder="Ej: yo hago la introducción, ¿alguien toma el punto 3?"></textarea>
          <button class="btn">Comentar</button>
        </form>
      </section>`;
  }

  function vistaCalendario(q) {
    const hoy = hoyStr();
    let y = +q.get("y") || +hoy.slice(0, 4), m = +q.get("m") || +hoy.slice(5, 7);
    if (m < 1 || m > 12) m = +hoy.slice(5, 7);
    const pad = (n) => String(n).padStart(2, "0");
    const primero = `${y}-${pad(m)}-01`;
    const inicio = Date.UTC(y, m - 1, 1) - diaSemana(primero) * 864e5;
    const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const semanas = Math.ceil((diaSemana(primero) + ultimoDia) / 7);
    const porDia = {};
    for (const f of D.fechas) (porDia[partes(new Date(f.cuando)).dia] ||= []).push(f);
    Object.values(porDia).forEach((l) => l.sort((a, b) => new Date(a.cuando) - new Date(b.cuando)));
    let celdas = "";
    for (let i = 0; i < semanas * 7; i++) {
      const d = new Date(inicio + i * 864e5);
      const ds = d.toISOString().slice(0, 10);
      celdas += `<div class="cal-day ${d.getUTCMonth() + 1 !== m ? "other" : ""} ${ds === hoy ? "today" : ""}">
        <div class="cal-num">${d.getUTCDate()}</div>
        ${(porDia[ds] || []).map((f) => `<a class="cal-ev k-${f.tipo} st-${estado(f)}" href="#/fecha/${f.id}" title="${esc(f.titulo)}">${partes(new Date(f.cuando)).h}:${partes(new Date(f.cuando)).min} ${esc(f.titulo)}</a>`).join("")}
      </div>`;
    }
    const ant = m === 1 ? [y - 1, 12] : [y, m - 1], sig = m === 12 ? [y + 1, 1] : [y, m + 1];
    const feed = `${location.origin}${API}/calendario/${D.grupo.calendario}.ics`;
    return `<div class="page-head"><h1>📆 ${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} ${y}</h1>
        <div class="actions">
          <a class="btn ghost" href="#/calendario?y=${ant[0]}&m=${ant[1]}">←</a>
          <a class="btn ghost" href="#/calendario">Hoy</a>
          <a class="btn ghost" href="#/calendario?y=${sig[0]}&m=${sig[1]}">→</a>
          <a class="btn" href="#/nueva">+ Fecha</a>
        </div></div>
      <div class="calendar">${DIAS.map((d) => `<div class="cal-head">${d}</div>`).join("")}${celdas}</div>
      <section class="card"><h2>📲 Alarmas en el celular</h2>
        <p>Para que las fechas del grupo lleguen como recordatorio a tu celular, suscríbete a este calendario (se actualiza solo cuando alguien agrega una fecha):</p>
        <div class="copy-row"><input readonly value="${esc(feed)}" id="feed-url"><button class="btn small" data-act="copiar" data-target="#feed-url">Copiar</button></div>
        <ul class="small">
          <li><strong>Google Calendar:</strong> desde un computador, en calendar.google.com → «Otros calendarios» → <em>+</em> → «Desde URL» → pega el enlace. Luego aparece en el celular.</li>
          <li><strong>iPhone:</strong> Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → «Añadir calendario suscrito».</li>
          <li><strong>Outlook:</strong> Agregar calendario → Suscribirse desde la web.</li>
        </ul>
        <p class="muted small">Google tarda algunas horas en refrescar calendarios suscritos. Para algo urgente usa el botón «Agregar a mi Google Calendar» dentro de cada fecha. No compartas este enlace fuera del grupo.</p>
      </section>`;
  }

  function vistaArchivos(q) {
    const cat = q.get("cat") || "", tipo = q.get("tipo") || "", mat = q.get("materia") || "", txt = (q.get("q") || "").toLowerCase();
    let lista = D.recursos.slice().reverse();
    if (cat) lista = lista.filter((r) => r.categoria === cat);
    if (tipo) lista = lista.filter((r) => r.tipo === tipo);
    if (mat) lista = lista.filter((r) => r.materia === mat);
    if (txt) lista = lista.filter((r) => [r.titulo, r.nota, r.nombre, r.url].join(" ").toLowerCase().includes(txt));
    const mats = materias();
    const max = (D.maxArchivo / 1048576).toFixed(0);
    return `<h1>📂 Archivos y links</h1>
      <section class="card" id="subir"><h2>Subir algo para el grupo</h2>
        <form class="form" data-form="subir">
          <div class="tabs">
            <label class="tab"><input type="radio" name="modo" value="archivo" checked> 📄 Archivo</label>
            <label class="tab"><input type="radio" name="modo" value="link"> 🔗 Link</label>
          </div>
          <label data-modo="archivo">Archivo (máx. ${max} MB; lo más pesado, súbelo a Drive y pega el link) <input type="file" name="archivo"></label>
          <label data-modo="link" hidden>Link <input name="url" placeholder="https://drive.google.com/…"></label>
          <div class="row">
            <label>Nombre <input name="titulo" maxlength="200" placeholder="Si lo dejas vacío usamos el del archivo"></label>
            <label>Categoría <select name="categoria">${Object.entries(CATEGORIAS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
          </div>
          <label>Materia / módulo <input name="materia" list="materias"></label>
          ${listaMaterias()}
          <label>Nota (opcional) <input name="nota" placeholder="ej. Parcial 1 corregido, ojo con el punto 4"></label>
          <button class="btn">Subir</button>
        </form>
      </section>
      <form class="filters" data-form="filtrar">
        <input name="q" value="${esc(q.get("q") || "")}" placeholder="Buscar…" class="search">
        <select name="cat"><option value="">Todas las categorías</option>${Object.entries(CATEGORIAS).map(([k, l]) => `<option value="${k}" ${cat === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select name="tipo"><option value="">Archivos y links</option><option value="archivo" ${tipo === "archivo" ? "selected" : ""}>Solo archivos</option><option value="link" ${tipo === "link" ? "selected" : ""}>Solo links</option></select>
        ${mats.length ? `<select name="materia"><option value="">Todas las materias</option>${mats.map((x) => `<option ${mat === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>` : ""}
        <button class="btn small">Filtrar</button>
      </form>
      <section class="card">${lista.length ? `<ul class="list">${lista.map((r) => filaRecurso(r, true)).join("")}</ul>` : `<p class="muted">No hay nada con ese filtro.</p>`}</section>`;
  }

  function vistaMuro() {
    const posts = D.comentarios.filter((c) => !c.fecha).slice().reverse().sort((a, b) => (b.fijado ? 1 : 0) - (a.fijado ? 1 : 0));
    return `<h1>📌 Muro del grupo</h1>
      <p class="muted">Avisos, acuerdos, ideas. Fija lo importante para que salga en el inicio.</p>
      <section class="card"><form class="form" data-form="comentar">
        <textarea name="texto" rows="3" required placeholder="Escribe un mensaje para el grupo…"></textarea>
        <div class="actions"><label class="check"><input type="checkbox" name="fijado" value="1"> Fijar en el inicio</label><button class="btn">Publicar</button></div>
      </form></section>
      <section class="card">${posts.map(post).join("") || `<p class="muted">Sé el primero en escribir.</p>`}</section>`;
  }

  function vistaIntegrantes() {
    const lista = Object.values(D.usuarios).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return `<div class="page-head"><h1>👥 Integrantes</h1><div class="actions"><a class="btn ghost" href="#/perfil">Editar mis datos</a></div></div>
      <p class="muted small">Solo las personas con cuenta en la app ven estos datos.</p>
      <div class="members">${lista.map((u) => `<div class="card member">
        <div class="avatar">${esc(u.nombre[0].toUpperCase())}</div>
        <h3>${esc(u.nombre)}${u.id === D.yo ? ` <span class="muted small">(tú)</span>` : ""}</h3>
        <ul class="plain small">
          ${u.correo ? `<li>✉️ <a href="mailto:${esc(u.correo)}">${esc(u.correo)}</a></li>` : ""}
          ${u.telefono ? `<li>📞 <a href="tel:${esc(u.telefono)}">${esc(u.telefono)}</a></li>` : ""}
          ${waLink(u) ? `<li>💬 <a href="${waLink(u)}" target="_blank" rel="noopener">WhatsApp ${esc(u.whatsapp || u.telefono)}</a></li>` : ""}
          ${u.cumple ? `<li>🎂 ${+u.cumple.slice(8)}/${+u.cumple.slice(5, 7)}</li>` : ""}
        </ul>
        ${u.sobre ? `<p class="small about">${enlazar(u.sobre)}</p>` : ""}
      </div>`).join("")}</div>`;
  }

  function vistaPerfil() {
    const u = usuario(D.yo);
    return `<h1>Mi perfil</h1>
      <form class="card form" data-form="perfil">
        <p class="muted small">Usuario: <strong>${esc(u.usuario)}</strong>. Estos datos los ve el resto del grupo.</p>
        <label>Nombre completo <input name="nombre" value="${esc(u.nombre)}" required></label>
        <div class="row"><label>Correo <input name="correo" type="email" value="${esc(u.correo)}"></label><label>Teléfono <input name="telefono" value="${esc(u.telefono)}"></label></div>
        <div class="row"><label>WhatsApp <input name="whatsapp" value="${esc(u.whatsapp)}" placeholder="3001234567"></label><label>Cumpleaños <input name="cumple" type="date" value="${esc(u.cumple)}"></label></div>
        <label>Sobre mí / otros datos <textarea name="sobre" rows="4" placeholder="Horarios en que puedo reunirme, trabajo, LinkedIn, en qué soy bueno/a…">${esc(u.sobre)}</textarea></label>
        <details><summary>Cambiar contraseña</summary><div class="row">
          <label>Contraseña actual <input name="claveActual" type="password" autocomplete="current-password"></label>
          <label>Nueva contraseña <input name="claveNueva" type="password" minlength="6" autocomplete="new-password"></label>
        </div></details>
        <button class="btn">Guardar</button>
      </form>
      <form class="card form" data-form="codigo">
        <h2>Código del grupo</h2>
        <p class="muted small">Es lo que piden para crear cuenta. Si alguien de afuera lo conoce, cámbialo aquí.</p>
        <div class="copy-row"><input name="codigo" minlength="4" required placeholder="Nuevo código"><button class="btn small">Cambiar</button></div>
      </form>`;
  }

  const vistaNoEncontrado = () => `<div class="card center"><h2>Ups</h2><p>Eso ya no existe.</p><p><a class="btn" href="#/">Volver al inicio</a></p></div>`;

  /* ------------------------------------------------------------ pintar */

  function ruta() {
    const h = location.hash.replace(/^#\/?/, "");
    const [camino, qs] = h.split("?");
    return { partes: camino.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  }

  function pintar() {
    if (!D) {
      const v = pantalla === "sin-grupo" ? vistaSinGrupo() : pantalla === "registro" ? vistaRegistro() : vistaEntrar();
      $app.innerHTML = `<main class="container">${v}</main>`;
      return;
    }
    const { partes: p, q } = ruta();
    const r = p[0] || "inicio";
    const vistas = {
      inicio: vistaInicio, fechas: () => vistaFechas(q), nueva: () => vistaFormFecha(), editar: () => vistaFormFecha(p[1]),
      fecha: () => vistaFecha(p[1]), calendario: () => vistaCalendario(q), archivos: () => vistaArchivos(q),
      muro: vistaMuro, integrantes: vistaIntegrantes, perfil: vistaPerfil,
    };
    const activo = { nueva: "fechas", editar: "fechas", fecha: "fechas" }[r] || r;
    const n = urgentes();
    document.title = (n ? `(${n}) ` : "") + D.grupo.nombre;
    const link = (k, label) => `<a href="#/${k === "inicio" ? "" : k}" class="${activo === k ? "active" : ""}">${label}</a>`;
    const permiso = "Notification" in window && Notification.permission === "default" && !guardado.get("notif-no");
    $app.innerHTML = `<header class="topbar">
        <a class="brand" href="#/">🎓 ${esc(D.grupo.nombre)}</a>
        <button class="menu-btn" type="button" aria-label="Menú" data-act="menu">☰</button>
        <nav class="nav">
          ${link("inicio", "Inicio" + (n ? ` <span class="badge">${n}</span>` : ""))}${link("calendario", "Calendario")}${link("fechas", "Fechas")}
          ${link("archivos", "Archivos y links")}${link("muro", "Muro")}${link("integrantes", "Integrantes")}${link("perfil", "Mi perfil")}
          <button class="link-btn" data-act="salir">Salir</button>
        </nav>
      </header>
      ${permiso ? `<div class="notif-bar">🔔 ¿Quieres que el navegador te avise cuando se acerque una entrega?
        <button class="btn small" data-act="notif-si">Activar alarmas</button> <button class="link-btn" data-act="notif-no">Ahora no</button></div>` : ""}
      <main class="container">${(vistas[r] || vistaNoEncontrado)()}</main>`;
    document.body.classList.remove("nav-open");
  }

  /* ------------------------------------------------------------ eventos */

  async function conBoton(el, fn) {
    const b = el.tagName === "FORM" ? el.querySelector("button:not([type=button])") : el;
    if (b) b.disabled = true;
    try { await fn(); } catch (e) { aviso(e.message, true); } finally { if (b && b.isConnected) b.disabled = false; }
  }

  document.addEventListener("change", (e) => {
    if (e.target.name === "modo") {
      document.querySelectorAll("[data-modo]").forEach((el) => { el.hidden = el.dataset.modo !== e.target.value; });
    }
    if (e.target.closest("[data-form=filtrar]") && e.target.tagName === "SELECT") e.target.form.requestSubmit();
  });

  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(f));
    const tipo = f.dataset.form;
    conBoton(f, async () => {
      switch (tipo) {
        case "crear-grupo": case "registro":
          await op({ op: tipo, ...datos }, "¡Bienvenido/a! Completa tu perfil para que el grupo te pueda contactar.");
          location.hash = "#/perfil";
          break;
        case "entrar":
          await op({ op: "entrar", ...datos });
          break;
        case "fecha": {
          const antes = new Set(D.fechas.map((x) => x.id));
          await op({ op: "fecha", ...datos }, "Fecha guardada. Todo el grupo ya la ve.");
          const nueva = datos.id || (D.fechas.find((x) => !antes.has(x.id)) || {}).id;
          location.hash = nueva ? "#/fecha/" + nueva : "#/fechas";
          break;
        }
        case "comentar":
          await op({ op: "comentar", fecha: datos.fecha || null, texto: datos.texto, fijado: !!datos.fijado });
          break;
        case "perfil":
          await op({ op: "perfil", ...datos }, "Perfil guardado.");
          break;
        case "codigo":
          await op({ op: "codigo", codigo: datos.codigo }, "Código cambiado. Avísale al grupo.");
          break;
        case "subir": {
          if (datos.modo === "link") {
            if (!datos.url) throw new Error("Pega un link.");
            await op({ op: "link", url: datos.url, titulo: datos.titulo, categoria: datos.categoria, materia: datos.materia, nota: datos.nota }, "Link guardado.");
          } else {
            const archivo = f.querySelector("input[type=file]").files[0];
            if (!archivo) throw new Error("Elige un archivo o cambia a «Link».");
            if (archivo.size > D.maxArchivo) throw new Error(`Pesa ${tamano(archivo.size)}; el máximo es ${tamano(D.maxArchivo)}. Súbelo a Drive y guarda el link.`);
            const qs = new URLSearchParams({ nombre: archivo.name, titulo: datos.titulo, categoria: datos.categoria, materia: datos.materia, nota: datos.nota });
            aviso("Subiendo…");
            recibir(await llamar("POST", archivo, "/archivo?" + qs, archivo.type || "application/octet-stream"));
            aviso("Listo, ya está en la biblioteca del grupo.");
            pintar();
          }
          break;
        }
        case "filtrar": {
          const qs = new URLSearchParams(Object.entries(datos).filter(([, v]) => v));
          location.hash = "#/archivos" + (qs.toString() ? "?" + qs : "");
          break;
        }
      }
    });
  });

  const CONFIRMAR = {
    "fecha-borrar": "¿Borrar esta fecha para todo el grupo?",
    "recurso-borrar": "¿Eliminar esto para todo el grupo?",
    "comentario-borrar": "¿Borrar este mensaje?",
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (el.tagName === "A") e.preventDefault();
    switch (act) {
      case "menu": document.body.classList.toggle("nav-open"); return;
      case "ir-registro": pantalla = "registro"; pintar(); return;
      case "ir-entrar": pantalla = "entrar"; pintar(); return;
      case "notif-si": Notification.requestPermission().then(() => { pintar(); revisarAlarmas(); }); return;
      case "notif-no": guardado.set("notif-no", "1"); pintar(); return;
      case "copiar": {
        const input = document.querySelector(el.dataset.target);
        input.select();
        (navigator.clipboard ? navigator.clipboard.writeText(input.value) : Promise.reject()).catch(() => document.execCommand("copy"))
          .finally(() => { el.textContent = "¡Copiado!"; setTimeout(() => (el.textContent = "Copiar"), 1500); });
        return;
      }
      case "salir":
        llamar("POST", { op: "salir" }).catch(() => {}).finally(() => { cerrarSesion(); location.hash = ""; pintar(); });
        return;
    }
    if (CONFIRMAR[act] && !confirm(CONFIRMAR[act])) return;
    conBoton(el, async () => {
      await op({ op: act, id: el.dataset.id }, act === "fecha-listo" ? null : act.endsWith("borrar") ? "Eliminado." : null);
      if (act === "fecha-borrar") location.hash = "#/fechas";
    });
  });

  addEventListener("hashchange", () => {
    document.querySelectorAll(".toast.error").forEach((t) => t.remove());
    pintar();
    scrollTo(0, 0);
  });

  /* ------------------------------------------------------------ actualizar y alarmas */

  function escribiendo() {
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && !a.readOnly) return true;
    return [...document.querySelectorAll("form[data-form] textarea, form[data-form] input:not([type=hidden]):not([type=radio]):not([type=checkbox])")]
      .some((x) => x.value && x.defaultValue !== x.value);
  }

  async function refrescar() {
    if (!token || document.hidden) return;
    try {
      const antes = JSON.stringify(D);
      recibir(await llamar("GET"));
      if (JSON.stringify(D) !== antes && !escribiendo()) pintar();
      revisarAlarmas();
    } catch (e) { /* sin conexión: se intenta en la próxima vuelta */ }
  }

  // Avisos del navegador: 1 día antes, 2 horas antes y al vencerse (si fue en las últimas 12 h).
  function revisarAlarmas() {
    if (!D || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const f of alarmas()) {
      const min = (new Date(f.cuando) - Date.now()) / 60000;
      const paso = min < 0 ? (min > -720 ? ["vencido", "Se venció"] : null) : min <= 120 ? ["2h", "En menos de 2 horas"] : min <= 1440 ? ["24h", "Mañana"] : null;
      if (!paso) continue;
      const clave = `alarma-${f.id}-${paso[0]}-${f.cuando}`;
      if (guardado.get(clave)) continue;
      guardado.set(clave, "1");
      try {
        const n = new Notification(`${paso[1]}: ${f.titulo}`, { body: `${TIPOS[f.tipo]} · ${fmtFecha(f.cuando)}`, tag: clave });
        n.onclick = () => { focus(); location.hash = "#/fecha/" + f.id; };
      } catch (e) {}
    }
  }

  setInterval(refrescar, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
  setInterval(() => { if (D && !escribiendo()) pintar(); }, 60000); // los "en 2 h" avanzan solos

  cargar().then(revisarAlarmas);
})();
