/* ==========================================================================
   Sala FF — API de la sala (Netlify Function + Netlify Blobs)

   Guarda cada sala como un único documento JSON:
     { config: {...}, jugadores: { <pid>: {...} } }

   GET  /api/sala?sala=principal          → devuelve el documento
   POST /api/sala?sala=principal  {op…}   → aplica un cambio y devuelve el documento

   Operaciones:
     { op: "config",  parcial: {...} }           mezcla campos de la config
     { op: "jugador", pid, jugador: {...} }      crea o reemplaza un jugador
     { op: "borrar",  pid }                      quita un jugador
     { op: "vaciar" }                            quita a todos

   Los cambios se aplican leyendo el documento, mezclando y escribiendo con
   control de versión (etag): si dos personas escriben a la vez, ninguna
   pisa a la otra; la segunda reintenta sobre el estado nuevo.
   ========================================================================== */

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/sala" };

const CAMPOS_CONFIG = new Set([
  "estado", "cuando", "modo", "modalidad", "mapa", "apuesta", "codigo", "clave",
  "nombre1", "nombre2", "nota", "liderId", "liderNombre", "actualizado"
]);

const texto = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const limpiarSala = (v) => (texto(v, 30).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "principal");
const limpiarPid = (v) => texto(v, 40).replace(/[^A-Za-z0-9_-]/g, "");

function limpiarConfig(parcial) {
  const out = {};
  if (!parcial || typeof parcial !== "object") return out;
  for (const [k, v] of Object.entries(parcial)) {
    if (!CAMPOS_CONFIG.has(k)) continue;
    if (k === "modo" || k === "actualizado") out[k] = Number(v) || 0;
    else out[k] = texto(v, k === "nota" ? 200 : 60);
  }
  return out;
}

function limpiarJugador(j) {
  if (!j || typeof j !== "object") return null;
  const nombre = texto(j.nombre, 22).trim();
  if (!nombre) return null;
  const equipo = [0, 1, 2].includes(Number(j.equipo)) ? Number(j.equipo) : 0;
  const out = { nombre, equipo, rol: texto(j.rol, 20), ts: Number(j.ts) || Date.now() };
  if (j.manual) { out.manual = true; out.por = texto(j.por, 22); }
  return out;
}

function aplicar(doc, op) {
  const d = { config: { ...(doc?.config || {}) }, jugadores: { ...(doc?.jugadores || {}) } };
  switch (op?.op) {
    case "config":
      Object.assign(d.config, limpiarConfig(op.parcial));
      break;
    case "jugador": {
      const pid = limpiarPid(op.pid);
      const j = limpiarJugador(op.jugador);
      if (!pid || !j) throw new Error("jugador inválido");
      if (!d.jugadores[pid] && Object.keys(d.jugadores).length >= 60) throw new Error("la sala está llena");
      d.jugadores[pid] = j;
      break;
    }
    case "borrar":
      delete d.jugadores[limpiarPid(op.pid)];
      break;
    case "vaciar":
      d.jugadores = {};
      break;
    default:
      throw new Error("operación desconocida");
  }
  return d;
}

/* algunos entornos no devuelven el etag al leer; el listado sí lo trae */
async function etagPorLista(store, key) {
  const { blobs } = await store.list({ prefix: key });
  return blobs.find((b) => b.key === key)?.etag || null;
}

const responder = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export default async (req) => {
  const url = new URL(req.url);
  const sala = limpiarSala(url.searchParams.get("sala"));
  const store = getStore({ name: "salas", consistency: "strong" });
  const key = "sala/" + sala;

  try {
    if (req.method === "GET") {
      const doc = await store.get(key, { type: "json" });
      return responder(doc || { config: {}, jugadores: {} });
    }

    if (req.method === "POST") {
      let op;
      try { op = await req.json(); } catch { return responder({ error: "JSON inválido" }, 400); }

      for (let intento = 0; intento < 8; intento++) {
        if (intento) await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));

        /* leemos versión (etag) y contenido; la escritura va condicionada a
           esa versión: si otra persona escribió en medio, `modified` sale
           false y volvemos a intentar sobre el estado nuevo */
        let etag = null, actual = null;
        const meta = await store.getWithMetadata(key, { type: "json" });
        if (meta && meta.etag) {
          etag = meta.etag;
          actual = meta.data;
        } else if (meta) {
          etag = await etagPorLista(store, key);      // primero la versión…
          actual = await store.get(key, { type: "json" }); // …luego el contenido
        }

        const nuevo = aplicar(actual, op);
        const cond = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
        const r = await store.setJSON(key, nuevo, cond);
        if (r.modified) return responder(nuevo);
      }
      return responder({ error: "mucha gente escribiendo a la vez, intenta de nuevo" }, 409);
    }

    return responder({ error: "método no permitido" }, 405);
  } catch (e) {
    const msg = String(e?.message || e);
    const esCliente = /inválid|desconocida|llena/.test(msg);
    return responder({ error: msg }, esCliente ? 400 : 500);
  }
};
