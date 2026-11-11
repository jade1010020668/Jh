/* ==========================================================================
   Pronósticos — respaldo de datos

   La app lee el calendario, las tablas y las cuotas de referencia directamente
   de la API pública de ESPN. Algunas redes (oficinas, colegios, operadores con
   filtro de "deportes") bloquean ese dominio y la app quedaría sin datos.
   Esta función es el plan B: la app la usa SOLO si la consulta directa falla.

   GET /api/espn?u=<URL de ESPN>   → devuelve el mismo JSON

   Solo acepta las cuatro consultas de fútbol que usa la app; cualquier otra
   dirección se rechaza, así que no sirve como proxy abierto. No recibe ni
   guarda ningún dato del usuario.
   ========================================================================== */

export const config = { path: "/api/espn" };

const LIGA = "[a-z]{2,12}\\.[a-z0-9_.]{1,24}";
const PERMITIDAS = [
  new RegExp(`^https://site\\.api\\.espn\\.com/apis/site/v2/sports/soccer/${LIGA}/scoreboard\\?dates=\\d{8}$`),
  new RegExp(`^https://site\\.api\\.espn\\.com/apis/v2/sports/soccer/${LIGA}/standings$`),
  new RegExp(`^https://site\\.api\\.espn\\.com/apis/site/v2/sports/soccer/${LIGA}/summary\\?event=\\d{1,12}$`),
  new RegExp(`^https://sports\\.core\\.api\\.espn\\.com/v2/sports/soccer/leagues/${LIGA}/seasons/\\d{4}/types/\\d{1,2}/groups/\\d{1,2}/standings/\\d{1,2}$`)
];

const json = (obj, status, cache) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache || "no-store" }
});

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Solo GET." }, 405);
  const u = new URL(req.url).searchParams.get("u") || "";
  if (!PERMITIDAS.some((r) => r.test(u))) return json({ error: "Consulta no permitida." }, 400);
  try {
    const r = await fetch(u, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(12000)
    });
    const body = await r.text();
    // Un minuto de caché: suficiente para no repetir la consulta mientras se navega, corto para cuotas y marcadores
    return new Response(body, {
      status: r.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": r.ok ? "public, max-age=60" : "no-store" }
    });
  } catch {
    return json({ error: "La fuente de datos no respondió." }, 502);
  }
};
