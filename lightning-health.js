// ─── The database alarm ───────────────────────────────────────────────────────
// GET /api/health, called every 5 minutes from outside (cron-job.org): is JAVEDA's Supabase answering?
// It asks the database (a one-row read) and the log-in service, each with 8 s to answer, and asks again 5 s later
// before it calls it down (one slow moment is not an outage). Down: Lightning Bot sends the server's owner (Lazy Jo)
// a Discord message, and posts it in the log channel too - at most once an hour. Back up: one "it's back" message.
// It keeps no state of its own (the database is the thing that may be down): it reads its last message in that DM.
// 200 = up, 503 = down (cron-job.org can email on that as well). Nothing secret in or out, so no key is needed.
module.exports = function health({ discord, GUILD }) {
  const URL_ = () => process.env.SUPABASE_URL, KEY = () => process.env.SUPABASE_ANON_KEY;
  const DASH = 'https://supabase.com/dashboard/project/' + ((process.env.SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./) || [, 'wjvvkffroujkhbisxnab'])[1] + '/settings/general';
  const DOWN = '🔴 **JAVEDA\'s database isn\'t answering**', UP = '🟢 **JAVEDA\'s database is back**';
  async function ask(path) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetch(URL_() + path, { headers: { apikey: KEY(), Authorization: 'Bearer ' + KEY() }, signal: ac.signal }); return r.ok ? 'ok' : 'HTTP ' + r.status; }
    catch (e) { return e.name === 'AbortError' ? 'no answer in 8 s' : String(e.message || e).slice(0, 80); }
    finally { clearTimeout(t); }
  }
  async function check() {
    const [db, auth] = await Promise.all([ask('/rest/v1/javeda_levels?select=id&limit=1'), ask('/auth/v1/health')]);
    return { db, auth, ok: db === 'ok' && auth === 'ok' };
  }
  // where the alarm goes: a DM to the server's owner (a phone notification), and the log channel if there is one
  async function places() {
    const g = await discord('/guilds/' + GUILD());
    const dm = await discord('/users/@me/channels', 'POST', { recipient_id: g.owner_id });
    const chans = await discord('/guilds/' + GUILD() + '/channels').catch(() => []);
    const log = chans.find(c => c.type === 0 && /(^|[^a-z])log$/i.test(c.name.replace(/[^a-z0-9]+/gi, ' ').trim()));
    return { dm: dm.id, log: log && log.id };
  }
  const last = async ch => ((await discord('/channels/' + ch + '/messages?limit=10').catch(() => [])) || []).find(m => m.author && m.author.bot && (m.content.startsWith(DOWN) || m.content.startsWith(UP)));
  return async function route(req, res) {
    if (!URL_() || !KEY()) return res.status(500).json({ error: 'no Supabase settings' });
    let r = await check();
    if (!r.ok) { await new Promise(ok => setTimeout(ok, 5000)); r = await check(); }
    let told = null;
    if (process.env.DISCORD_BOT_TOKEN) try {
      const p = await places(), prev = await last(p.dm), wasDown = prev && prev.content.startsWith(DOWN);
      const send = async text => { await discord('/channels/' + p.dm + '/messages', 'POST', { content: text }); if (p.log) await discord('/channels/' + p.log + '/messages', 'POST', { content: text }).catch(() => {}); };
      if (!r.ok && (!wasDown || Date.now() - Date.parse(prev.timestamp) > 3600e3)) {
        await send(DOWN + ' (database: ' + r.db + ' · log-in: ' + r.auth + ').\nPlayers get logged out and the scoreboard says offline.\n' +
          '**Fix:** Supabase → Project Settings → General → **Restart project** (takes about 5 minutes): ' + DASH); told = 'down';
      } else if (r.ok && wasDown) { await send(UP + ': log-in and scoreboard answer again.'); told = 'up'; }
    } catch (e) { told = 'discord failed: ' + String(e.message || e).slice(0, 120); }
    res.status(r.ok ? 200 : 503).json({ ok: r.ok, database: r.db, login: r.auth, told, at: new Date().toISOString() });
  };
};
