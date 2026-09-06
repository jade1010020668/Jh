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

  const capitalizar = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  function formatearFecha(cuando) {
    if (!cuando) return null;
    const d = new Date(cuando);
    return isNaN(d) ? null : d;
  }

  function textoCuenta(fecha) {
    if (!fecha) return { grande: "Sin fecha", chica: "El admin todavía no la programa" };

    const largo = new Intl.DateTimeFormat("es-CO", {
      weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit"
    }).format(fecha);

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
    tempToast = setTimeout(() => delete t.dataset.visible, 2600);
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

    const nota = $("dNota");
    nota.textContent = c.nota || "";
    nota.hidden = !c.nota;

    dibujarCuenta();

    $("nombre1").textContent = c.nombre1 || "Equipo 1";
    $("nombre2").textContent = c.nombre2 || "Equipo 2";

    dibujarEquipo(1, cupo);
    dibujarEquipo(2, cupo);
    dibujarBanca();

    const yo = miJugador();
    $("btnUnirme").textContent = yo ? "Cambiar mi lugar" : "Unirme a la sala";
    $("btnAdmin").textContent = esAdmin ? "Salir de admin" : "Admin";
    $("btnBanca").hidden = !!yo;

    $("pieActualizado").textContent = c.actualizado
      ? "Última actualización: " + new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(c.actualizado))
      : "Sala nueva, todavía sin cambios";
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

    if (!jugador) {
      li.dataset.vacio = "1";
      const txt = document.createElement("span");
      txt.className = "slot-nombre";
      txt.textContent = "Slot libre";
      cuerpo.appendChild(txt);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-accion";
      btn.textContent = "Entrar aquí";
      btn.addEventListener("click", () => abrirUnirme(lado));
      li.appendChild(btn);
      return li;
    }

    if (jugador.pid === miId) li.dataset.yo = "1";

    const nombre = document.createElement("span");
    nombre.className = "slot-nombre";
    nombre.textContent = jugador.nombre;
    cuerpo.appendChild(nombre);

    if (jugador.rol) {
      const rol = document.createElement("span");
      rol.className = "etiqueta";
      rol.textContent = jugador.rol;
      cuerpo.appendChild(rol);
    }
    if (jugador.pid === miId) {
      const yo = document.createElement("span");
      yo.className = "etiqueta";
      yo.dataset.tipo = "yo";
      yo.textContent = "Tú";
      cuerpo.appendChild(yo);
    }
    if (esExceso) {
      const ex = document.createElement("span");
      ex.className = "etiqueta";
      ex.dataset.tipo = "exceso";
      ex.textContent = "Sobra cupo";
      cuerpo.appendChild(ex);
    }

    if (esAdmin || jugador.pid === miId) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-accion";
      btn.dataset.tipo = "quitar";
      btn.textContent = jugador.pid === miId ? "Salir" : "Sacar";
      btn.title = jugador.pid === miId ? "Salir de la sala" : "Sacar a " + jugador.nombre;
      btn.addEventListener("click", () => quitarJugador(jugador));
      li.appendChild(btn);
    }

    return li;
  }

  async function quitarJugador(jugador) {
    const soyYo = jugador.pid === miId;
    if (!soyYo && !confirm(`¿Sacar a ${jugador.nombre} de la sala?`)) return;
    await almacen.borrarJugador(jugador.pid);
    avisar(soyYo ? "Saliste de la sala" : `${jugador.nombre} salió de la sala`);
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
      const radio = document.querySelector(`#opcionesEquipo input[value="${lado}"]`);
      radio.disabled = lleno;
    });

    $("inNombre").value = yo ? yo.nombre : (localStorage.getItem("ff:nombre") || "");
    $("inRol").value = yo && yo.rol ? yo.rol : "";

    let lado = yo ? String(yo.equipo) : String(ladoSugerido ?? 1);
    const radio = document.querySelector(`#opcionesEquipo input[value="${lado}"]`);
    if (radio && !radio.disabled) radio.checked = true;
    else document.querySelector('#opcionesEquipo input[value="0"]').checked = true;

    $("btnSalir").hidden = !yo;
    $("btnGuardarJugador").textContent = yo ? "Guardar" : "Entrar";
    $("errUnirme").hidden = true;

    $("dlgUnirme").showModal();
    $("inNombre").focus();
  }

  async function guardarJugador() {
    const err = $("errUnirme");
    const nombre = $("inNombre").value.trim().replace(/\s+/g, " ");
    const equipo = Number(document.querySelector('#opcionesEquipo input:checked').value);

    if (!nombre) {
      err.textContent = "Escribe tu nombre para que sepan quién eres.";
      err.hidden = false;
      return;
    }
    if (datos.config.estado === "cerrada" && !esAdmin) {
      err.textContent = "La sala está cerrada. Habla con el admin.";
      err.hidden = false;
      return;
    }

    const repetido = Object.entries(datos.jugadores)
      .some(([pid, j]) => pid !== miId && j.nombre.toLowerCase() === nombre.toLowerCase());
    if (repetido) {
      err.textContent = "Ya hay alguien con ese nombre. Ponle algo que te distinga.";
      err.hidden = false;
      return;
    }

    if (equipo !== 0) {
      const ocupados = jugadoresDe(equipo).filter((j) => j.pid !== miId).length;
      if (ocupados >= cupoDe(datos.config)) {
        err.textContent = "Ese equipo se llenó. Escoge el otro o entra de suplente.";
        err.hidden = false;
        return;
      }
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
    if (pin !== String(CFG.adminPin ?? "1234")) {
      avisar("Clave incorrecta");
      return;
    }
    esAdmin = true;
    localStorage.setItem("ff:admin:" + SALA, "1");
    dibujar();
    abrirAdmin();
  }

  function abrirAdmin() {
    const c = datos.config;
    $("aCuando").value = c.cuando || "";
    $("aEstado").value = c.estado || "abierta";
    $("aModo").value = String(cupoDe(c));
    $("aModalidad").value = c.modalidad || "Sala personalizada";
    $("aMapa").value = c.mapa || "Bermuda";
    $("aApuesta").value = c.apuesta || "";
    $("aCodigo").value = c.codigo || "";
    $("aClave").value = c.clave || "";
    $("aNombre1").value = c.nombre1 || "";
    $("aNombre2").value = c.nombre2 || "";
    $("aNota").value = c.nota || "";
    $("dlgAdmin").showModal();
  }

  async function guardarAdmin() {
    await almacen.guardarConfig({
      cuando: $("aCuando").value,
      estado: $("aEstado").value,
      modo: Number($("aModo").value) || 6,
      modalidad: $("aModalidad").value,
      mapa: $("aMapa").value,
      apuesta: $("aApuesta").value.trim(),
      codigo: $("aCodigo").value.trim(),
      clave: $("aClave").value.trim(),
      nombre1: $("aNombre1").value.trim() || "Equipo 1",
      nombre2: $("aNombre2").value.trim() || "Equipo 2",
      nota: $("aNota").value.trim(),
      actualizado: Date.now()
    });
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
    if (fecha) {
      lineas.push("📅 " + capitalizar(new Intl.DateTimeFormat("es-CO", {
        weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit"
      }).format(fecha)));
    }
    lineas.push(`🎮 ${cupo} vs ${cupo} · ${c.modalidad || "Sala personalizada"} · ${c.mapa || "—"}`);
    if (c.codigo || c.clave) {
      lineas.push(`🔑 Sala: ${c.codigo || "—"}${c.clave ? "  ·  Clave: " + c.clave : ""}`);
    }
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

  /* =============================================================== arranque */

  function conectarEventos() {
    $("btnUnirme").addEventListener("click", () => abrirUnirme());
    $("btnBanca").addEventListener("click", () => abrirUnirme(0));
    $("btnAdmin").addEventListener("click", alternarAdmin);

    $("btnResumen").addEventListener("click", () => copiar(armarResumen(), "Resumen copiado, pégalo en el grupo"));
    $("btnLink").addEventListener("click", () => copiar(location.href.split("#")[0], "Enlace copiado"));

    document.querySelectorAll("[data-copiar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const campo = btn.dataset.copiar;
        const valor = (datos.config[campo] || "").trim();
        if (!valor) { avisar(campo === "codigo" ? "El admin no ha puesto el código" : "Esta sala no tiene contraseña"); return; }
        copiar(valor, (campo === "codigo" ? "Código" : "Contraseña") + " copiada: " + valor);
      });
    });

    document.querySelectorAll("[data-cerrar]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog").close());
    });

    $("formUnirme").addEventListener("submit", (e) => { e.preventDefault(); guardarJugador(); });
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
      marcarConexion("local", "Modo local");
      $("avisoLocal").hidden = false;
    }

    almacen.escuchar((nuevos) => { datos = nuevos; dibujar(); });
  }

  iniciar();
})();
