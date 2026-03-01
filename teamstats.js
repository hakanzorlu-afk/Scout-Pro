// api/teamstats.js
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.FOOTBALL_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API key eksik' });

  const { homeId, awayId, matchId } = req.query;
  if (!homeId || !awayId) return res.status(400).json({ error: 'homeId ve awayId gerekli' });

  const headers = { 'X-Auth-Token': API_KEY };

  try {
    const [h2hRes, homeRes, awayRes] = await Promise.all([
      matchId
        ? fetch(`https://api.football-data.org/v4/matches/${matchId}/head2head?limit=10`, { headers })
            .then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] }))
        : Promise.resolve({ matches: [] }),
      fetch(`https://api.football-data.org/v4/teams/${homeId}/matches?status=FINISHED&limit=15`, { headers })
        .then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] })),
      fetch(`https://api.football-data.org/v4/teams/${awayId}/matches?status=FINISHED&limit=15`, { headers })
        .then(r => r.ok ? r.json() : { matches: [] }).catch(() => ({ matches: [] })),
    ]);

    const h2h = (h2hRes.matches || []).slice(0,6).map(m => ({
      date: m.utcDate ? new Date(m.utcDate).toLocaleDateString('tr-TR') : '?',
      home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
      away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
      score: m.score?.fullTime ? `${m.score.fullTime.home}-${m.score.fullTime.away}` : '?-?',
      ht: m.score?.halfTime ? `${m.score.halfTime.home}-${m.score.halfTime.away}` : '?-?',
      winner: m.score?.winner || 'DRAW',
      homeId: m.homeTeam?.id,
      competition: m.competition?.name || '',
      stage: m.stage || '',
    }));

    function processTeam(matches, teamId) {
      const tid = parseInt(teamId);
      const recent = (matches || []).slice(0,12);
      const form = [];
      let gf=0, ga=0, htGf=0, htGa=0, w=0, d=0, l=0;
      let over25=0, btts=0, cleanSheets=0, failedToScore=0;

      recent.forEach(m => {
        const isHome = m.homeTeam?.id === tid;
        const ft = m.score?.fullTime;
        const ht = m.score?.halfTime;
        if (!ft || ft.home === null) return;

        const mgf = isHome ? ft.home : ft.away;
        const mga = isHome ? ft.away : ft.home;
        const htgf = ht ? (isHome ? ht.home : ht.away) : 0;
        const htga = ht ? (isHome ? ht.away : ht.home) : 0;

        gf+=mgf; ga+=mga; htGf+=htgf; htGa+=htga;
        if(mgf+mga > 2.5) over25++;
        if(mgf>0 && mga>0) btts++;
        if(mga===0) cleanSheets++;
        if(mgf===0) failedToScore++;

        if(mgf>mga){w++;form.push('W');}
        else if(mgf===mga){d++;form.push('D');}
        else{l++;form.push('L');}
      });

      const n = recent.length || 1;
      return {
        form: form.slice(0,6),
        avgFor: +(gf/n).toFixed(2),
        avgAgainst: +(ga/n).toFixed(2),
        htAvgFor: +(htGf/n).toFixed(2),
        htAvgAgainst: +(htGa/n).toFixed(2),
        over25Rate: +(over25/n*100).toFixed(0),
        bttsRate: +(btts/n*100).toFixed(0),
        cleanSheetRate: +(cleanSheets/n*100).toFixed(0),
        failedToScoreRate: +(failedToScore/n*100).toFixed(0),
        wins:w, draws:d, losses:l,
        gamesPlayed: recent.length,
      };
    }

    res.setHeader('Cache-Control', 's-maxage=600');
    res.status(200).json({
      h2h,
      home: processTeam(homeRes.matches, homeId),
      away: processTeam(awayRes.matches, awayId),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
