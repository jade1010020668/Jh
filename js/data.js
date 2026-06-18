/* ============================================================================
 *  data.js  —  Datos del Mundial 2026 (Canadá · México · EE. UU.)
 * ----------------------------------------------------------------------------
 *  Fuente de los grupos: sorteo final oficial FIFA (5 dic 2025).
 *  Ratings Elo: aproximaciones ancladas a valores reales de junio 2026
 *  (eloratings.net / FIFA ranking). SON EDITABLES en la app — lo que
 *  importa es la metodología, no que el seed sea exacto al decimal.
 *
 *  Anclas reales conocidas (jun 2026):
 *    Argentina ~1890 (#1) · Francia 1887 · España 1856 · Inglaterra 1847
 *    Brasil 1765 · Marruecos 1755 · Portugal 1755
 * ==========================================================================*/

/* Hosts (sede): reciben una pequeña ventaja de localía en fase de grupos. */
const HOST_TEAMS = ["México", "Estados Unidos", "Canadá"];

/* Cada equipo: nombre, grupo (A–L), bandera (emoji) y Elo aproximado. */
const TEAMS = [
  // Grupo A
  { name: "México",            group: "A", flag: "🇲🇽", elo: 1700 },
  { name: "Sudáfrica",         group: "A", flag: "🇿🇦", elo: 1610 },
  { name: "Corea del Sur",     group: "A", flag: "🇰🇷", elo: 1665 },
  { name: "Chequia",           group: "A", flag: "🇨🇿", elo: 1670 },
  // Grupo B
  { name: "Canadá",            group: "B", flag: "🇨🇦", elo: 1700 },
  { name: "Bosnia y Herz.",    group: "B", flag: "🇧🇦", elo: 1640 },
  { name: "Catar",             group: "B", flag: "🇶🇦", elo: 1560 },
  { name: "Suiza",             group: "B", flag: "🇨🇭", elo: 1740 },
  // Grupo C
  { name: "Brasil",            group: "C", flag: "🇧🇷", elo: 1765 },
  { name: "Marruecos",         group: "C", flag: "🇲🇦", elo: 1755 },
  { name: "Haití",             group: "C", flag: "🇭🇹", elo: 1490 },
  { name: "Escocia",           group: "C", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", elo: 1665 },
  // Grupo D
  { name: "Estados Unidos",    group: "D", flag: "🇺🇸", elo: 1720 },
  { name: "Paraguay",          group: "D", flag: "🇵🇾", elo: 1640 },
  { name: "Australia",         group: "D", flag: "🇦🇺", elo: 1660 },
  { name: "Türkiye",           group: "D", flag: "🇹🇷", elo: 1720 },
  // Grupo E
  { name: "Alemania",          group: "E", flag: "🇩🇪", elo: 1825 },
  { name: "Curazao",           group: "E", flag: "🇨🇼", elo: 1490 },
  { name: "Costa de Marfil",   group: "E", flag: "🇨🇮", elo: 1675 },
  { name: "Ecuador",           group: "E", flag: "🇪🇨", elo: 1700 },
  // Grupo F
  { name: "Países Bajos",      group: "F", flag: "🇳🇱", elo: 1820 },
  { name: "Japón",             group: "F", flag: "🇯🇵", elo: 1715 },
  { name: "Suecia",            group: "F", flag: "🇸🇪", elo: 1690 },
  { name: "Túnez",             group: "F", flag: "🇹🇳", elo: 1640 },
  // Grupo G
  { name: "Bélgica",           group: "G", flag: "🇧🇪", elo: 1790 },
  { name: "Egipto",            group: "G", flag: "🇪🇬", elo: 1660 },
  { name: "Irán",              group: "G", flag: "🇮🇷", elo: 1670 },
  { name: "Nueva Zelanda",     group: "G", flag: "🇳🇿", elo: 1500 },
  // Grupo H
  { name: "España",            group: "H", flag: "🇪🇸", elo: 1856 },
  { name: "Cabo Verde",        group: "H", flag: "🇨🇻", elo: 1520 },
  { name: "Arabia Saudita",    group: "H", flag: "🇸🇦", elo: 1590 },
  { name: "Uruguay",           group: "H", flag: "🇺🇾", elo: 1790 },
  // Grupo I
  { name: "Francia",           group: "I", flag: "🇫🇷", elo: 1887 },
  { name: "Senegal",           group: "I", flag: "🇸🇳", elo: 1730 },
  { name: "Irak",              group: "I", flag: "🇮🇶", elo: 1560 },
  { name: "Noruega",           group: "I", flag: "🇳🇴", elo: 1750 },
  // Grupo J
  { name: "Argentina",         group: "J", flag: "🇦🇷", elo: 1890 },
  { name: "Argelia",           group: "J", flag: "🇩🇿", elo: 1680 },
  { name: "Austria",           group: "J", flag: "🇦🇹", elo: 1720 },
  { name: "Jordania",          group: "J", flag: "🇯🇴", elo: 1540 },
  // Grupo K
  { name: "Portugal",          group: "K", flag: "🇵🇹", elo: 1755 },
  { name: "RD del Congo",      group: "K", flag: "🇨🇩", elo: 1620 },
  { name: "Uzbekistán",        group: "K", flag: "🇺🇿", elo: 1590 },
  { name: "Colombia",          group: "K", flag: "🇨🇴", elo: 1780 },
  // Grupo L
  { name: "Inglaterra",        group: "L", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", elo: 1847 },
  { name: "Croacia",           group: "L", flag: "🇭🇷", elo: 1790 },
  { name: "Ghana",             group: "L", flag: "🇬🇭", elo: 1640 },
  { name: "Panamá",            group: "L", flag: "🇵🇦", elo: 1560 },
];

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

/* Exponer en navegador y (por si acaso) en Web Worker. */
if (typeof window !== "undefined") {
  window.TEAMS = TEAMS;
  window.GROUPS = GROUPS;
  window.HOST_TEAMS = HOST_TEAMS;
}
