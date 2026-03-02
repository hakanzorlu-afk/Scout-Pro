// api/fixtures.js - AllSportsAPI version
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.ALLSPORTS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ALLSPORTS_API_KEY eksik' });

  const now = new Date();
  const trDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const date = req.query.date || trDate.toISOString().split('T')[0];

  try {
    const url = `https://allsportsapi.com/api/football/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('AllSportsAPI HTTP ' + r.status);
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
      if (es === 'Finished' || es === 'After Pen.' || es === 'After ET') status = 'FINISHED';
      else if (!isNaN(parseInt(es)) || es === 'HT' || es === 'Extra Time') status = 'IN_PLAY';
      const minute = !isNaN(parseInt(es)) ? parseInt(es) : (es === 'HT' ? 45 : null);

      return {
        id: String(m.event_key),
        league: m.league_name || '?',
        leagueCode: String(m.league_id),
        leagueCountry: m.country_name || '',
        home: m.event_home_team || '?',
        homeFull: m.event_home_team || '?',
        homeId: m.home_team_key,
        away: m.event_away_team || '?',
        awayFull: m.event_away_team || '?',
        awayId: m.away_team_key,
        time,
        utcDate: m.event_date ? (m.event_date + 'T' + (m.event_time||'00:00') + ':00Z') : null,
        status,
        minute,
        score: {
          fullTime: {
            home: m.event_final_result ? parseInt(m.event_final_result.split(' - ')[0]) : null,
            away: m.event_final_result ? parseInt(m.event_final_result.split(' - ')[1]) : null,
          },
          halfTime: {
            home: m.event_halftime_result ? parseInt(m.event_halftime_result.split(' - ')[0]) : null,
            away: m.event_halftime_result ? parseInt(m.event_halftime_result.split(' - ')[1]) : null,
          }
        },
        matchday: m.event_week || null,
      };
    });

    matches.sort((a, b) => (a.utcDate||'') > (b.utcDate||'') ? 1 : -1);
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({ date, matches, count: matches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
