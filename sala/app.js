/* ==========================================================================
   Sala FF — lógica de la sala
   Funciona en dos modos:
     · tiempo real  → Firebase Realtime Database (config.js)
     · local        → localStorage, solo en este navegador (para probar)
   ========================================================================== */
(() => {
  "use strict";

  const CFG = window.FF_CONFIG || {};
  const PARAMS = new URLSearchParams(location.search);
  const SALA = (PARAMS.get("sala") || CFG.salaPorDefecto || "principal")
    .toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) || "principal";

  const CONFIG_INICIAL = {
    estado: "abierta",
    cuando: "",
    modo: 6,
    modalidad: "Sala personalizada",
    mapa: "Bermuda",
    apuesta: "",
    codigo: "",
    clave: "",
    nombre1: "Equipo 1",
    nombre2: "Equipo 2",
    nota: "",
    liderId: "",
    liderNombre: "",
    actualizado: 0
  };

  const ETIQUETA_ESTADO = { abierta: "Abierta", jugando: "En juego", cerrada: "Cerrada" };

  let datos = { config: { ...CONFIG_INICIAL }, jugadores: {} };
  let almacen = null;
  let esAdmin = localStorage.getItem("ff:admin:" + SALA) === "1";

  let miId = localStorage.getItem("ff:pid");
  if (!miId) {
    miId = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    localStorage.setItem("ff:pid", miId);
  }

  const $ = (id) => document.getElementById(id);

  /* ====================================================== almacenamiento */

  function cargarScript(src) {
    return new Promise((ok, falla) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => falla(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  /* --- local: solo este navegador (se sincroniza entre pestañas) --------- */
  function almacenLocal() {
    const LLAVE = "ff:sala:" + SALA;
    let alCambiar = () => {};

    const leer = () => {
      try {
        const crudo = JSON.parse(localStorage.getItem(LLAVE) || "{}");
        return { config: { ...CONFIG_INICIAL, ...(crudo.config || {}) }, jugadores: crudo.jugadores || {} };
      } catch {
        return { config: { ...CONFIG_INICIAL }, jugadores: {} };
      }
    };
    const escribir = (d) => {
      localStorage.setItem(LLAVE, JSON.stringify(d));
      alCambiar(leer());
    };

    addEventListener("storage", (e) => { if (e.key === LLAVE) alCambiar(leer()); });

    return {
      tiempoReal: false,
      escuchar(cb) { alCambiar = cb; cb(leer()); },
      guardarConfig(parcial) {
        const d = leer();
        d.config = { ...d.config, ...parcial };
        escribir(d);
      },
      guardarJugador(pid, jugador) {
        const d = leer();
        d.jugadores[pid] = jugador;
        escribir(d);
      },
      borrarJugador(pid) {
        const d = leer();
        delete d.jugadores[pid];
        escribir(d);
      },
      vaciarJugadores() {
        const d = leer();
        d.jugadores = {};
        escribir(d);
      }
    };
  }

  /* --- tiempo real: Firebase Realtime Database --------------------------- */
  async function almacenFirebase(cfgFirebase) {
    const BASE = "https://www.gstatic.com/firebasejs/10.12.5/";
    await cargarScript(BASE + "firebase-app-compat.js");
    await cargarScript(BASE + "firebase-database-compat.js");

    firebase.initializeApp(cfgFirebase);
    const bd = firebase.database();
    const ref = bd.ref("salas/" + SALA);

    return {
      tiempoReal: true,
      escuchar(cb) {
        ref.on("value", (snap) => {
          const crudo = snap.val() || {};
          cb({ config: { ...CONFIG_INICIAL, ...(crudo.config || {}) }, jugadores: crudo.jugadores || {} });
        }, (e) => {
          console.error("Firebase:", e);
          marcarConexion("error", "Sin permisos");
        });
        bd.ref(".info/connected").on("value", (s) => {
          marcarConexion(s.val() ? "vivo" : "error", s.val() ? "En vivo" : "Reconectando");
        });
      },
      guardarConfig: (parcial) => ref.child("config").update(parcial),
      guardarJugador: (pid, jugador) => ref.child("jugadores/" + pid).set(jugador),
      borrarJugador: (pid) => ref.child("jugadores/" + pid).remove(),
      vaciarJugadores: () => ref.child("jugadores").remove()
    };
  }

  function marcarConexion(estado, texto) {
    $("conn").dataset.estado = estado;
    $("connTxt").textContent = texto;
  }

  /* ============================================================ utilidades */

  const cupoDe = (config) => Math.max(1, Number(config.modo) || 6);

  function jugadoresDe(equipo) {
    return Object.entries(datos.jugadores)
      .map(([pid, j]) => ({ pid, ...j }))
      .filter((j) => Number(j.equipo) === equipo)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }

  const miJugador = () => datos.jugadores[miId] || null;
  const miNombre = () => (miJugador() || {}).nombre || localStorage.getItem("ff:nombre") || "";

  /* el líder es quien puso el último código; el admin siempre puede */
  const soyLider = () => !!datos.config.liderId && datos.config.liderId === miId;
  const puedoGestionar = () => esAdmin || soyLider();

  const capitalizar = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  function formatearFecha(cuando) {
    if (!cuando) return null;
    const d = new Date(cuando);
    return isNaN(d) ? null : d;
  }

  const fechaLarga = (fecha) => capitalizar(new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit"
  }).format(fecha));

  function textoCuenta(fecha) {
    if (!fecha) return { grande: "Sin hora todavía", chica: "Cualquiera la puede poner aquí abajo" };

    const largo = fechaLarga(fecha);
    let ms = fecha.getTime() - Date.now();
    if (ms <= 0) {
      const pasados = Math.floor(-ms / 60000);
      if (pasados < 90) return { grande: pasados < 1 ? "¡Empezó ya!" : `Empezó hace ${pasados} min`, chica: largo };
      return { grande: "Ya pasó", chica: largo };
    }

    const min = Math.floor(ms / 60000);
    const dias = Math.floor(min / 1440);
    const horas = Math.floor((min % 1440) / 60);
    const mins = min % 60;

    let grande;
    if (dias > 0) grande = `En ${dias} ${dias === 1 ? "día" : "días"} ${horas} h`;
    else if (horas > 0) grande = `En ${horas} h ${String(mins).padStart(2, "0")} min`;
    else grande = `En ${mins} min`;

    return { grande, chica: largo };
  }

  async function copiar(texto, mensaje) {
    try {
      if (navigator.clipboard && isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      avisar(mensaje);
    } catch {
      avisar("No se pudo copiar. Selecciónalo a mano.");
    }
  }

  let tempToast;
  function avisar(mensaje) {
    const t = $("toast");
    t.textContent = mensaje;
    t.dataset.visible = "1";
    clearTimeout(tempToast);
    tempToast = setTimeout(() => delete t.dataset.visible, 2800);
  }

  function nombreRepetido(nombre, exceptoPid) {
    const n = nombre.toLowerCase();
    return Object.entries(datos.jugadores)
      .some(([pid, j]) => pid !== exceptoPid && (j.nombre || "").toLowerCase() === n);
  }

  function nuevoId() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ================================================================ dibujo */

  function dibujar() {
    const c = datos.config;
    const cupo = cupoDe(c);

    $("salaNombre").textContent = SALA;

    const estado = ETIQUETA_ESTADO[c.estado] ? c.estado : "abierta";
    const badge = $("estado");
    badge.textContent = ETIQUETA_ESTADO[estado];
    badge.dataset.estado = estado;

    $("dModo").textContent = `${cupo} vs ${cupo}`;
    $("dModalidad").textContent = c.modalidad || "—";
    $("dMapa").textContent = c.mapa || "—";
    $("dApuesta").textContent = c.apuesta || "Sin apuesta";
    $("dCodigo").textContent = c.codigo || "Falta";
    $("dClave").textContent = c.clave || "Sin clave";

    const lider = $("dLider");
    if (c.liderNombre) {
      lider.textContent = c.liderNombre + (soyLider() ? " (tú)" : "");
      delete lider.dataset.nadie;
    } else {
      lider.textContent = "Nadie todavía";
      lider.dataset.nadie = "1";
    }
    $("btnCodigo").textContent = c.codigo ? "Cambiar hora o código" : "Poner hora y código";

    const nota = $("dNota");
    nota.textContent = c.nota || "";
    nota.hidden = !c.nota;

    dibujarCuenta();

    $("nombre1").textContent = c.nombre1 || "Equipo 1";
    $("nombre2").textContent = c.nombre2 || "Equipo 2";

    /* si alguien está escribiendo su nombre, no le borramos lo que lleva */
    const activo = document.activeElement;
    const escribiendo = activo && activo.classList.contains("slot-input")
      ? { lado: activo.dataset.lado, valor: activo.value, pos: activo.selectionStart }
      : null;

    dibujarEquipo(1, cupo);
    dibujarEquipo(2, cupo);
    dibujarBanca();

    if (escribiendo) {
      const otra = document.querySelector(`.slot-input[data-lado="${escribiendo.lado}"]`);
      if (otra) {
        otra.value = escribiendo.valor;
        otra.focus();
        try { otra.setSelectionRange(escribiendo.pos, escribiendo.pos); } catch {}
      }
    }

    const yo = miJugador();
    $("btnUnirme").textContent = yo ? "Cambiar mi lugar" : "Anotarme";
    $("btnAdmin").textContent = esAdmin ? "Salir de admin" : "Admin";
    $("btnBanca").hidden = !!yo;

    $("pieActualizado").textContent = c.actualizado
      ? "Actualizado " + new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(c.actualizado))
      : "Sala nueva";
  }

  function dibujarCuenta() {
    const fecha = formatearFecha(datos.config.cuando);
    const t = textoCuenta(fecha);
    $("cuentaValor").textContent = t.grande;
    $("cuentaFecha").textContent = t.chica;
  }

  function dibujarEquipo(lado, cupo) {
    const lista = jugadoresDe(lado);
    const contenedor = $("slots" + lado);
    contenedor.replaceChildren();

    const filas = Math.max(cupo, lista.length);
    for (let i = 0; i < filas; i++) {
      contenedor.appendChild(filaSlot(lista[i], i + 1, i >= cupo, lado));
    }

    const cupoEl = $("cupo" + lado);
    cupoEl.textContent = `${lista.length}/${cupo}`;
    cupoEl.dataset.lleno = lista.length > cupo ? "exceso" : lista.length === cupo ? "si" : "no";
  }

  function dibujarBanca() {
    const lista = jugadoresDe(0);
    const seccion = $("banca");
    seccion.hidden = lista.length === 0;
    const contenedor = $("slotsBanca");
    contenedor.replaceChildren();
    lista.forEach((j, i) => contenedor.appendChild(filaSlot(j, i + 1, false, 0)));
  }

  function filaSlot(jugador, numero, esExceso, lado) {
    const li = document.createElement("li");
    li.className = "slot";

    const num = document.createElement("span");
    num.className = "slot-num";
    num.textContent = String(numero).padStart(2, "0");
    li.appendChild(num);

    const cuerpo = document.createElement("div");
    cuerpo.className = "slot-cuerpo";
    li.appendChild(cuerpo);

    /* ---- slot en blanco: aquí uno se escribe directo ---- */
    if (!jugador) {
      li.dataset.vacio = "1";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "slot-input";
      input.maxLength = 22;
      input.autocomplete = "off";
      input.enterKeyHint = "done";
      input.dataset.lado = String(lado);
      input.setAttribute("aria-label", "Escribe tu nombre para entrar al equipo " + lado);
      cuerpo.appendChild(input);

      const pista = document.createElement("span");
      pista.className = "slot-libre";
      pista.textContent = "libre";
      li.appendChild(pista);

      const gestiono = puedoGestionar() && !!miJugador();
      input.addEventListener("focus", () => {
        input.placeholder = gestiono ? "Nombre del jugador" : "Escribe tu nombre";
        pista.textContent = "Enter para guardar";
      });

      let enviado = false;
      const confirmar = () => {
        if (enviado) return;
        const nombre = input.value.trim().replace(/\s+/g, " ");
        if (!nombre) { input.placeholder = ""; pista.textContent = "libre"; return; }
        enviado = true;
        anotarEnSlot(nombre, lado).then((ok) => { if (!ok) { enviado = false; input.focus(); } });
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); confirmar(); input.blur(); }
        if (e.key === "Escape") { input.value = ""; input.blur(); }
      });
      input.addEventListener("blur", confirmar);
      li.addEventListener("click", (e) => { if (e.target === li || e.target === num || e.target === pista) input.focus(); });
      return li;
    }

    /* ---- slot ocupado ---- */
    const soyYo = jugador.pid === miId;
    if (soyYo) li.dataset.yo = "1";

    const nombre = document.createElement("span");
    nombre.className = "slot-nombre";
    nombre.textContent = jugador.nombre;
    cuerpo.appendChild(nombre);

    const etiqueta = (texto, tipo) => {
      const e = document.createElement("span");
      e.className = "etiqueta";
      if (tipo) e.dataset.tipo = tipo;
      e.textContent = texto;
      cuerpo.appendChild(e);
    };

    if (datos.config.liderId && jugador.pid === datos.config.liderId) etiqueta("Líder", "lider");
    if (jugador.rol) etiqueta(jugador.rol);
    if (soyYo) etiqueta("Tú", "yo");
    if (jugador.manual) etiqueta("Anotado por " + (jugador.por || "el líder"), "manual");
    if (esExceso) etiqueta("Sobra cupo", "exceso");

    const gestiono = puedoGestionar();
    if (gestiono || soyYo) {
      const botones = document.createElement("div");
      botones.className = "slot-botones";

      if (gestiono) {
        const mover = document.createElement("button");
        mover.type = "button";
        mover.className = "slot-accion";
        mover.textContent = "Mover";
        mover.title = "Pasar al otro equipo";
        mover.addEventListener("click", () => moverJugador(jugador));
        botones.appendChild(mover);
      }

      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "slot-accion";
      quitar.dataset.tipo = "quitar";
      quitar.textContent = soyYo ? "Salir" : "Sacar";
      quitar.title = soyYo ? "Salir de la sala" : "Sacar a " + jugador.nombre;
      quitar.addEventListener("click", () => quitarJugador(jugador));
      botones.appendChild(quitar);

      li.appendChild(botones);
    }

    return li;
  }

  /* ============================================================ acciones */

  async function quitarJugador(jugador) {
    const soyYo = jugador.pid === miId;
    if (!soyYo && !confirm(`¿Sacar a ${jugador.nombre} de la sala?`)) return;
    await almacen.borrarJugador(jugador.pid);
    avisar(soyYo ? "Saliste de la sala" : `${jugador.nombre} salió de la sala`);
  }

  async function moverJugador(jugador) {
    const cupo = cupoDe(datos.config);
    const c = datos.config;
    let destino;

    if (jugador.equipo === 0) {
      destino = jugadoresDe(1).length < cupo ? 1 : jugadoresDe(2).length < cupo ? 2 : null;
      if (destino === null) { avisar("Los dos equipos están llenos"); return; }
    } else {
      destino = jugador.equipo === 1 ? 2 : 1;
      if (jugadoresDe(destino).length >= cupo) {
        if (!confirm(`${c["nombre" + destino]} está lleno. ¿Pasar a ${jugador.nombre} a suplentes?`)) return;
        destino = 0;
      }
    }

    const { pid, ...resto } = jugador;
    await almacen.guardarJugador(pid, { ...resto, equipo: destino, ts: Date.now() });
    const nombreDestino = destino === 0 ? "suplentes" : (c["nombre" + destino] || "Equipo " + destino);
    avisar(`${jugador.nombre} → ${nombreDestino}`);
  }

  /* escribir un nombre en un slot vacío:
     - si no estoy en la sala, me anoto yo
     - si ya estoy y soy líder/admin, anoto a otra persona
     - si ya estoy y no mando, me muevo/renombro */
  async function anotarEnSlot(nombre, equipo) {
    const c = datos.config;
    const yo = miJugador();

    if (c.estado === "cerrada" && !puedoGestionar()) { avisar("La sala está cerrada. Habla con el líder o el admin."); return false; }

    if (equipo !== 0 && jugadoresDe(equipo).filter((j) => j.pid !== miId || (yo && puedoGestionar())).length >= cupoDe(c)) {
      avisar("Ese equipo ya se llenó");
      return false;
    }

    if (yo && puedoGestionar()) {
      if (nombreRepetido(nombre, null)) { avisar(`Ya hay alguien llamado ${nombre}`); return false; }
      await almacen.guardarJugador(nuevoId(), { nombre, equipo, rol: "", ts: Date.now(), manual: true, por: yo.nombre });
      avisar(`${nombre} quedó en ${equipo === 0 ? "suplentes" : c["nombre" + equipo]}`);
      return true;
    }

    if (nombreRepetido(nombre, miId)) { avisar("Ya hay alguien con ese nombre, ponle algo que te distinga"); return false; }

    localStorage.setItem("ff:nombre", nombre);
    await almacen.guardarJugador(miId, {
      nombre, equipo,
      rol: yo ? (yo.rol || "") : "",
      ts: yo && yo.equipo === equipo ? yo.ts : Date.now()
    });
    avisar(yo ? "Listo, te cambiamos" : "¡Estás dentro!");
    return true;
  }

  /* ============================================================== unirse */

  function abrirUnirme(ladoSugerido) {
    const yo = miJugador();
    const c = datos.config;
    const cupo = cupoDe(c);

    $("optNombre1").textContent = c.nombre1 || "Equipo 1";
    $("optNombre2").textContent = c.nombre2 || "Equipo 2";

    [1, 2].forEach((lado) => {
      const n = jugadoresDe(lado).filter((j) => j.pid !== miId).length;
      const lleno = n >= cupo;
      $("optCupo" + lado).textContent = lleno ? "Lleno" : `${n}/${cupo}`;
      document.querySelector(`#opcionesEquipo input[value="${lado}"]`).disabled = lleno;
    });

    $("inNombre").value = miNombre();
    $("inRol").value = yo && yo.rol ? yo.rol : "";

    const lado = yo ? String(yo.equipo) : String(ladoSugerido ?? 1);
    const radio = document.querySelector(`#opcionesEquipo input[value="${lado}"]`);
    if (radio && !radio.disabled) radio.checked = true;
    else document.querySelector('#opcionesEquipo input[value="0"]').checked = true;

    $("btnSalir").hidden = !yo;
    $("btnGuardarJugador").textContent = yo ? "Guardar" : "Entrar";
    $("errUnirme").hidden = true;

    $("dlgUnirme").showModal();
  }

  async function guardarJugador() {
    const err = $("errUnirme");
    const mostrar = (m) => { err.textContent = m; err.hidden = false; };
    const nombre = $("inNombre").value.trim().replace(/\s+/g, " ");
    const equipo = Number(document.querySelector("#opcionesEquipo input:checked").value);

    if (!nombre) return mostrar("Escribe tu nombre para que sepan quién eres.");
    if (datos.config.estado === "cerrada" && !puedoGestionar()) return mostrar("La sala está cerrada. Habla con el líder o el admin.");
    if (nombreRepetido(nombre, miId)) return mostrar("Ya hay alguien con ese nombre. Ponle algo que te distinga.");
    if (equipo !== 0 && jugadoresDe(equipo).filter((j) => j.pid !== miId).length >= cupoDe(datos.config)) {
      return mostrar("Ese equipo se llenó. Escoge el otro o entra de suplente.");
    }

    const previo = miJugador();
    localStorage.setItem("ff:nombre", nombre);

    await almacen.guardarJugador(miId, {
      nombre,
      equipo,
      rol: $("inRol").value || "",
      ts: previo && previo.equipo === equipo ? previo.ts : Date.now()
    });

    $("dlgUnirme").close();
    avisar(previo ? "Listo, te actualizamos" : "¡Estás dentro!");
  }

  /* ====================================================== código / líder */

  function abrirCodigo() {
    const c = datos.config;
    $("cCuando").value = c.cuando || "";
    $("cCodigo").value = c.codigo || "";
    $("cClave").value = c.clave || "";
    $("cNombre").value = miNombre();
    $("errCodigo").hidden = true;
    $("dlgCodigo").showModal();
  }

  async function guardarCodigo() {
    const err = $("errCodigo");
    const c = datos.config;
    const cuando = $("cCuando").value;
    const codigo = $("cCodigo").value.trim();
    const clave = $("cClave").value.trim();
    const nombre = $("cNombre").value.trim().replace(/\s+/g, " ");

    const cambiaCodigo = codigo !== (c.codigo || "") || clave !== (c.clave || "");
    if (cambiaCodigo && codigo && !nombre) {
      err.textContent = "Pon tu nombre: quien pone el código queda como líder.";
      err.hidden = false;
      return;
    }

    const cambios = { cuando, codigo, clave, actualizado: Date.now() };
    if (cambiaCodigo && codigo) {
      cambios.liderId = miId;
      cambios.liderNombre = nombre;
      localStorage.setItem("ff:nombre", nombre);
    }
    await almacen.guardarConfig(cambios);

    /* si el líder ya está anotado con otro nombre, lo emparejamos */
    const yo = miJugador();
    if (cambiaCodigo && codigo && yo && yo.nombre !== nombre && !nombreRepetido(nombre, miId)) {
      await almacen.guardarJugador(miId, { ...yo, nombre });
    }

    $("dlgCodigo").close();
    avisar(cambiaCodigo && codigo ? "Guardado. Ahora tú mandas en la sala." : "Hora guardada");
  }

  /* =============================================================== admin */

  function alternarAdmin() {
    if (esAdmin) {
      esAdmin = false;
      localStorage.removeItem("ff:admin:" + SALA);
      dibujar();
      avisar("Saliste del modo admin");
      return;
    }
    const pin = prompt("Clave de administrador:");
    if (pin === null) return;
    if (pin !== String(CFG.adminPin ?? "1234")) { avisar("Clave incorrecta"); return; }
    esAdmin = true;
    localStorage.setItem("ff:admin:" + SALA, "1");
    dibujar();
    abrirAdmin();
  }

  function abrirAdmin() {
    const c = datos.config;
    $("aEstado").value = c.estado || "abierta";
    $("aModo").value = String(cupoDe(c));
    $("aModalidad").value = c.modalidad || "Sala personalizada";
    $("aMapa").value = c.mapa || "Bermuda";
    $("aApuesta").value = c.apuesta || "";
    $("aNombre1").value = c.nombre1 || "";
    $("aNombre2").value = c.nombre2 || "";
    $("aNota").value = c.nota || "";
    $("aQuitarLider").checked = false;
    $("aQuitarLider").closest("label").hidden = !c.liderId;
    $("dlgAdmin").showModal();
  }

  async function guardarAdmin() {
    const cambios = {
      estado: $("aEstado").value,
      modo: Number($("aModo").value) || 6,
      modalidad: $("aModalidad").value,
      mapa: $("aMapa").value,
      apuesta: $("aApuesta").value.trim(),
      nombre1: $("aNombre1").value.trim() || "Equipo 1",
      nombre2: $("aNombre2").value.trim() || "Equipo 2",
      nota: $("aNota").value.trim(),
      actualizado: Date.now()
    };
    if ($("aQuitarLider").checked) {
      cambios.liderId = "";
      cambios.liderNombre = "";
    }
    await almacen.guardarConfig(cambios);
    $("dlgAdmin").close();
    avisar("Sala actualizada");
  }

  /* ============================================== resumen para WhatsApp */

  function armarResumen() {
    const c = datos.config;
    const cupo = cupoDe(c);
    const fecha = formatearFecha(c.cuando);
    const lineas = [];

    lineas.push("🔥 SALA FREE FIRE 🔥");
    if (fecha) lineas.push("📅 " + fechaLarga(fecha));
    lineas.push(`🎮 ${cupo} vs ${cupo} · ${c.modalidad || "Sala personalizada"} · ${c.mapa || "—"}`);
    if (c.codigo || c.clave) {
      lineas.push(`🔑 Sala: ${c.codigo || "—"}${c.clave ? "  ·  Clave: " + c.clave : ""}`);
    }
    if (c.liderNombre) lineas.push("👑 Líder: " + c.liderNombre);
    if (c.apuesta) lineas.push("💰 " + c.apuesta);
    lineas.push("");

    [[1, "🟦", c.nombre1 || "EQUIPO 1"], [2, "🟥", c.nombre2 || "EQUIPO 2"]].forEach(([lado, icono, nombre]) => {
      const lista = jugadoresDe(lado);
      lineas.push(`${icono} ${nombre.toUpperCase()} (${lista.length}/${cupo})`);
      for (let i = 0; i < Math.max(cupo, lista.length); i++) {
        const j = lista[i];
        lineas.push("• " + (j ? j.nombre + (j.rol ? ` (${j.rol})` : "") : ""));
      }
      lineas.push("");
    });

    const suplentes = jugadoresDe(0);
    if (suplentes.length) {
      lineas.push("🔁 SUPLENTES");
      suplentes.forEach((j) => lineas.push("• " + j.nombre));
      lineas.push("");
    }

    if (c.nota) { lineas.push("📌 " + c.nota); lineas.push(""); }
    lineas.push("🔗 Anótate aquí: " + location.href.split("#")[0]);

    return lineas.join("\n");
  }

  /* ================================================ imagen de los equipos */

  async function generarImagen() {
    avisar("Armando la imagen…");
    try { await document.fonts.ready; } catch {}

    const c = datos.config;
    const cupo = cupoDe(c);
    const eq1 = jugadoresDe(1), eq2 = jugadoresDe(2), banca = jugadoresDe(0);
    const filas = Math.max(cupo, eq1.length, eq2.length);

    const W = 1080, M = 64, FILA = 84, COL_GAP = 28;
    const COL_W = (W - M * 2 - COL_GAP) / 2;
    const altoBanca = banca.length ? 100 + Math.ceil(banca.length / 2) * 64 : 0;
    const H = 560 + 70 + filas * FILA + altoBanca + 190;

    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");

    const DISPLAY = '"Chakra Petch", "Barlow", system-ui, sans-serif';
    const CUERPO = '"Barlow", system-ui, sans-serif';

    /* fondo */
    g.fillStyle = "#0A0E17"; g.fillRect(0, 0, W, H);
    const brasa = g.createRadialGradient(W / 2, -80, 20, W / 2, -80, 720);
    brasa.addColorStop(0, "rgba(255,106,26,0.28)"); brasa.addColorStop(1, "rgba(255,106,26,0)");
    g.fillStyle = brasa; g.fillRect(0, 0, W, 700);
    g.strokeStyle = "rgba(51,69,106,0.18)"; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 46) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    const texto = (t, x, y, font, color, align = "left", max) => {
      g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
      if (max) g.fillText(t, x, y, max); else g.fillText(t, x, y);
    };
    const recorta = (t, font, max) => {
      g.font = font;
      if (g.measureText(t).width <= max) return t;
      while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
      return t + "…";
    };

    /* cabecera */
    let y = M + 60;
    texto("SALA FF", M, y, `700 66px ${DISPLAY}`, "#E6EDFA");
    texto(("sala " + SALA).toUpperCase(), M + 4, y + 32, `600 22px ${DISPLAY}`, "#6F7E9B");
    const est = (ETIQUETA_ESTADO[c.estado] || "Abierta").toUpperCase();
    const colorEst = c.estado === "jugando" ? "#FF6A1A" : c.estado === "cerrada" ? "#6F7E9B" : "#3DDC8A";
    g.font = `700 24px ${DISPLAY}`;
    const wEst = g.measureText(est).width + 40;
    g.strokeStyle = colorEst; g.lineWidth = 2; g.strokeRect(W - M - wEst, y - 38, wEst, 48);
    texto(est, W - M - wEst / 2, y - 4, `700 24px ${DISPLAY}`, colorEst, "center");

    /* hora */
    y += 150;
    const fecha = formatearFecha(c.cuando);
    const cuenta = textoCuenta(fecha);
    texto("ARRANCA", M, y - 46, `600 20px ${DISPLAY}`, "#FF6A1A");
    texto(cuenta.grande, M, y, `700 56px ${DISPLAY}`, "#E6EDFA", "left", W - M * 2);
    texto(cuenta.chica, M, y + 36, `500 26px ${CUERPO}`, "#A6B3CC", "left", W - M * 2);

    /* datos */
    y += 96;
    g.strokeStyle = "#24314A"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(M, y - 30); g.lineTo(W - M, y - 30); g.stroke();
    const datosFila = [["MODO", `${cupo} vs ${cupo}`], ["MAPA", c.mapa || "—"], ["MODALIDAD", c.modalidad || "—"], ["APUESTA", c.apuesta || "Sin apuesta"]];
    const anchos = [0.18, 0.24, 0.34, 0.24].map((f) => f * (W - M * 2));
    let xDato = M;
    datosFila.forEach(([k, v], i) => {
      texto(k, xDato, y + 8, `600 18px ${DISPLAY}`, "#6F7E9B");
      texto(recorta(v, `600 28px ${CUERPO}`, anchos[i] - 16), xDato, y + 44, `600 28px ${CUERPO}`, "#E6EDFA");
      xDato += anchos[i];
    });

    /* código y clave */
    y += 90;
    const caja = (x, w, label, valor) => {
      g.fillStyle = "#0E1421"; g.fillRect(x, y, w, 96);
      g.strokeStyle = "#33456A"; g.lineWidth = 2; g.strokeRect(x, y, w, 96);
      g.fillStyle = "#FF6A1A"; g.fillRect(x, y, 6, 96);
      texto(label, x + 26, y + 34, `600 18px ${DISPLAY}`, "#6F7E9B");
      texto(recorta(valor, `700 40px ${DISPLAY}`, w - 52), x + 26, y + 78, `700 40px ${DISPLAY}`, "#E6EDFA");
    };
    caja(M, COL_W, "CÓDIGO DE SALA", c.codigo || "Falta");
    caja(M + COL_W + COL_GAP, COL_W, "CONTRASEÑA", c.clave || "Sin clave");
    if (c.liderNombre) texto("👑 Líder: " + c.liderNombre, M, y + 136, `600 24px ${CUERPO}`, "#FFC53D");

    /* equipos */
    y += 190;
    const dibujarColumna = (x, nombre, color, lista) => {
      g.fillStyle = color; g.fillRect(x, y, COL_W, 5);
      texto(recorta(nombre.toUpperCase(), `700 30px ${DISPLAY}`, COL_W - 110), x, y + 48, `700 30px ${DISPLAY}`, color);
      texto(`${lista.length}/${cupo}`, x + COL_W, y + 48, `600 26px ${DISPLAY}`, lista.length >= cupo ? color : "#6F7E9B", "right");

      for (let i = 0; i < filas; i++) {
        const fy = y + 70 + i * FILA;
        const j = lista[i];
        g.fillStyle = j ? "#0E1421" : "transparent";
        g.fillRect(x, fy, COL_W, FILA - 12);
        g.strokeStyle = j ? "#24314A" : "#33456A";
        g.lineWidth = 2;
        g.setLineDash(j ? [] : [8, 8]);
        g.strokeRect(x, fy, COL_W, FILA - 12);
        g.setLineDash([]);

        texto(String(i + 1).padStart(2, "0"), x + 22, fy + 46, `600 24px ${DISPLAY}`, "#6F7E9B");
        if (j) {
          let etiquetas = [];
          if (c.liderId && j.pid === c.liderId) etiquetas.push("👑");
          const nombreJ = recorta(j.nombre, `600 32px ${CUERPO}`, COL_W - 90 - (j.rol ? 120 : 0));
          texto(nombreJ, x + 66, fy + 47, `600 32px ${CUERPO}`, "#E6EDFA");
          if (etiquetas.length) texto(etiquetas.join(" "), x + 66 + g.measureText(nombreJ).width + 12, fy + 47, `600 28px ${CUERPO}`, "#FFC53D");
          if (j.rol) texto(j.rol.toUpperCase(), x + COL_W - 18, fy + 45, `600 18px ${DISPLAY}`, "#A6B3CC", "right");
        }
      }
    };
    dibujarColumna(M, c.nombre1 || "Equipo 1", "#25D8E8", eq1);
    dibujarColumna(M + COL_W + COL_GAP, c.nombre2 || "Equipo 2", "#FF3E6C", eq2);
    y += 70 + filas * FILA;

    /* suplentes */
    if (banca.length) {
      y += 30;
      texto("SUPLENTES", M, y + 20, `600 22px ${DISPLAY}`, "#6F7E9B");
      banca.forEach((j, i) => {
        const col = i % 2, fila = Math.floor(i / 2);
        const x = M + col * (COL_W + COL_GAP);
        texto("• " + recorta(j.nombre, `500 28px ${CUERPO}`, COL_W - 40), x, y + 70 + fila * 64 - 14, `500 28px ${CUERPO}`, "#A6B3CC");
      });
      y += altoBanca;
    }

    /* pie */
    const enlace = location.href.split("#")[0].replace(/^https?:\/\//, "");
    texto(recorta(enlace, `500 22px ${CUERPO}`, W - M * 2), M, H - 44, `500 22px ${CUERPO}`, "#6F7E9B");
    texto("Anótate en el enlace", W - M, H - 44, `600 20px ${DISPLAY}`, "#FF6A1A", "right");

    /* guardar / compartir */
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    if (!blob) { avisar("No se pudo crear la imagen"); return; }
    const archivo = new File([blob], `sala-ff-${SALA}.png`, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: "Sala FF" });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    avisar("Imagen guardada en descargas");
  }

  /* =============================================================== arranque */

  function conectarEventos() {
    $("btnUnirme").addEventListener("click", () => abrirUnirme());
    $("btnBanca").addEventListener("click", () => abrirUnirme(0));
    $("btnAdmin").addEventListener("click", alternarAdmin);
    $("btnCodigo").addEventListener("click", abrirCodigo);
    $("btnImagen").addEventListener("click", generarImagen);

    $("btnResumen").addEventListener("click", () => copiar(armarResumen(), "Resumen copiado, pégalo en el grupo"));
    $("btnLink").addEventListener("click", () => copiar(location.href.split("#")[0], "Enlace copiado"));

    document.querySelectorAll("[data-copiar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const campo = btn.dataset.copiar;
        const valor = (datos.config[campo] || "").trim();
        if (!valor) { avisar(campo === "codigo" ? "Nadie ha puesto el código todavía" : "Esta sala no tiene contraseña"); return; }
        copiar(valor, (campo === "codigo" ? "Código" : "Contraseña") + " copiada: " + valor);
      });
    });

    document.querySelectorAll("[data-cerrar]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog").close());
    });

    $("formUnirme").addEventListener("submit", (e) => { e.preventDefault(); guardarJugador(); });
    $("formCodigo").addEventListener("submit", (e) => { e.preventDefault(); guardarCodigo(); });
    $("formAdmin").addEventListener("submit", (e) => { e.preventDefault(); guardarAdmin(); });

    $("btnSalir").addEventListener("click", async () => {
      const yo = miJugador();
      $("dlgUnirme").close();
      if (yo) await quitarJugador({ ...yo, pid: miId });
    });

    $("btnVaciar").addEventListener("click", async () => {
      if (!confirm("¿Sacar a todo el mundo de los equipos? Los datos de la sala se quedan igual.")) return;
      await almacen.vaciarJugadores();
      $("dlgAdmin").close();
      avisar("Equipos vacíos");
    });

    setInterval(dibujarCuenta, 30000);
  }

  async function iniciar() {
    conectarEventos();
    dibujar();

    const fb = CFG.firebase;
    if (fb && fb.databaseURL) {
      try {
        almacen = await almacenFirebase(fb);
        marcarConexion("vivo", "En vivo");
      } catch (e) {
        console.error(e);
        almacen = almacenLocal();
        marcarConexion("error", "Sin conexión");
        $("avisoLocal").hidden = false;
        $("avisoLocal").innerHTML = "<strong>No se pudo conectar.</strong> Revisa la configuración de Firebase en <code>config.js</code>. Mientras tanto, los cambios se guardan solo en este navegador.";
      }
    } else {
      almacen = almacenLocal();
      marcarConexion("local", CFG.vistaPrevia ? "Vista previa" : "Modo local");
      $("avisoLocal").hidden = false;
      if (CFG.vistaPrevia) {
        $("avisoLocal").innerHTML = "<strong>Vista previa.</strong> Tócala y pruébala con confianza: lo que escribas aquí solo lo ves tú. La versión de verdad, con todo el grupo en tiempo real, es tu enlace de GitHub Pages.";
      }
    }

    almacen.escuchar((nuevos) => { datos = nuevos; dibujar(); });
  }

  iniciar();
})();
