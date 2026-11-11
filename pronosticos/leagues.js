// Ligas disponibles. La clave es el identificador de la liga en la fuente de datos (ESPN).
// Ya NO se guardan listas de equipos: tabla, calendario y equipos se leen en vivo, así que
// ascensos, descensos y cambios de nombre no requieren mantenimiento.
//   group: parámetros del modelo ('betplay' | 'europa'); null = sin modelo de goles (solo mercado).
//   kind:  'liga' (tabla única, hay modelo) | 'copa' (equipos de ligas distintas: solo mercado).
(function (root) {
  'use strict';

  const LEAGUES = {
    'col.1': { name: 'Liga BetPlay Dimayor (Colombia)', group: 'betplay', kind: 'liga', country: 'CO' },
    'eng.1': { name: 'Premier League (Inglaterra)', group: 'europa', kind: 'liga' },
    'esp.1': { name: 'LaLiga (España)', group: 'europa', kind: 'liga' },
    'ita.1': { name: 'Serie A (Italia)', group: 'europa', kind: 'liga' },
    'ger.1': { name: 'Bundesliga (Alemania)', group: 'europa', kind: 'liga' },
    'fra.1': { name: 'Ligue 1 (Francia)', group: 'europa', kind: 'liga' },
    'conmebol.libertadores': { name: 'Copa Libertadores', group: null, kind: 'copa' },
    'conmebol.sudamericana': { name: 'Copa Sudamericana', group: null, kind: 'copa' },
    'uefa.champions': { name: 'UEFA Champions League', group: null, kind: 'copa' },
    'uefa.europa': { name: 'UEFA Europa League', group: null, kind: 'copa' }
  };

  // Altitud aproximada (m s. n. m., ±50 m) de las ciudades sede del fútbol colombiano.
  // Solo se usa cuando no hay desglose local/visitante (que ya refleja el efecto de la sede).
  const CITY_ALTITUDE_M = {
    'bogota': 2600, 'tunja': 2810, 'pasto': 2527, 'manizales': 2150, 'medellin': 1495, 'itagui': 1550,
    'envigado': 1575, 'rionegro': 2125, 'pereira': 1411, 'armenia': 1480, 'ibague': 1285, 'cali': 1000,
    'palmira': 1000, 'bucaramanga': 960, 'floridablanca': 925, 'villavicencio': 467, 'yopal': 350,
    'cucuta': 320, 'valledupar': 170, 'neiva': 442, 'barranquilla': 20, 'monteria': 18, 'santa marta': 6,
    'cartagena': 2, 'popayan': 1740, 'tulua': 970, 'barrancabermeja': 75
  };
  // Ciudad base de cada club (palabra clave del nombre → ciudad). El orden importa: lo más específico primero.
  const CLUB_BASE_CITY = [
    ['aguilas', 'medellin'], ['alianza', 'valledupar'], ['america', 'cali'], ['bucaramanga', 'bucaramanga'],
    ['nacional', 'medellin'], ['chico', 'tunja'], ['cucuta', 'cucuta'], ['tolima', 'ibague'],
    ['deportivo cali', 'palmira'], ['pasto', 'pasto'], ['pereira', 'pereira'], ['fortaleza', 'bogota'],
    ['medellin', 'medellin'], ['santa fe', 'bogota'], ['internacional', 'bogota'], ['equidad', 'bogota'],
    ['jaguares', 'monteria'], ['junior', 'barranquilla'], ['llaneros', 'villavicencio'], ['millonarios', 'bogota'],
    ['once caldas', 'manizales'], ['envigado', 'envigado'], ['magdalena', 'santa marta'], ['cartagena', 'cartagena'],
    ['huila', 'neiva'], ['quindio', 'armenia'], ['patriotas', 'tunja'], ['cali', 'palmira']
  ];

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function cityAltitude(city) {
    const c = norm(city);
    if (!c) return null;
    for (const k of Object.keys(CITY_ALTITUDE_M)) if (c === k || c.startsWith(k + ' ') || c.endsWith(' ' + k) || c.includes(' ' + k + ' ')) return CITY_ALTITUDE_M[k];
    return null;
  }
  function clubBaseAltitude(teamName) {
    const n = ' ' + norm(teamName) + ' ';
    for (const [key, city] of CLUB_BASE_CITY) if (n.includes(' ' + key + ' ')) return CITY_ALTITUDE_M[city];
    return null;
  }

  const api = { LEAGUES, CITY_ALTITUDE_M, cityAltitude, clubBaseAltitude, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.LEAGUES = LEAGUES; root.Leagues = api; }
})(typeof window !== 'undefined' ? window : globalThis);
