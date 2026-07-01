// Equipos por liga — temporada vigente a julio de 2026.
// Ligas domésticas: rosters 2026 (Colombia) y 2026-27 (Europa).
// Competiciones continentales: se juegan por edición y el sorteo de la fase liga
// 2026-27 aún no se realiza, por eso usan entrada de texto libre.
// En TODAS las ligas el selector ofrece además "✏️ Otro equipo…" para escribir
// cualquier club; la búsqueda web valida y trae los datos del partido.
const LEAGUES = {
  "liga-betplay": {
    name: "Liga BetPlay Dimayor (Colombia) 2026",
    country: "Colombia",
    teams: [
      "Águilas Doradas",
      "Alianza Valledupar",
      "América de Cali",
      "Atlético Bucaramanga",
      "Atlético Nacional",
      "Boyacá Chicó",
      "Cúcuta Deportivo",
      "Deportes Tolima",
      "Deportivo Cali",
      "Deportivo Pasto",
      "Deportivo Pereira",
      "Fortaleza FC",
      "Independiente Medellín",
      "Independiente Santa Fe",
      "Internacional de Bogotá",
      "Jaguares de Córdoba",
      "Junior de Barranquilla",
      "Llaneros FC",
      "Millonarios FC",
      "Once Caldas"
    ]
  },
  "premier-league": {
    name: "Premier League (Inglaterra) 2026-27",
    country: "Inglaterra",
    teams: [
      "Arsenal",
      "Aston Villa",
      "Bournemouth",
      "Brentford",
      "Brighton & Hove Albion",
      "Chelsea",
      "Coventry City",
      "Crystal Palace",
      "Everton",
      "Fulham",
      "Hull City",
      "Ipswich Town",
      "Leeds United",
      "Liverpool",
      "Manchester City",
      "Manchester United",
      "Newcastle United",
      "Nottingham Forest",
      "Sunderland",
      "Tottenham Hotspur"
    ]
  },
  "la-liga": {
    name: "LaLiga EA Sports (España) 2026-27",
    country: "España",
    teams: [
      "Alavés",
      "Athletic Club",
      "Atlético de Madrid",
      "FC Barcelona",
      "Celta de Vigo",
      "Deportivo de La Coruña",
      "Elche",
      "Espanyol",
      "Getafe",
      "Levante",
      "Málaga CF",
      "Osasuna",
      "Racing de Santander",
      "Rayo Vallecano",
      "Real Betis",
      "Real Madrid",
      "Real Sociedad",
      "Sevilla",
      "Valencia",
      "Villarreal"
    ]
  },
  "serie-a": {
    name: "Serie A (Italia) 2026-27",
    country: "Italia",
    teams: [
      "Atalanta",
      "Bologna",
      "Cagliari",
      "Como",
      "Fiorentina",
      "Frosinone",
      "Genoa",
      "Inter de Milán",
      "Juventus",
      "Lazio",
      "Lecce",
      "AC Milan",
      "Monza",
      "Napoli",
      "Parma",
      "AS Roma",
      "Sassuolo",
      "Torino",
      "Udinese",
      "Venezia"
    ]
  },
  "bundesliga": {
    name: "Bundesliga (Alemania) 2026-27",
    country: "Alemania",
    teams: [
      "FC Augsburg",
      "Bayer Leverkusen",
      "Bayern Múnich",
      "Borussia Dortmund",
      "Borussia Mönchengladbach",
      "Eintracht Frankfurt",
      "SV Elversberg",
      "SC Freiburg",
      "Hamburger SV",
      "TSG Hoffenheim",
      "1. FC Köln",
      "RB Leipzig",
      "Mainz 05",
      "SC Paderborn",
      "FC Schalke 04",
      "VfB Stuttgart",
      "Union Berlin",
      "Werder Bremen"
    ]
  },
  "ligue-1": {
    name: "Ligue 1 (Francia) 2026-27",
    country: "Francia",
    teams: [
      "Angers SCO",
      "AJ Auxerre",
      "Stade Brestois",
      "Le Havre AC",
      "Le Mans FC",
      "RC Lens",
      "Lille OSC",
      "FC Lorient",
      "Olympique de Lyon",
      "Olympique de Marsella",
      "AS Mónaco",
      "OGC Nice",
      "Paris FC",
      "Paris Saint-Germain",
      "Stade Rennais",
      "RC Strasbourg",
      "Toulouse FC",
      "ESTAC Troyes"
    ]
  },
  "copa-libertadores": {
    name: "Copa Libertadores (CONMEBOL) 2026",
    country: "Sudamérica",
    note: "Edición 2026 en curso. Escribe los clubes participantes; la búsqueda web valida los datos del partido.",
    freeTextOnly: true,
    teams: []
  },
  "champions-league": {
    name: "UEFA Champions League 2026-27",
    country: "Europa",
    note: "El sorteo de la fase liga 2026-27 se realiza a finales de agosto de 2026. Escribe los equipos; la búsqueda web valida los datos.",
    freeTextOnly: true,
    teams: []
  },
  "europa-league": {
    name: "UEFA Europa League 2026-27",
    country: "Europa",
    note: "El sorteo de la fase liga 2026-27 se realiza a finales de agosto de 2026. Escribe los equipos; la búsqueda web valida los datos.",
    freeTextOnly: true,
    teams: []
  }
};
