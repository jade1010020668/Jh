/* ==========================================================================
   Grupo CUN — tablero del grupo de estudio (Netlify Function + Netlify Blobs)

   Un solo tablero, sin cuentas: quien tiene el enlace entra y ve todo.

   Store "grupo":
     db             documento JSON: nombre, integrantes, fechas,
                    comentarios y la lista de archivos/links
     archivo/<id>   el contenido de cada archivo subido (binario)

   GET  /api/grupo                      → todo el tablero
   POST /api/grupo  {op, autor, ...}    → aplica un cambio y devuelve el tablero
   POST /api/grupo/archivo?nombre=…     → sube un archivo (cuerpo binario)
   GET  /api/grupo/archivo/<id>         → abre / descarga un archivo
   GET  /api/grupo/calendario.ics       → calendario para el celular
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
const vacio = () => ({ nombre: "Grupo CUN", integrantes: [], fechas: [], comentarios: [], recursos: [] });

/** Convierte el formato de la primera versión (con cuentas) al tablero sin cuentas. */
export function normalizar(db) {
  if (!db) return null;
  if (!db.usuarios) return db;
  const nombres = {};
  const integrantes = Object.values(db.usuarios).map((u) => {
    nombres[u.id] = u.nombre;
    return { id: u.id, nombre: u.nombre, correo: u.correo || "", telefono: u.telefono || "",
      whatsapp: u.whatsapp || "", cumple: u.cumple || "", sobre: u.sobre || "" };
  });
  const autor = (x) => ({ ...x, por: nombres[x.por] || "" });
  return {
    nombre: db.grupo?.nombre || "Grupo CUN", integrantes,
    fechas: (db.fechas || []).map(autor), comentarios: (db.comentarios || []).map(autor),
    recursos: (db.recursos || []).map(autor)
  };
}

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

const conLimite = (db) => ({ ...db, maxArchivo: MAX_ARCHIVO });

const buscar = (lista, idBuscado) => {
  const x = lista.find((e) => e.id === idBuscado);
  if (!x) throw new ErrorCliente("Eso ya no existe; recarga la página.", 404);
  return x;
};

/* ---------------------------------------------------------------- operaciones */

/** Cambia el tablero. Devuelve { db, borrarArchivo? }. */
export function aplicar(actual, op) {
  const db = actual || vacio();
  const ahora = new Date().toISOString();
  const autor = texto(op.autor, 60);

  switch (op.op) {
    case "nombre-grupo": {
      const nombre = texto(op.nombre, 60);
      if (!nombre) throw new ErrorCliente("Escribe un nombre.");
      db.nombre = nombre;
      break;
    }
    case "integrante": {
      const nombre = texto(op.nombre, 120);
      if (!nombre) throw new ErrorCliente("Escribe el nombre.");
      const datos = {
        nombre, correo: texto(op.correo, 120), telefono: texto(op.telefono, 40),
        whatsapp: texto(op.whatsapp, 40), sobre: texto(op.sobre, 2000),
        cumple: /^\d{4}-\d{2}-\d{2}$/.test(op.cumple || "") ? op.cumple : ""
      };
      if (op.id) Object.assign(buscar(db.integrantes, op.id), datos);
      else {
        if (db.integrantes.length >= 40) throw new ErrorCliente("Ya hay demasiados integrantes.");
        db.integrantes.push({ id: id(), ...datos });
      }
      break;
    }
    case "integrante-borrar":
      buscar(db.integrantes, op.id);
      db.integrantes = db.integrantes.filter((x) => x.id !== op.id);
      break;
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
      if (op.id) Object.assign(buscar(db.fechas, op.id), datos, { editado: ahora });
      else db.fechas.push({ id: id(), ...datos, listo: false, por: autor, creado: ahora });
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
      db.comentarios.push({ id: id(), texto: cuerpo, fecha: op.fecha || null, fijado: !op.fecha && !!op.fijado, por: autor, creado: ahora });
      if (db.comentarios.length > 2000) db.comentarios = db.comentarios.slice(-2000);
      break;
    }
    case "fijar": {
      const c = buscar(db.comentarios, op.id);
      c.fijado = !c.fijado;
      break;
    }
    case "comentario-borrar":
      buscar(db.comentarios, op.id);
      db.comentarios = db.comentarios.filter((x) => x.id !== op.id);
      break;
    case "link": {
      const url = limpiarUrl(op.url);
      if (!url) throw new ErrorCliente("Pega un link válido.");
      db.recursos.push({
        id: id(), tipo: "link", url, titulo: texto(op.titulo, 200) || url,
        categoria: CATEGORIAS.includes(op.categoria) ? op.categoria : "otro",
        materia: texto(op.materia, 120), nota: texto(op.nota, 500), por: autor, creado: ahora
      });
      break;
    }
    case "archivo": // lo agrega la ruta de subida, después de guardar el contenido
      db.recursos.push(op.recurso);
      break;
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
async function cambiar(store, op) {
  for (let intento = 0; intento < 8; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 10 + Math.random() * 60));
    let etag = null, actual = null;
    const meta = await store.getWithMetadata(KEY, { type: "json" });
    if (meta && meta.etag) { etag = meta.etag; actual = meta.data; }
    else if (meta) { etag = await etagPorLista(store, KEY); actual = await store.get(KEY, { type: "json" }); }

    const res = aplicar(normalizar(actual && structuredClone(actual)), op);
    const r = await store.setJSON(KEY, res.db, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (r.modified) return res;
  }
  throw new ErrorCliente("Mucha gente escribiendo a la vez; intenta otra vez.", 409);
}

