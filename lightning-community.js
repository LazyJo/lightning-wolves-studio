// ─── Lightning Bot: the community part ────────────────────────────────────────
// What MEE6 / ProBot / carl-bot did, done by Lightning Bot - still without a bot server: every 5 minutes (the same
// pg_cron call as the JAVEDA feed) it reads what's new and hands out what's earned.
// - XP and levels for chatting, MEE6's rules: 15-25 XP a message, at most once a minute; /rank, /leaderboard.
// - A new member gets 🐾 Pup and a welcome in the intro channel.
// - 🐾 Pup → 🐺 Wolf at level 5, or after 3 days in the server (for whoever joined since the bot started).
// - Time badges: 🌗 Moon Wolf (1 month), 🌕 Full Moon (6 months), ⚡ OG Wolf (1 year) - only the highest one.
// - Moderation: /warn /warnings /timeout /kick /ban /purge, each written to the log channel.
// Spam and word filters: Discord's own AutoMod. Who deleted what: Discord's Audit Log.
// Needs: the "Server Members Intent" switch in the Discord Developer Portal (Bot tab), and the tables lightning_xp and
// lightning_warns (supabase-javeda-schema.sql).
module.exports = function community({ discord, GUILD, getState, setState, guildRoles, EPHEMERAL, GOLD, BLUE }) {
  const DAY = 86400000, XP_GAP = 60000, WOLF_LEVEL = 5, WOLF_DAYS = 3, MAX_ROLE_CHANGES = 25;
  const xpFor = l => 5 * l * l + 50 * l + 100;                     // XP from level l to l+1 (MEE6's curve)
  const levelOf = xp => { let l = 0; while (xp >= xpFor(l)) { xp -= xpFor(l); l++; } return { level:l, into:xp, need:xpFor(l) }; };
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the ranks and badges, found by name whatever emoji or "|" is around them (the old names count too)
  const RANKS = {
    pup:   { names:['pup', 'rookie', 'rookies'], make:'🐾 Pup', color:0x9aa4b2 },
    wolf:  { names:['wolf', 'new blood'], make:'🐺 Wolf', color:0xc9a227 },
    pack:  { names:['pack', 'trusted'] }, alpha:{ names:['alpha', 'vip'] }, staff:{ names:['lightning wolves', 'tml'] },
    moon:  { names:['moon wolf'], make:'🌗 Moon Wolf', color:0x8ab4f8 },
    full:  { names:['full moon'], make:'🌕 Full Moon', color:0xf5d76e },
    og:    { names:['og wolf'], make:'⚡ OG Wolf', color:0xffd60a },
  };
  const find = (roles, key) => roles.find(r => RANKS[key].names.includes(norm(r.name)) && !r.managed);
  async function ensure(key){
    let r = find(await guildRoles(), key);
    if (!r && RANKS[key].make){ r = await discord('/guilds/' + GUILD() + '/roles', 'POST', { name:RANKS[key].make, color:RANKS[key].color, hoist:key === 'og' }); await guildRoles(true); }
    return r;
  }
  const snowflakeNow = () => String((BigInt(Date.now()) - 1420070400000n) << 22n);
  const big = s => BigInt(s);
  const mention = id => '<@' + id + '>';
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  // the cards: a banner (client/public/discord/) and the member's own Discord picture
  const CARD = n => 'https://lightningwolves.studio/discord/' + n + '.jpg?v=2';
  const face = u => u && u.avatar ? 'https://cdn.discordapp.com/avatars/' + u.id + '/' + u.avatar + '.png?size=256'
    : 'https://cdn.discordapp.com/embed/avatars/' + (u && /^\d+$/.test(u.id) ? Number((BigInt(u.id) >> 22n) % 6n) : 0) + '.png';
  const nameOf = u => (u && (u.global_name || u.username)) || 'someone';
  const wolfCard = (u, how) => ({ content:mention(u.id), allowed_mentions:{ users:[u.id] }, embeds:[{ color:GOLD,
    title:'🐺 ' + (how ? how + 'you\'re' : 'You\'re') + ' a Wolf now!', description:'**' + nameOf(u) + '** is a 🐺 **Wolf** now. Fangs earned. ⚡',
    thumbnail:{ url:face(u) }, image:{ url:CARD('wolf') } }] });
  const bar = (a, b) => { const n = Math.round(10 * a / b); return '▰'.repeat(n) + '▱'.repeat(10 - n); };

  // ── every 5 minutes: new messages → XP and levels ──
  async function levels(sb, out){
    const chans = (await discord('/guilds/' + GUILD() + '/channels')).filter(c => c.type === 0 || c.type === 5);
    const cursors = (await getState(sb, 'xp_cursors')) || {}, msgs = [];
    for (const c of chans){
      if (!cursors[c.id]){ cursors[c.id] = snowflakeNow(); continue; }          // a channel seen for the first time: from now on, no old messages
      try {
        for (let page = 0; page < 5; page++){
          const got = await discord('/channels/' + c.id + '/messages?limit=100&after=' + cursors[c.id]);
          if (!got || !got.length) break;
          got.sort((a, b) => (big(a.id) < big(b.id) ? -1 : 1));
          for (const m of got) if (!m.author.bot && !m.webhook_id && (m.type === 0 || m.type === 19)) msgs.push({ ch:c.id, at:Date.parse(m.timestamp), user:m.author });
          cursors[c.id] = got[got.length - 1].id;
          if (got.length < 100) break;
        }
      } catch (e){ if (e.status !== 403 && e.status !== 404) throw e; }        // a channel the bot can't read: skip it
    }
    await setState(sb, 'xp_cursors', cursors);
    if (!msgs.length) return;
    msgs.sort((a, b) => a.at - b.at);
    const ids = [...new Set(msgs.map(m => m.user.id))];
    const { data } = await sb.from('lightning_xp').select('*').in('user_id', ids);
    const rows = Object.fromEntries((data || []).map(r => [r.user_id, r])), ups = [], who = {};
    for (const m of msgs){
      const r = rows[m.user.id] || (rows[m.user.id] = { user_id:m.user.id, xp:0, level:0, messages:0, last_xp_at:null });
      r.name = m.user.global_name || m.user.username; r.messages++; who[m.user.id] = m.user;
      if (!r.last_xp_at || m.at - Date.parse(r.last_xp_at) >= XP_GAP){
        r.xp += 15 + Math.floor(Math.random() * 11); r.last_xp_at = new Date(m.at).toISOString();
        const L = levelOf(r.xp).level;
        if (L > r.level){ r.level = L; ups.push({ id:m.user.id, level:L }); }
      }
      r.updated_at = new Date().toISOString();
    }
    await sb.from('lightning_xp').upsert(Object.values(rows));
    const ch = await getState(sb, 'levels_channel');
    for (const u of ups) if (ch){
      const user = who[u.id] || { id:u.id }, next = levelOf(rows[u.id].xp);
      const card = u.level === WOLF_LEVEL ? wolfCard(user, 'Level ' + WOLF_LEVEL + ': ') : { content:mention(u.id), allowed_mentions:{ users:[u.id] }, embeds:[{ color:BLUE,
        title:'⚡ Level ' + u.level, description:'**' + nameOf(user) + '** reached level ' + u.level + '.' +
          (next.level === u.level ? '\n' + bar(next.into, next.need) + ' ' + fmt(next.into) + ' / ' + fmt(next.need) + ' XP to level ' + (u.level + 1) : ''),
        thumbnail:{ url:face(user) }, image:{ url:CARD('levelup') } }] };
      await discord('/channels/' + ch + '/messages', 'POST', card).catch(() => {});
      out.push('level:' + u.id + ':' + u.level);
    }
  }

  // ── every 5 minutes: members → Pup for the new ones, a welcome, Pup → Wolf, time badges ──
  async function members(sb, out){
    let since = await getState(sb, 'community_since');
    if (!since){ since = new Date().toISOString(); await setState(sb, 'community_since', since); }
    const list = []; let after = '0';
    for (let page = 0; page < 10; page++){
      const got = await discord('/guilds/' + GUILD() + '/members?limit=1000&after=' + after);
      list.push(...got); if (got.length < 1000) break; after = got[got.length - 1].user.id;
    }
    const roles = await guildRoles(true), id = key => (find(roles, key) || {}).id;
    const { data:xp } = await sb.from('lightning_xp').select('user_id, level');
    const lvl = Object.fromEntries((xp || []).map(r => [r.user_id, r.level]));
    const welcomed = new Set((await getState(sb, 'welcomed')) || []), intro = await getState(sb, 'intro_channel'), lvCh = await getState(sb, 'levels_channel');
    const humans = list.filter(m => !m.user.bot).length;
    let chans = null; const chan = async re => {                     // #📜・rules / #🎭・roles, for the welcome (the new "・" ones first)
      chans = chans || await discord('/guilds/' + GUILD() + '/channels').catch(() => []);
      const c = chans.filter(c => c.type === 0 && re.test(norm(c.name))).sort((a, b) => /・/.test(b.name) - /・/.test(a.name))[0];
      return c ? '<#' + c.id + '>' : null; };
    let changes = 0; const now = Date.now();
    const give = async (m, key) => { const r = await ensure(key); if (!r || m.roles.includes(r.id)) return; await discord('/guilds/' + GUILD() + '/members/' + m.user.id + '/roles/' + r.id, 'PUT'); m.roles.push(r.id); changes++; };
    const take = async (m, rid) => { if (!rid || !m.roles.includes(rid)) return; await discord('/guilds/' + GUILD() + '/members/' + m.user.id + '/roles/' + rid, 'DELETE'); m.roles = m.roles.filter(x => x !== rid); changes++; };
    for (const m of list){
      if (m.user.bot || changes >= MAX_ROLE_CHANGES) continue;
      const joined = Date.parse(m.joined_at), has = key => { const r = id(key); return !!r && m.roles.includes(r); };
      const ranked = ['pup', 'wolf', 'pack', 'alpha', 'staff'].some(has);
      try {
        // new since the bot started: 🐾 Pup and a welcome (once)
        if (joined >= Date.parse(since) && !ranked){ await give(m, 'pup'); out.push('pup:' + m.user.id); }
        if (joined >= Date.parse(since) && !welcomed.has(m.user.id) && intro){
          welcomed.add(m.user.id);
          const rules = await chan(/(^| )rules$/), picks = await chan(/(^| )roles$/);
          await discord('/channels/' + intro + '/messages', 'POST', { content:mention(m.user.id), allowed_mentions:{ users:[m.user.id] }, embeds:[{ color:GOLD,
            title:'🐾 Welcome to the pack, ' + nameOf(m.user) + '!', description:'Tell us who you are and what you do.\n' +
              'Chat, play JAVEDA and you\'re a 🐺 **Wolf** at level ' + WOLF_LEVEL + ' (or in ' + WOLF_DAYS + ' days).\n\n' +
              [rules && '📜 ' + rules, picks && '🎭 ' + picks, '🎮 [Play JAVEDA](https://lightningwolves.studio/javeda/)'].filter(Boolean).join(' · '),
            thumbnail:{ url:face(m.user) }, image:{ url:CARD('welcome') }, footer:{ text:'Lightning Wolves Games X TML · ' + fmt(humans) + ' members' } }] });
        }
        // 🐾 → 🐺: level 5, or 3 days (the 3 days only for who joined since the bot started)
        if (has('pup') && !has('wolf') && ((lvl[m.user.id] || 0) >= WOLF_LEVEL || (joined >= Date.parse(since) && now - joined >= WOLF_DAYS * DAY))){
          await give(m, 'wolf'); await take(m, id('pup')); out.push('wolf:' + m.user.id);
          // by level, the level-up already said so; by the 3 days, say it here
          if ((lvl[m.user.id] || 0) < WOLF_LEVEL && lvCh) await discord('/channels/' + lvCh + '/messages', 'POST', wolfCard(m.user, '')).catch(() => {});
        }
        // time badges: only the highest
        const days = (now - joined) / DAY, badge = days >= 365 ? 'og' : days >= 182 ? 'full' : days >= 30 ? 'moon' : null;
        if (badge && !has(badge)){ await give(m, badge); out.push(badge + ':' + m.user.id); }
        for (const k of ['moon', 'full', 'og']) if (k !== badge && has(k)) await take(m, id(k));
      } catch (e){ if (e.code === 50013) out.push('cant:' + m.user.id); else throw e; }  // a member above the bot: leave them
    }
    await setState(sb, 'welcomed', [...welcomed].slice(-2000));
  }

  async function tick(sb){
    const out = [];
    try { await levels(sb, out); } catch (e){ out.push('levels failed: ' + e.message); }
    try { await members(sb, out); } catch (e){ out.push('members failed: ' + (e.code === 50001 || e.status === 403 ? 'switch on the Server Members Intent in the Developer Portal' : e.message)); }
    return out;
  }

  // ── commands ──
  const MOD = '1099511627776', user = (n, d, req = true) => ({ type:6, name:n, description:d, required:req }), str = (n, d, req = false) => ({ type:3, name:n, description:d, required:req, max_length:400 });
  const COMMANDS = [
    { name:'rank', description:'Your level and XP (or someone else\'s)', options:[user('user', 'Whose rank', false)] },
    { name:'leaderboard', description:'The 10 most active wolves' },
    { name:'warn', description:'Mods: warn a member', default_member_permissions:MOD, dm_permission:false, options:[user('user', 'Who'), str('reason', 'Why', true)] },
    { name:'warnings', description:'Mods: a member\'s warnings', default_member_permissions:MOD, dm_permission:false, options:[user('user', 'Who')] },
    { name:'timeout', description:'Mods: mute a member for a while', default_member_permissions:MOD, dm_permission:false,
      options:[user('user', 'Who'), { type:4, name:'minutes', description:'How long (1 minute to 28 days)', required:true, min_value:1, max_value:40320 }, str('reason', 'Why')] },
    { name:'kick', description:'Mods: kick a member', default_member_permissions:'2', dm_permission:false, options:[user('user', 'Who'), str('reason', 'Why')] },
    { name:'ban', description:'Mods: ban a member', default_member_permissions:'4', dm_permission:false,
      options:[user('user', 'Who'), str('reason', 'Why'), { type:4, name:'delete_days', description:'Delete their messages of the last days (0-7)', min_value:0, max_value:7 }] },
    { name:'purge', description:'Mods: delete the last messages in this channel', default_member_permissions:'8192', dm_permission:false,
      options:[{ type:4, name:'count', description:'How many (1-100)', required:true, min_value:1, max_value:100 }] },
  ];
  const SETUP = { log:'Make this channel the bot\'s log (warns, kicks, bans...)', levels:'Post level-ups in this channel', intro:'Welcome new members in this channel' };
  const opt = (i, n) => { const o = (i.data.options || []).find(x => x.name === n); return o ? o.value : undefined; };
  const who = (i, uid) => { const u = i.data.resolved && i.data.resolved.users && i.data.resolved.users[uid]; return u ? (u.global_name || u.username) : 'that member'; };
  async function log(sb, embed){ const ch = await getState(sb, 'log_channel'); if (ch) await discord('/channels/' + ch + '/messages', 'POST', { embeds:[{ color:BLUE, timestamp:new Date().toISOString(), ...embed }] }).catch(() => {}); }
  const mod = i => (i.member && i.member.user) ? mention(i.member.user.id) : 'a mod';
  const nope = e => ({ content:e.code === 50013 ? '⚠️ I can\'t do that to them: their role is above Lightning Bot\'s (or I miss the permission).' : '⚠️ ' + String(e.message).slice(0, 300), flags:EPHEMERAL });

  async function command(i, sb){
    const n = i.data.name;
    if (n === 'rank'){
      if (!sb) return null;
      const uid = opt(i, 'user') || (i.member && i.member.user.id);
      const { data:r } = await sb.from('lightning_xp').select('*').eq('user_id', uid).maybeSingle();
      if (!r) return { content:(uid === (i.member && i.member.user.id) ? 'You have' : who(i, uid) + ' has') + ' no XP yet. Chat a bit!', flags:EPHEMERAL };
      const { data:above } = await sb.from('lightning_xp').select('user_id').gt('xp', r.xp);
      const L = levelOf(r.xp);
      return { embeds:[{ color:GOLD, title:'🐺 ' + (r.name || who(i, uid)), description:'**Level ' + L.level + '** · rank #' + ((above || []).length + 1) + '\n' + bar(L.into, L.need) + ' ' + fmt(L.into) + ' / ' + fmt(L.need) + ' XP\n' + fmt(r.messages) + ' messages' +
        (L.level < WOLF_LEVEL ? '\n\n🐾 → 🐺 at level ' + WOLF_LEVEL : '') }] };
    }
    if (n === 'leaderboard'){
      if (!sb) return null;
      const { data } = await sb.from('lightning_xp').select('user_id, name, xp').order('xp', { ascending:false }).limit(10);
      return { embeds:[{ color:GOLD, title:'🐺 The most active wolves', description:(data || []).length ? data.map((r, k) => (['🥇', '🥈', '🥉'][k] || '`' + (k + 1) + '`') + ' **' + (r.name || '?') + '** - level ' + levelOf(r.xp).level + ' · ' + fmt(r.xp) + ' XP').join('\n') : 'No XP yet. Start chatting!' }] };
    }
    const target = opt(i, 'user'), reason = opt(i, 'reason') || 'no reason given', G = '/guilds/' + GUILD();
    try {
      if (n === 'warn'){
        await sb.from('lightning_warns').insert({ user_id:target, mod_id:i.member.user.id, reason });
        const { data } = await sb.from('lightning_warns').select('id').eq('user_id', target);
        const count = (data || []).length;
        try { const dm = await discord('/users/@me/channels', 'POST', { recipient_id:target }); await discord('/channels/' + dm.id + '/messages', 'POST', { content:'⚠️ You got a warning in Lightning Wolves Games X TML: ' + reason }); } catch (e){}
        await log(sb, { title:'⚠️ Warning', description:mention(target) + ' warned by ' + mod(i) + ' (warning ' + count + ')\n' + reason });
        return { content:'⚠️ Warned **' + who(i, target) + '** (warning ' + count + ').', flags:EPHEMERAL };
      }
      if (n === 'warnings'){
        const { data } = await sb.from('lightning_warns').select('reason, created_at').eq('user_id', target).order('created_at', { ascending:false }).limit(10);
        return { content:(data || []).length ? '**' + who(i, target) + '**: ' + data.length + ' warning(s)\n' + data.map(w => '• ' + w.created_at.slice(0, 10) + ': ' + w.reason).join('\n') : '**' + who(i, target) + '** has no warnings.', flags:EPHEMERAL };
      }
      if (n === 'timeout'){
        const mins = opt(i, 'minutes'); await discord(G + '/members/' + target, 'PATCH', { communication_disabled_until:new Date(Date.now() + mins * 60000).toISOString() });
        await log(sb, { title:'🔇 Timeout', description:mention(target) + ' muted for ' + mins + ' min by ' + mod(i) + '\n' + reason });
        return { content:'🔇 **' + who(i, target) + '** is muted for ' + mins + ' minutes.', flags:EPHEMERAL };
      }
      if (n === 'kick'){
        await discord(G + '/members/' + target, 'DELETE');
        await log(sb, { title:'👢 Kick', description:mention(target) + ' kicked by ' + mod(i) + '\n' + reason });
        return { content:'👢 Kicked **' + who(i, target) + '**.', flags:EPHEMERAL };
      }
      if (n === 'ban'){
        await discord(G + '/bans/' + target, 'PUT', { delete_message_seconds:(opt(i, 'delete_days') || 0) * 86400 });
        await log(sb, { title:'🔨 Ban', description:mention(target) + ' banned by ' + mod(i) + '\n' + reason });
        return { content:'🔨 Banned **' + who(i, target) + '**.', flags:EPHEMERAL };
      }
      if (n === 'purge'){
        const ch = i.channel_id, count = opt(i, 'count');
        const got = (await discord('/channels/' + ch + '/messages?limit=' + count)).filter(m => Date.now() - Date.parse(m.timestamp) < 14 * DAY - 60000);
        if (got.length === 1) await discord('/channels/' + ch + '/messages/' + got[0].id, 'DELETE');
        else if (got.length > 1) await discord('/channels/' + ch + '/messages/bulk-delete', 'POST', { messages:got.map(m => m.id) });
        await log(sb, { title:'🧹 Purge', description:got.length + ' messages deleted in <#' + ch + '> by ' + mod(i) });
        return { content:'🧹 Deleted ' + got.length + ' messages' + (got.length < count ? ' (older than 14 days can\'t be bulk-deleted)' : '') + '.', flags:EPHEMERAL };
      }
    } catch (e){ return nope(e); }
    return null;
  }
  async function setup(sub, ch, sb){
    if (!SETUP[sub]) return null;
    await setState(sb, { log:'log_channel', levels:'levels_channel', intro:'intro_channel' }[sub], ch);
    return { log:'This channel is the log now: warns, timeouts, kicks, bans and purges show up here.', levels:'Level-ups are posted in this channel now.', intro:'New members are welcomed in this channel now.' }[sub];
  }
  return { COMMANDS, SETUP, command, setup, tick, levelOf, _test:{ levels, members } };
};
