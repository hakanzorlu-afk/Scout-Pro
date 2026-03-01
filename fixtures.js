// api/fixtures.js
// Vercel Serverless Function - football-data.org API proxy
// Desteklenen Ligler (Ücretsiz Plan):
//   PL  = Premier League
//   PD  = La Liga
//   BL1 = Bundesliga
//   SA  = Serie A
//   FL1 = Ligue 1
//   CL  = Champions League
//   EL  = Europa League
//   TR1 = Süper Lig (Türkiye)

const LEAGUES = ['PL','PD','BL1','SA','FL1','CL','EL','TR1'];

const LEAGUE_NAMES = {
  PL:  'Premier League',
  PD:  'La Liga',
  BL1: 'Bundesliga',
  SA:  'Serie A',
  FL1: 'Ligue 1',
  CL:  'Champions League',
  EL:  'Europa League',
  TR1: 'Süper Lig',
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key tanımlanmamış. Vercel Environment Variables kontrol et.' });
  }

  // Date param: ?date=2026-03-01 (default: today)
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    // Fetch fixtures for all leagues in parallel
    const requests = LEAGUES.map(league =>
      fetch(`https://api.football-data.org/v4/competitions/${league}/matches?dateFrom=${date}&dateTo=${date}`, {
        headers: { 'X-Auth-Token': API_KEY }
      }).then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] }))
    );

    const results = await Promise.all(requests);

    // Merge and format
    const matches = [];
    results.forEach((data, i) => {
      const leagueCode = LEAGUES[i];
      (data.matches || []).forEach(m => {
        matches.push({
          id: String(m.id),
          league: LEAGUE_NAMES[leagueCode] || leagueCode,
          leagueCode,
          home: m.homeTeam?.name || m.homeTeam?.shortName || '?',
          homeId: m.homeTeam?.id,
          away: m.awayTeam?.name || m.awayTeam?.shortName || '?',
          awayId: m.awayTeam?.id,
          time: m.utcDate ? new Date(m.utcDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : '?',
          utcDate: m.utcDate,
          status: m.status, // SCHEDULED, LIVE, FINISHED, etc.
          score: m.score,
          matchday: m.matchday,
        });
      });
    });

    // Sort by time
    matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    res.status(200).json({ date, matches, count: matches.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
