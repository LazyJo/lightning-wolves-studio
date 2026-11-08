// ─── Lightning Bot: JAVEDA ↔ Discord ─────────────────────────────────────────
// A player gets a code in JAVEDA (their player → Link Discord, javeda_discord_code) and types /link CODE here.
// From then on, every 5 minutes (the feed's pg_cron call), the bot keeps four roles in step with the game:
//   🏆 Top 10           the 10 first on JAVEDA's Points board
//   💿 28/28            every part of all 28 songs cleared
//   🎟️ JAVEDA Pass      has the Pass
//   🏆 Weekly Champion   won the last weekly tournament
// It hands these out and takes them back itself (also from someone who unlinked); a missing role is made.
module.exports = function link({ discord, GUILD, guildRoles, EPHEMERAL }) {
  const ROLES = {
    top:   { re:/top ?10/i,           make:'🏆 Top 10',          color:0xffd60a },
    album: { re:/28 ?\/ ?28/,         make:'💿 28/28',           color:0xe0a41a },
    pass:  { re:/javeda pass/i,       make:'🎟️ JAVEDA Pass',     color:0x8a5cff },
    champ: { re:/weekly champion/i,   make:'🏆 Weekly Champion', color:0xff9a3a },
  };
  const MAX = 25;
  const find = (roles, k) => roles.find(r => ROLES[k].re.test(r.name) && !r.managed);
  async function ensure(k){
    let r = find(await guildRoles(), k);
    if (!r){ r = await discord('/guilds/' + GUILD() + '/roles', 'POST', { name:ROLES[k].make, color:ROLES[k].color, hoist:false }); await guildRoles(true); }
    return r;
  }
  const COMMANDS = [
    { name:'link', description:'Link your JAVEDA player (get the code in JAVEDA: your player → Link Discord)', dm_permission:false,
      options:[{ type:3, name:'code', description:'The 6-letter code from JAVEDA', required:true, min_length:6, max_length:6 }] },
    { name:'unlink', description:'Unlink your JAVEDA player from Discord', dm_permission:false },
  ];
  const optOf = (i, n) => ((i.data.options || []).find(o => o.name === n) || {}).value;
  async function command(i, sb){
    const name = i.data.name; if (name !== 'link' && name !== 'unlink') return null;
    if (!sb) return { content:'JAVEDA\'s database can\'t be reached right now. Try again in a bit.', flags:EPHEMERAL };
    const user = i.member && i.member.user; if (!user) return { content:'Use this in the server.', flags:EPHEMERAL };
    if (name === 'unlink'){
      await sb.from('javeda_discord_links').delete().eq('discord_id', user.id);
      return { content:'Unlinked. Your JAVEDA roles go within 5 minutes.', flags:EPHEMERAL };
    }
    const code = String(optOf(i, 'code') || '').trim().toUpperCase();
    const { data:c } = await sb.from('javeda_discord_codes').select('user_id, expires_at').eq('code', code).maybeSingle();
    if (!c || Date.parse(c.expires_at) < Date.now())
      return { content:'That code doesn\'t work (a code lasts 15 minutes). Get a new one in JAVEDA: tap your player → **Link Discord**.', flags:EPHEMERAL };
    await sb.from('javeda_discord_links').delete().eq('discord_id', user.id);
    await sb.from('javeda_discord_links').upsert({ user_id:c.user_id, discord_id:user.id, discord_name:user.global_name || user.username, linked_at:new Date().toISOString() });
    await sb.from('javeda_discord_codes').delete().eq('code', code);
    const { data:p } = await sb.from('javeda_players').select('username').eq('user_id', c.user_id).maybeSingle();
    return { content:'✅ Linked to **' + ((p && p.username) || 'your player') + '** on JAVEDA. Your roles (🏆 Top 10, 💿 28/28, 🎟️ JAVEDA Pass, 🏆 Weekly Champion) update within 5 minutes.', flags:EPHEMERAL };
  }
  // every 5 minutes: who should have which role, and the changes (at most 25 a run)
  async function sync(sb){
    const out = [];
    const { data:links } = await sb.from('javeda_discord_links').select('user_id, discord_id');
    const ids = (links || []).map(l => l.user_id), want = {};
    for (const l of links || []) want[l.discord_id] = new Set();
    if (ids.length){
      const by = Object.fromEntries((links || []).map(l => [l.user_id, l.discord_id])), add = (uid, k) => { if (by[uid]) want[by[uid]].add(k); };
      const { data:top } = await sb.from('javeda_players').select('user_id').gt('points_earned', 0).order('points_earned', { ascending:false }).limit(10);
      for (const r of top || []) add(r.user_id, 'top');
      const { data:pl } = await sb.from('javeda_players').select('user_id, album_completed_at').in('user_id', ids);
      for (const r of pl || []) if (r.album_completed_at) add(r.user_id, 'album');
      const { data:ps } = await sb.from('javeda_passes').select('user_id').in('user_id', ids);
      for (const r of ps || []) add(r.user_id, 'pass');
      const { data:w } = await sb.from('javeda_weekly_winners').select('user_id').not('user_id', 'is', null).order('week', { ascending:false }).limit(1);
      if (w && w[0]) add(w[0].user_id, 'champ');
    }
    // who has them now: everyone in the server (the Server Members Intent)
    const roles = await guildRoles(true), have = {}; for (const k in ROLES){ const r = find(roles, k); if (r) have[k] = r.id; }
    const members = []; let after = '0';
    for (let page = 0; page < 10; page++){ const got = await discord('/guilds/' + GUILD() + '/members?limit=1000&after=' + after); members.push(...got); if (got.length < 1000) break; after = got[got.length - 1].user.id; }
    let n = 0;
    for (const m of members){
      if (m.user.bot) continue;
      for (const k in ROLES){
        if (n >= MAX) return out;
        const on = !!have[k] && m.roles.includes(have[k]), should = !!(want[m.user.id] && want[m.user.id].has(k));
        try {
          if (should && !on){ const r = await ensure(k); have[k] = r.id; await discord('/guilds/' + GUILD() + '/members/' + m.user.id + '/roles/' + r.id, 'PUT'); out.push('+' + k + ':' + m.user.id); n++; }
          else if (!should && on){ await discord('/guilds/' + GUILD() + '/members/' + m.user.id + '/roles/' + have[k], 'DELETE'); out.push('-' + k + ':' + m.user.id); n++; }
        } catch (e){ if (e.code === 50013){ out.push('cant: drag the Lightning Bot role above ' + ROLES[k].make); n = MAX; } else throw e; }
      }
    }
    return out;
  }
  return { COMMANDS, command, sync };
};
