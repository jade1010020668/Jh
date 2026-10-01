/* ==========================================================================
   Grupo CUN — API del grupo de estudio (Netlify Function + Netlify Blobs)

   Store "grupo":
     db               documento JSON con todo: grupo, usuarios, fechas,
                      comentarios y la lista de archivos/links
     archivo/<id>     el contenido de cada archivo subido (binario)
     sesion/<token>   { uid, ts } para cada sesión abierta

   GET  /api/grupo                         → estado público o, con sesión, todo
   POST /api/grupo  {op, ...}              → aplica una operación
   POST /api/grupo/archivo?nombre=…        → sube un archivo (cuerpo binario)
   GET  /api/grupo/archivo/<id>?t=<token>  → abre / descarga un archivo
   GET  /api/grupo/calendario/<clave>.ics  → calendario para el celular

   La sesión viaja en el encabezado Authorization: Bearer <token>.
   El primero que entra crea el grupo y escoge el código para registrarse.
   ========================================================================== */

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: ["/api/grupo", "/api/grupo/*"] };

export const MAX_ARCHIVO = 4 * 1024 * 1024; // límite práctico de una función de Netlify
const KEY = "db";
const TIPOS_FECHA = ["entrega", "parcial", "reunion", "clase", "otro"];
const CATEGORIAS = ["solucion", "entrega", "material", "guia", "otro"];
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);

class ErrorCliente extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

/* ---------------------------------------------------------------- utilidades */

const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = () => crypto.randomBytes(9).toString("base64url");

function hashClave(clave, sal = crypto.randomBytes(16).toString("hex")) {
  const h = crypto.pbkdf2Sync(clave, sal, 120000, 32, "sha256").toString("hex");
  return `${sal}:${h}`;
}
function claveOk(clave, guardado) {
  const [sal, h] = String(guardado || "").split(":");
  if (!sal || !h) return false;
  const otro = crypto.pbkdf2Sync(clave, sal, 120000, 32, "sha256");
  return crypto.timingSafeEqual(otro, Buffer.from(h, "hex"));
}
const igual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function limpiarUrl(v) {
  let u = texto(v, 1000);
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return u ? new URL(u).href : ""; } catch { return ""; }
}

/** "2026-10-03T23:59" en hora de Colombia → ISO con -05:00 */
function limpiarFecha(v) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(v || ""));
  if (!m) throw new ErrorCliente("Pon la fecha con la hora.");
  return `${m[1]}T${m[2]}:00-05:00`;
}

const responder = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

/** Lo que ve un integrante: todo menos claves y secretos. */
function publico(db, uid) {
  const usuarios = {};
  for (const [k, u] of Object.entries(db.usuarios)) {
    const { clave, ...resto } = u;
    usuarios[k] = resto;
  }
  return {
    estado: "ok",
    yo: uid,
    grupo: { nombre: db.grupo.nombre, calendario: db.grupo.calendario },
    usuarios, fechas: db.fechas, comentarios: db.comentarios, recursos: db.recursos,
    maxArchivo: MAX_ARCHIVO
  };
}

/* ---------------------------------------------------------------- operaciones */

function nuevoUsuario(db, op) {
  const usuario = texto(op.usuario, 40).toLowerCase();
  if (!/^[a-z0-9._]{3,40}$/.test(usuario))
    throw new ErrorCliente("El usuario debe tener al menos 3 letras o números, sin espacios.");
  if (Object.values(db.usuarios).some((u) => u.usuario === usuario))
    throw new ErrorCliente("Ese usuario ya existe.");
  if (typeof op.clave !== "string" || op.clave.length < 6)
    throw new ErrorCliente("La contraseña debe tener al menos 6 caracteres.");
  const nombre = texto(op.nombre, 120);
  if (!nombre) throw new ErrorCliente("Escribe tu nombre.");
  if (Object.keys(db.usuarios).length >= 40) throw new ErrorCliente("El grupo ya está lleno.");
  const uid = id();
  db.usuarios[uid] = {
    id: uid, usuario, nombre, clave: hashClave(op.clave),
    correo: texto(op.correo, 120), telefono: "", whatsapp: texto(op.whatsapp, 40),
    cumple: "", sobre: "", creado: new Date().toISOString()
  };
  return uid;
}

