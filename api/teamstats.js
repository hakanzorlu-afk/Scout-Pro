// api/teamstats.js - AllSportsAPI version
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.ALLSPORTS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ALLSPORTS_API_KEY eksik' });

  const { homeId, awayId, matchId } = req.query;
  if (!homeId || !awayId) return res.status(400).json({ error: 'homeId ve awayId gerekli' });

  try {
    const [homeRes, awayRes, h2hRes] = await Promise.all([
      fetch(`https://allsportsapi.com/api/football/?met=Teams&APIkey=${API_KEY}&teamId=${homeId}`).then(r=>r.ok?r.json():{result:[]}).catch(()=>({result:[]})),
      fetch(`https://allsportsapi.com/api/football/?met=Teams&APIkey=${API_KEY}&teamId=${awayId}`).then(r=>r.ok?r.json():{result:[]}).catch(()=>({result:[]})),
      matchId ? fetch(`https://allsportsapi.com/api/football/?met=H2H&APIkey=${API_KEY}&firstTeamId=${homeId}&secondTeamId=${awayId}`).then(r=>r.ok?r.json():{result:[]}).catch(()=>({result:[]})) : Promise.resolve({result:[]}),
    ]);

    function processTeam(data) {
      const matches = (data.result?.[0]?.team_last5matches || []);
      let gf=0,ga=0,htgf=0,htga=0,w=0,d=0,l=0,ov25=0,btts=0;
      const form = [];
      matches.forEach(m => {
        const isHome = m.match_hometeam_id == homeId || m.match_hometeam_id == awayId;
        const fh = parseInt(m.match_hometeam_score)||0;
        const fa = parseInt(m.match_awayteam_score)||0;
        const hh = parseInt(m.match_hometeam_halftime_score)||0;
        const ha = parseInt(m.match_awayteam_halftime_score)||0;
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
      const n = matches.length||1;
      return {
        form: form.slice(0,6),
        avgFor: +(gf/n).toFixed(2),
        avgAgainst: +(ga/n).toFixed(2),
        htAvgFor: +(htgf/n).toFixed(2),
        htAvgAgainst: +(htga/n).toFixed(2),
        over25Rate: +(ov25/n*100).toFixed(0),
        bttsRate: +(btts/n*100).toFixed(0),
        cleanSheetRate: 0,
        failedToScoreRate: 0,
        wins:w, draws:d, losses:l,
        gamesPlayed: matches.length,
      };
    }

    const h2hMatches = (h2hRes.result||[]).slice(0,6).map(m=>({
      date: m.match_date||'?',
      home: m.match_hometeam_name||'?',
      away: m.match_awayteam_name||'?',
      score: m.match_hometeam_score&&m.match_awayteam_score ? `${m.match_hometeam_score}-${m.match_awayteam_score}` : '?-?',
      ht: m.match_hometeam_halftime_score&&m.match_awayteam_halftime_score ? `${m.match_hometeam_halftime_score}-${m.match_awayteam_halftime_score}` : '?-?',
      winner: m.match_winner==='hometeam'?'HOME_TEAM':m.match_winner==='awayteam'?'AWAY_TEAM':'DRAW',
      homeId: m.match_hometeam_id,
    }));

    res.setHeader('Cache-Control', 's-maxage=600');
    res.status(200).json({
      h2h: h2hMatches,
      home: processTeam(homeRes),
      away: processTeam(awayRes),
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
