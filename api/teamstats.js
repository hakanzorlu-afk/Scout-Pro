// api/teamstats.js
// Takım istatistikleri + H2H verisini çeker

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API key eksik' });

  const { homeId, awayId, matchId, leagueCode } = req.query;

  if (!homeId || !awayId) {
    return res.status(400).json({ error: 'homeId ve awayId gerekli' });
  }

  const headers = { 'X-Auth-Token': API_KEY };

  try {
    // Fetch H2H + match detail, and team recent matches in parallel
    const [h2hRes, homeMatchesRes, awayMatchesRes] = await Promise.all([
      // H2H: last 10 matches between these teams (via match endpoint if matchId available)
      matchId
        ? fetch(`https://api.football-data.org/v4/matches/${matchId}/head2head?limit=10`, { headers }).then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] }))
        : Promise.resolve({ matches: [] }),

      // Home team last 10 matches
      fetch(`https://api.football-data.org/v4/teams/${homeId}/matches?status=FINISHED&limit=10`, { headers })
        .then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] })),

      // Away team last 10 matches
      fetch(`https://api.football-data.org/v4/teams/${awayId}/matches?status=FINISHED&limit=10`, { headers })
        .then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] })),
    ]);

    // Process H2H
    const h2hMatches = (h2hRes.matches || []).slice(0, 5).map(m => ({
      date: m.utcDate ? new Date(m.utcDate).toLocaleDateString('tr-TR') : '?',
      home: m.homeTeam?.name || '?',
      away: m.awayTeam?.name || '?',
      score: m.score?.fullTime ? `${m.score.fullTime.home}-${m.score.fullTime.away}` : '?-?',
      ht: m.score?.halfTime ? `${m.score.halfTime.home}-${m.score.halfTime.away}` : '?-?',
      winner: m.score?.winner || 'DRAW',
      homeId: m.homeTeam?.id,
      awayId: m.awayTeam?.id,
    }));

    // Process team form & stats
    function processTeamMatches(matches, teamId) {
      const tid = parseInt(teamId);
      const recent = (matches || []).slice(0, 10);
      const form = [];
      let goalsFor = 0, goalsAgainst = 0, wins = 0, draws = 0, losses = 0;
      let htGoalsFor = 0, htGoalsAgainst = 0;

      recent.forEach(m => {
        const isHome = m.homeTeam?.id === tid;
        const ft = m.score?.fullTime;
        const ht = m.score?.halfTime;
        if (!ft) return;

        const gf = isHome ? ft.home : ft.away;
        const ga = isHome ? ft.away : ft.home;
        const htgf = ht ? (isHome ? ht.home : ht.away) : 0;
        const htga = ht ? (isHome ? ht.away : ht.home) : 0;

        goalsFor += gf; goalsAgainst += ga;
        htGoalsFor += htgf; htGoalsAgainst += htga;

        if (gf > ga) { wins++; form.push('W'); }
        else if (gf === ga) { draws++; form.push('D'); }
        else { losses++; form.push('L'); }
      });

      const n = recent.length || 1;
      return {
        form: form.slice(0, 5),
        avgFor: +(goalsFor / n).toFixed(2),
        avgAgainst: +(goalsAgainst / n).toFixed(2),
        htAvgFor: +(htGoalsFor / n).toFixed(2),
        htAvgAgainst: +(htGoalsAgainst / n).toFixed(2),
        wins, draws, losses,
        gamesPlayed: recent.length,
      };
    }

    const homeStats = processTeamMatches(homeMatchesRes.matches, homeId);
    const awayStats = processTeamMatches(awayMatchesRes.matches, awayId);

    res.status(200).json({
      h2h: h2hMatches,
      home: homeStats,
      away: awayStats,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
