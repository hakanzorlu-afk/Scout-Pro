module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const KEY = process.env.ALLSPORTS_KEY;
  if (!KEY) return res.status(500).json({ error: 'ALLSPORTS_KEY eksik' });

  const now = new Date();
  const trNow = new Date(now.getTime() + 3*60*60*1000);
  const today = req.query.date || trNow.toISOString().split('T')[0];

  try {
    const url = `https://allsportsapi.com/api/football/?met=Fixtures&APIkey=${KEY}&from=${today}&to=${today}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.success) throw new Error(data.message || 'API hatasi');

    const matches = (data.result || []).map(m => {
      let time = '?';
      if (m.event_date && m.event_time) {
        try {
          const dt = new Date(m.event_date + 'T' + m.event_time + ':00Z');
          time = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
        } catch(e) { time = m.event_time; }
      }
      let status = 'TIMED';
      const es = m.event_status || '';
      if (es === 'Finished') status = 'FINISHED';
      else if (!isNaN(parseInt(es)) || es === 'HT') status = 'IN_PLAY';
      return {
        id: String(m.event_key),
        league: m.league_name || '?',
        leagueCountry: m.country_name || '',
        home: m.event_home_team || '?',
        away: m.event_away_team || '?',
        homeId: m.home_team_key,
        awayId: m.away_team_key,
        time, utcDate: m.event_date ? (m.event_date + 'T' + (m.event_time||'00:00') + ':00Z') : null,
        status, minute: !isNaN(parseInt(es)) ? parseInt(es) : (es === 'HT' ? 45 : null),
        score: {
          fullTime: { home: m.event_final_result ? parseInt(m.event_final_result.split(' - ')[0]) : null, away: m.event_final_result ? parseInt(m.event_final_result.split(' - ')[1]) : null },
          halfTime: { home: m.event_halftime_result ? parseInt(m.event_halftime_result.split(' - ')[0]) : null, away: m.event_halftime_result ? parseInt(m.event_halftime_result.split(' - ')[1]) : null }
        },
      };
    });

    matches.sort((a,b) => (a.utcDate||'') > (b.utcDate||'') ? 1 : -1);
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ date: today, matches, count: matches.length });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
