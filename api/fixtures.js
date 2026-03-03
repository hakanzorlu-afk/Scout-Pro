module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const KEY = process.env.BZZOIRO_KEY;
  if (!KEY) return res.status(500).json({ error: 'BZZOIRO_KEY eksik' });

  const now = new Date();
  const trNow = new Date(now.getTime() + 3*60*60*1000);
  const today = req.query.date || trNow.toISOString().split('T')[0];

  const BASE = 'https://sports.bzzoiro.com';
  const HDR = { 'Authorization': `Token ${KEY}` };

  try {
    const [evRes, predRes, liveRes] = await Promise.all([
      fetch(`${BASE}/api/events/?date_from=${today}&date_to=${today}&page_size=200`, { headers: HDR }),
      fetch(`${BASE}/api/predictions/?upcoming=true&page_size=200`, { headers: HDR }),
      fetch(`${BASE}/api/live/`, { headers: HDR }).catch(() => null),
    ]);

    if (!evRes.ok) throw new Error(`Events API: ${evRes.status}`);

    const evData = await evRes.json();
    const predData = predRes.ok ? await predRes.json().catch(()=>({results:[]})) : {results:[]};
    const liveData = liveRes?.ok ? await liveRes.json().catch(()=>({results:[]})) : {results:[]};

    // Map predictions by event id
    const predMap = {};
    for (const p of (predData.results || [])) {
      const eid = p.event?.id || p.event;
      if (eid) predMap[eid] = p;
    }

    // Map live by event id
    const liveMap = {};
    for (const l of (liveData.results || [])) {
      const eid = l.event?.id || l.event || l.id;
      if (eid) liveMap[eid] = l;
    }

    const matches = (evData.results || []).map(ev => {
      let time = '?', matchDate = '';
      if (ev.match_date || ev.date || ev.datetime) {
        const raw = ev.match_date || ev.date || ev.datetime;
        const dt = new Date(raw);
        const trDt = new Date(dt.getTime() + 3*60*60*1000);
        matchDate = trDt.toISOString().split('T')[0];
        time = trDt.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
      }

      const live = liveMap[ev.id];
      const pred = predMap[ev.id];

      let status = ev.status || 'TIMED';
      if (status === 'finished' || status === 'FINISHED') status = 'FINISHED';
      else if (live || status === 'live' || status === 'IN_PLAY') status = 'IN_PLAY';
      else status = 'TIMED';

      return {
        id: String(ev.id),
        league: ev.league?.name || ev.competition || ev.league || '?',
        leagueCountry: ev.league?.country || ev.country || '',
        home: ev.home_team?.name || ev.home_team || '?',
        away: ev.away_team?.name || ev.away_team || '?',
        homeId: ev.home_team?.id || ev.home_team_id || null,
        awayId: ev.away_team?.id || ev.away_team_id || null,
        time,
        utcDate: ev.match_date || ev.date || ev.datetime || null,
        status,
        minute: live?.minute || null,
        score: {
          fullTime: { home: ev.home_score ?? live?.home_score ?? null, away: ev.away_score ?? live?.away_score ?? null },
          halfTime: { home: ev.ht_home_score ?? null, away: ev.ht_away_score ?? null },
        },
        pred: pred ? {
          probOver25: +(pred.prob_over_25 || pred.over_25 || 0).toFixed(1),
          probBtts: +(pred.prob_btts_yes || pred.btts || 0).toFixed(1),
          probHomeWin: +(pred.prob_home_win || pred.home_win || 0).toFixed(1),
          probDraw: +(pred.prob_draw || pred.draw || 0).toFixed(1),
          probAwayWin: +(pred.prob_away_win || pred.away_win || 0).toFixed(1),
          confidence: +(pred.confidence || 0).toFixed(1),
          predicted: pred.predicted_result || pred.prediction || null,
          xgHome: pred.xg_home || null,
          xgAway: pred.xg_away || null,
        } : null,
      };
    });

    matches.sort((a,b) => (a.utcDate||'') > (b.utcDate||'') ? 1 : -1);
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ date: today, matches, count: matches.length });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