const buscar = (lista, idBuscado) => {
  const x = lista.find((e) => e.id === idBuscado);
  if (!x) throw new ErrorCliente("Eso ya no existe; recarga la página.", 404);
  return x;
};

/** Cambia el documento. Devuelve { db, uid?, borrarArchivo? }. */
export function aplicar(db, op, uid) {
  const ahora = new Date().toISOString();
  switch (op.op) {
    case "crear-grupo": {
      if (db) throw new ErrorCliente("El grupo ya fue creado. Recarga la página.");
      const codigo = texto(op.codigo, 60);
      if (codigo.length < 4) throw new ErrorCliente("El código del grupo debe tener al menos 4 caracteres.");
      const nuevo = {
        grupo: { nombre: texto(op.grupo, 60) || "Grupo CUN", codigo, calendario: crypto.randomBytes(16).toString("hex") },
        usuarios: {}, fechas: [], comentarios: [], recursos: []
      };
      return { db: nuevo, uid: nuevoUsuario(nuevo, op) };
    }
    case "registro": {
      if (!db) throw new ErrorCliente("Primero hay que crear el grupo.");
      if (!igual(texto(op.codigo, 60), db.grupo.codigo))
        throw new ErrorCliente("El código del grupo no es correcto. Pídeselo a quien creó el grupo.");
      return { db, uid: nuevoUsuario(db, op) };
    }
  }

  if (!db || !uid || !db.usuarios[uid]) throw new ErrorCliente("Tu sesión expiró. Vuelve a entrar.", 401);
  const yo = db.usuarios[uid];

  switch (op.op) {
    case "perfil": {
      const nombre = texto(op.nombre, 120);
      if (nombre) yo.nombre = nombre;
      for (const [campo, max] of [["correo", 120], ["telefono", 40], ["whatsapp", 40], ["sobre", 2000]])
        yo[campo] = texto(op[campo], max);
      yo.cumple = /^\d{4}-\d{2}-\d{2}$/.test(op.cumple || "") ? op.cumple : "";
      if (op.claveNueva) {
        if (!claveOk(String(op.claveActual || ""), yo.clave))
          throw new ErrorCliente("La contraseña actual no coincide; no se cambió nada.");
        if (String(op.claveNueva).length < 6) throw new ErrorCliente("La nueva contraseña debe tener al menos 6 caracteres.");
        yo.clave = hashClave(String(op.claveNueva));
      }
      break;
    }
    case "codigo": {
      const codigo = texto(op.codigo, 60);
      if (codigo.length < 4) throw new ErrorCliente("El código debe tener al menos 4 caracteres.");
      db.grupo.codigo = codigo;
      break;
    }
    case "fecha": {
      const titulo = texto(op.titulo, 200);
      if (!titulo) throw new ErrorCliente("Ponle un título.");
      const datos = {
        titulo,
        tipo: TIPOS_FECHA.includes(op.tipo) ? op.tipo : "otro",
        materia: texto(op.materia, 120),
        cuando: limpiarFecha(op.cuando),
        detalle: texto(op.detalle, 5000),
        link: limpiarUrl(op.link)
      };
      if (op.id) Object.assign(buscar(db.fechas, op.id), datos, { editado: ahora, editadoPor: uid });
      else db.fechas.push({ id: id(), ...datos, listo: false, por: uid, creado: ahora });
      break;
    }
    case "fecha-listo": {
      const f = buscar(db.fechas, op.id);
      f.listo = !f.listo;
      break;
    }
    case "fecha-borrar":
      buscar(db.fechas, op.id);
      db.fechas = db.fechas.filter((f) => f.id !== op.id);
      db.comentarios = db.comentarios.filter((c) => c.fecha !== op.id);
      break;
    case "comentar": {
      const cuerpo = texto(op.texto, 5000);
      if (!cuerpo) throw new ErrorCliente("Escribe algo.");
      if (op.fecha) buscar(db.fechas, op.fecha);
      db.comentarios.push({ id: id(), texto: cuerpo, fecha: op.fecha || null, fijado: !op.fecha && !!op.fijado, por: uid, creado: ahora });
      if (db.comentarios.length > 2000) db.comentarios = db.comentarios.slice(-2000);
      break;
    }
    case "fijar": {
      const c = buscar(db.comentarios, op.id);
      c.fijado = !c.fijado;
      break;
    }
    case "comentario-borrar": {
      const c = buscar(db.comentarios, op.id);
      if (c.por !== uid) throw new ErrorCliente("Solo quien lo escribió puede borrarlo.", 403);
      db.comentarios = db.comentarios.filter((x) => x.id !== op.id);
      break;
    }
    case "link": {
      const url = limpiarUrl(op.url);
      if (!url) throw new ErrorCliente("Pega un link válido.");
      db.recursos.push({
        id: id(), tipo: "link", url, titulo: texto(op.titulo, 200) || url,
        categoria: CATEGORIAS.includes(op.categoria) ? op.categoria : "otro",
        materia: texto(op.materia, 120), nota: texto(op.nota, 500), por: uid, creado: ahora
      });
      break;
    }
    case "archivo": { // lo agrega la ruta de subida, después de guardar el contenido
      db.recursos.push(op.recurso);
      break;
    }
    case "recurso-borrar": {
      const r = buscar(db.recursos, op.id);
      db.recursos = db.recursos.filter((x) => x.id !== op.id);
      return { db, borrarArchivo: r.tipo === "archivo" ? r.id : null };
    }
    default:
      throw new ErrorCliente("Operación desconocida.");
  }
  return { db };
}

