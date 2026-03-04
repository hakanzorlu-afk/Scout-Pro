module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const KEY = process.env.FOOTBALL_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'FOOTBALL_API_KEY eksik' });

  const { homeId, awayId } = req.query;
  if (!homeId || !awayId) return res.status(400).json({ error: 'homeId ve awayId gerekli' });

  try {
    const [hRes, aRes] = await Promise.all([
      fetch(`https://api.football-data.org/v4/teams/${homeId}/matches?status=FINISHED&limit=10`, { headers: { 'X-Auth-Token': KEY } }),
      fetch(`https://api.football-data.org/v4/teams/${awayId}/matches?status=FINISHED&limit=10`, { headers: { 'X-Auth-Token': KEY } }),
    ]);

    function calcStats(data, teamId) {
      const matches = data.matches || [];
      let gf=0, ga=0, htgf=0, htga=0, w=0, d=0, l=0, btts=0, ov25=0;
      const form = [];
      matches.forEach(m => {
        const isHome = m.homeTeam.id == teamId;
        const fh = m.score?.fullTime?.home ?? 0;
        const fa = m.score?.fullTime?.away ?? 0;
        const hh = m.score?.halfTime?.home ?? 0;
        const ha = m.score?.halfTime?.away ?? 0;
        const mgf = isHome ? fh : fa;
        const mga = isHome ? fa : fh;
        const mhgf = isHome ? hh : ha;
        const mhga = isHome ? ha : hh;
        gf+=mgf; ga+=mga; htgf+=mhgf; htga+=mhga;
        if(fh+fa>2.5) ov25++;
        if(fh>0&&fa>0) btts++;
        if(mgf>mga){w++;form.push('W');}
        else if(mgf===mga){d++;form.push('D');}
        else{l++;form.push('L');}
      });
      const n = matches.length || 1;
      return {
        avgFor: +(gf/n).toFixed(2),
        avgAgainst: +(ga/n).toFixed(2),
        htAvgFor: +(htgf/n).toFixed(2),
        htAvgAgainst: +(htga/n).toFixed(2),
        over25Rate: +(ov25/n*100).toFixed(0),
        bttsRate: +(btts/n*100).toFixed(0),
        wins: w, draws: d, losses: l,
        form: form.slice(0,6),
        gamesPlayed: matches.length,
      };
    }

    const hData = hRes.ok ? await hRes.json() : { matches: [] };
    const aData = aRes.ok ? await aRes.json() : { matches: [] };

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({
      home: calcStats(hData, homeId),
      away: calcStats(aData, awayId),
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