/* ---------------------------------------------------------------- calendario .ics */

const icsTexto = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsFecha = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const NOMBRE_TIPO = { entrega: "Entrega", parcial: "Parcial", reunion: "Reunión", clase: "Clase", otro: "Fecha" };

export function calendarioIcs(db) {
  const sello = icsFecha(new Date());
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//grupo-cun//ES", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", `X-WR-CALNAME:${icsTexto(db.nombre)}`];
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
  const leer = async () => normalizar(await store.get(KEY, { type: "json" })) || vacio();

  try {
    if (ruta === "calendario.ics" && req.method === "GET") {
      return new Response(calendarioIcs(await leer()), {
        headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    // Abrir / descargar un archivo
    const m = /^archivo\/([A-Za-z0-9_-]+)$/.exec(ruta);
    if (m && req.method === "GET") {
      const db = await leer();
      const r = db.recursos.find((x) => x.id === m[1] && x.tipo === "archivo");
      const datos = r && await store.get("archivo/" + r.id, { type: "arrayBuffer" });
      if (!datos) return new Response("Este archivo ya no existe.", { status: 404 });
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
        por: texto(p.get("autor"), 60), creado: new Date().toISOString()
      };
      await store.set("archivo/" + recurso.id, datos);
      try {
        return responder(conLimite((await cambiar(store, { op: "archivo", recurso })).db));
      } catch (e) {
        await store.delete("archivo/" + recurso.id);
        throw e;
      }
    }

    if (ruta !== "") return responder({ error: "No encontrado" }, 404);
    if (req.method === "GET") return responder(conLimite(await leer()));
    if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);

    let op;
    try { op = await req.json(); } catch { throw new ErrorCliente("Datos inválidos."); }
    if (!op || typeof op.op !== "string") throw new ErrorCliente("Datos inválidos.");
    const res = await cambiar(store, op);
    if (res.borrarArchivo) await store.delete("archivo/" + res.borrarArchivo);
    return responder(conLimite(res.db));
  } catch (e) {
    if (e instanceof ErrorCliente) return responder({ error: e.message }, e.status);
    console.error(e);
    return responder({ error: "Algo falló en el servidor. Intenta otra vez." }, 500);
  }
}

export default (req) => manejar(req, getStore({ name: "grupo", consistency: "strong" }));