/* ---------------------------------------------------------------- almacenamiento */

async function etagPorLista(store, key) {
  const { blobs } = await store.list({ prefix: key });
  return blobs.find((b) => b.key === key)?.etag || null;
}

/** Lee, aplica y escribe con control de versión; reintenta si alguien escribió en medio. */
async function cambiar(store, op, uid) {
  for (let intento = 0; intento < 8; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 10 + Math.random() * 60));
    let etag = null, actual = null;
    const meta = await store.getWithMetadata(KEY, { type: "json" });
    if (meta && meta.etag) { etag = meta.etag; actual = meta.data; }
    else if (meta) { etag = await etagPorLista(store, KEY); actual = await store.get(KEY, { type: "json" }); }

    const res = aplicar(actual && structuredClone(actual), op, uid);
    const r = await store.setJSON(KEY, res.db, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (r.modified) return res;
  }
  throw new ErrorCliente("Mucha gente escribiendo a la vez; intenta otra vez.", 409);
}

async function sesion(store, req, url) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const s = await store.get("sesion/" + token, { type: "json" });
  return s ? { token, uid: s.uid } : null;
}

async function abrirSesion(store, uid) {
  const token = crypto.randomBytes(24).toString("base64url");
  await store.setJSON("sesion/" + token, { uid, ts: Date.now() });
  return token;
}

/* ---------------------------------------------------------------- calendario .ics */

const icsTexto = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsFecha = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const NOMBRE_TIPO = { entrega: "Entrega", parcial: "Parcial", reunion: "Reunión", clase: "Clase", otro: "Fecha" };

