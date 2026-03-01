// api/fixtures.js
const LEAGUES = ['PL','PD','BL1','SA','FL1','CL','EL','TR1','PPL','DED','BSA','MLS'];

const LEAGUE_NAMES = {
  PL:'Premier League', PD:'La Liga', BL1:'Bundesliga',
  SA:'Serie A', FL1:'Ligue 1', CL:'Champions League',
  EL:'Europa League', TR1:'Süper Lig', PPL:'Primeira Liga',
  DED:'Eredivisie', BSA:'Brasileirao', MLS:'MLS',
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key tanımlanmamış.' });
  }

  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    // Fetch all leagues in parallel
    const requests = LEAGUES.map(league =>
      fetch(`https://api.football-data.org/v4/competitions/${league}/matches?dateFrom=${date}&dateTo=${date}`, {
        headers: { 'X-Auth-Token': API_KEY }
      })
      .then(r => r.ok ? r.json() : { matches: [] })
      .catch(() => ({ matches: [] }))
    );

    const results = await Promise.all(requests);

    const matches = [];
    results.forEach((data, i) => {
      const lc = LEAGUES[i];
      (data.matches || []).forEach(m => {
        matches.push({
          id: String(m.id),
          league: LEAGUE_NAMES[lc] || lc,
          leagueCode: lc,
          home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
          homeFull: m.homeTeam?.name || '?',
          homeId: m.homeTeam?.id,
          away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
          awayFull: m.awayTeam?.name || '?',
          awayId: m.awayTeam?.id,
          time: m.utcDate ? new Date(m.utcDate).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}) : '?',
          utcDate: m.utcDate,
          status: m.status,
          score: m.score,
          matchday: m.matchday,
          stage: m.stage,
          competition: m.competition?.name,
        });
      });
    });

    matches.sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));

    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ date, matches, count: matches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
