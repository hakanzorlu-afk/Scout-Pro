module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const KEY = process.env.FOOTBALL_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'FOOTBALL_API_KEY eksik' });

  const now = new Date();
  const trNow = new Date(now.getTime() + 3*60*60*1000);
  const today = req.query.date || trNow.toISOString().split('T')[0];

  try {
    const r = await fetch(`https://api.football-data.org/v4/matches?date=${today}`, {
      headers: { 'X-Auth-Token': KEY }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    const matches = (data.matches || []).map(m => {
      const dt = new Date(m.utcDate);
      const trDt = new Date(dt.getTime() + 3*60*60*1000);
      const time = trDt.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
      let status = 'TIMED';
      if (m.status === 'FINISHED') status = 'FINISHED';
      else if (m.status === 'IN_PLAY' || m.status === 'PAUSED') status = 'IN_PLAY';
      return {
        id: String(m.id),
        league: m.competition?.name || '?',
        leagueCountry: m.area?.name || '',
        home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
        away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
        homeId: m.homeTeam?.id,
        awayId: m.awayTeam?.id,
        time, utcDate: m.utcDate, status,
        minute: m.minute || null,
        score: {
          fullTime: { home: m.score?.fullTime?.home, away: m.score?.fullTime?.away },
          halfTime: { home: m.score?.halfTime?.home, away: m.score?.halfTime?.away },
        }
      };
    }).filter(m => m.status !== 'FINISHED');

    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ date: today, matches, count: matches.length });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