export function calendarioIcs(db) {
  const sello = icsFecha(new Date());
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//grupo-cun//ES", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", `X-WR-CALNAME:${icsTexto(db.grupo.nombre)}`];
  for (const f of db.fechas) {
    const ini = new Date(f.cuando);
    const desc = [f.detalle, f.link].filter(Boolean).join("\n\n");
    lineas.push("BEGIN:VEVENT", `UID:${f.id}@grupo-cun`, `DTSTAMP:${sello}`,
      `DTSTART:${icsFecha(ini)}`, `DTEND:${icsFecha(new Date(ini.getTime() + 3600e3))}`,
      `SUMMARY:${icsTexto((f.listo ? "✔ " : "") + NOMBRE_TIPO[f.tipo] + ": " + f.titulo)}`,
      `DESCRIPTION:${icsTexto(desc)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", `DESCRIPTION:${icsTexto("Mañana: " + f.titulo)}`, "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT2H", `DESCRIPTION:${icsTexto("En 2 horas: " + f.titulo)}`, "END:VALARM",
      "END:VEVENT");
  }
  lineas.push("END:VCALENDAR");
  return lineas.join("\r\n") + "\r\n";
}

/* ---------------------------------------------------------------- rutas */

export async function manejar(req, store) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/grupo\/?/, "");

  try {
    // Calendario para suscribirse (sin sesión; la clave va en la URL)
    let m = /^calendario\/([a-f0-9]{32})\.ics$/.exec(ruta);
    if (m && req.method === "GET") {
      const db = await store.get(KEY, { type: "json" });
      if (!db || !igual(m[1], db.grupo.calendario)) return new Response("No encontrado", { status: 404 });
      return new Response(calendarioIcs(db), {
        headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    const s = await sesion(store, req, url);

    // Descargar un archivo
    m = /^archivo\/([A-Za-z0-9_-]+)$/.exec(ruta);
    if (m && req.method === "GET") {
      if (!s) return new Response("Entra a la app para ver este archivo.", { status: 401 });
      const db = await store.get(KEY, { type: "json" });
      const r = db?.recursos.find((x) => x.id === m[1] && x.tipo === "archivo");
      const datos = r && await store.get("archivo/" + r.id, { type: "arrayBuffer" });
      if (!datos) return new Response("No encontrado", { status: 404 });
      const enLinea = INLINE.has(r.mime) && !url.searchParams.has("descargar");
      return new Response(datos, {
        headers: {
          "Content-Type": r.mime || "application/octet-stream",
          "Content-Disposition": `${enLinea ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.nombre)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600"
        }
      });
    }

    // Subir un archivo
    if (ruta === "archivo" && req.method === "POST") {
      if (!s) throw new ErrorCliente("Tu sesión expiró. Vuelve a entrar.", 401);
      const datos = await req.arrayBuffer();
      if (!datos.byteLength) throw new ErrorCliente("El archivo está vacío.");
      if (datos.byteLength > MAX_ARCHIVO)
        throw new ErrorCliente("El archivo pesa más de 4 MB. Súbelo a Drive y comparte el link.", 413);
      const p = url.searchParams;
      const nombre = texto(p.get("nombre"), 200).replace(/[\\/]/g, "_") || "archivo";
      const recurso = {
        id: id(), tipo: "archivo", nombre,
        mime: texto(req.headers.get("content-type"), 120) || "application/octet-stream",
        tamano: datos.byteLength, titulo: texto(p.get("titulo"), 200) || nombre,
        categoria: CATEGORIAS.includes(p.get("categoria")) ? p.get("categoria") : "otro",
        materia: texto(p.get("materia"), 120), nota: texto(p.get("nota"), 500),
        por: s.uid, creado: new Date().toISOString()
      };
      await store.set("archivo/" + recurso.id, datos);
      try {
        const res = await cambiar(store, { op: "archivo", recurso }, s.uid);
        return responder(publico(res.db, s.uid));
      } catch (e) {
        await store.delete("archivo/" + recurso.id);
        throw e;
      }
    }

    if (ruta !== "") return responder({ error: "No encontrado" }, 404);

    if (req.method === "GET") {
      const db = await store.get(KEY, { type: "json" });
      if (!db) return responder({ estado: "sin-grupo" });
      if (!s || !db.usuarios[s.uid]) return responder({ estado: "entrar", grupo: { nombre: db.grupo.nombre } });
      return responder(publico(db, s.uid));
    }

    if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);
    let op;
    try { op = await req.json(); } catch { throw new ErrorCliente("Datos inválidos."); }
    if (!op || typeof op.op !== "string") throw new ErrorCliente("Datos inválidos.");

    if (op.op === "entrar") {
      const db = await store.get(KEY, { type: "json" });
      const usuario = texto(op.usuario, 40).toLowerCase();
      const u = db && Object.values(db.usuarios).find((x) => x.usuario === usuario);
      if (!u || !claveOk(String(op.clave || ""), u.clave)) throw new ErrorCliente("Usuario o contraseña incorrectos.", 401);
      return responder({ token: await abrirSesion(store, u.id), ...publico(db, u.id) });
    }
    if (op.op === "salir") {
      if (s) await store.delete("sesion/" + s.token);
      return responder({ ok: true });
    }

    const res = await cambiar(store, op, s?.uid);
    if (res.borrarArchivo) await store.delete("archivo/" + res.borrarArchivo);
    if (res.uid) return responder({ token: await abrirSesion(store, res.uid), ...publico(res.db, res.uid) });
    return responder(publico(res.db, s.uid));
  } catch (e) {
    if (e instanceof ErrorCliente) return responder({ error: e.message }, e.status);
    console.error(e);
    return responder({ error: "Algo falló en el servidor. Intenta otra vez." }, 500);
  }
}

export default (req) => manejar(req, getStore({ name: "grupo", consistency: "strong" }));
