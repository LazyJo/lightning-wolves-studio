// ─── Lightning Bot ────────────────────────────────────────────────────────────
// The Discord bot of "Lightning Wolves Games X TML", run by this server - no bot server of its own: Discord sends
// slash commands and button taps here (an "interactions endpoint"), and pg_cron in Supabase calls the feed every
// 5 minutes. Setup, step by step: LIGHTNING-BOT.md.
//
//   /javeda   the JAVEDA card: what it is, Play, Spotify, Merch, EVEN
//   /top      the top 10 of a JAVEDA board (points, online 1v1, today's challenge)
//   /daily    today's challenge and its top 5
//   /help     what the bot does
//   /setup    (admins) welcome | rules | roles | feed | log | levels | intro - posts the welcome card, the rules,
//             the role picker, or makes this channel the JAVEDA feed / the log / the level-ups / the welcomes
//   + the community part (lightning-community.js): XP and levels (/rank, /leaderboard), 🐾 Pup → 🐺 Wolf, time
//     badges, a welcome for new members, and moderation (/warn /warnings /timeout /kick /ban /purge)
// Buttons under the role picker give and take roles (made when they don't exist yet).
// The feed: today's challenge at noon (Brussels), and a new #1 on a board.
//
// Vercel environment: DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN, DISCORD_APP_ID, LIGHTNING_BOT_KEY (one you make up,
// for /api/discord/register and the feed), optional DISCORD_GUILD_ID (default: the Lightning Wolves server).
const crypto = require('crypto');
const express = require('express');

const API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
const GUILD = () => process.env.DISCORD_GUILD_ID || '490308164739399681';
const SITE = 'https://lightningwolves.studio';
const JAVEDA = SITE + '/javeda/';
const LINKS = { spotify: 'https://open.spotify.com/playlist/57mcBqSkldvZZwS7MccYj7', merch: 'https://www.even.biz/l/lightningwolves', even: 'https://www.even.biz/l/lazyjomusic' };
const GOLD = 0xffd60a, BLUE = 0x2f8fe0, PINK = 0xe040fb;
const EPHEMERAL = 64;

// the roles people pick themselves: [key, emoji, name, what finds an existing role of that kind]
const PICKER = [
  { title: '🌍 Where are you from?', color: BLUE, roles: [
    ['na', '🌎', 'North America', /north america/i], ['sa', '🌎', 'South America', /south america/i], ['eu', '🌍', 'Europe', /europe/i],
    ['as', '🌏', 'Asia', /\basia\b/i], ['af', '🌍', 'Africa', /africa/i], ['oc', '🌏', 'Australia & Oceania', /oceania|australia/i]] },
  { title: '🎨 What do you do?', color: PINK, roles: [
    ['twitch', '👾', 'Twitch Streamer', /twitch/i], ['yt', '🔴', 'YouTuber', /youtube/i], ['artist', '🎤', 'Artist', /\bartist\b/i],
    ['producer', '🎛️', 'Producer', /producer/i], ['designer', '🎨', 'Designer', /designer/i], ['hustle', '💵', 'Hustle', /hustle/i],
    ['girl', '🎀', 'Girl', /\bgirl\b/i]] },
  { title: '🔔 What do you want to hear about?', color: GOLD, roles: [
    ['player', '🎮', 'Player', /\bplayer\b/i], ['news', '🔔', 'JAVEDA News', /javeda news/i], ['music', '🎧', 'New Music', /new music/i]] },
];
const ROLE = Object.fromEntries(PICKER.flatMap(g => g.roles.map(([k, e, n, re]) => [k, { emoji: e, name: n, re }])));

// ── Discord ──
async function discord(path, method = 'GET', body, again = true) {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (r.status === 429 && again){ await new Promise(ok => setTimeout(ok, Math.min(5000, 1000 * ((data && data.retry_after) || 1)))); return discord(path, method, body, false); }
  if (!r.ok) { const err = new Error('discord ' + method + ' ' + path + ': ' + r.status + ' ' + (data && data.message || text)); err.status = r.status; err.code = data && data.code; throw err; }
  return data;
}
// Discord signs every request with its key: no valid signature, no answer (and it tests that)
function verified(req) {
  const sig = req.get('X-Signature-Ed25519'), ts = req.get('X-Signature-Timestamp'), key = process.env.DISCORD_PUBLIC_KEY;
  if (!sig || !ts || !key || !Buffer.isBuffer(req.body)) return false;
  try {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'hex')]);
    return crypto.verify(null, Buffer.concat([Buffer.from(ts), req.body]), { key: spki, format: 'der', type: 'spki' }, Buffer.from(sig, 'hex'));
  } catch (e) { return false; }
}
const fmt = n => Number(n || 0).toLocaleString('en-US');
const medal = i => ['🥇', '🥈', '🥉'][i] || '`' + String(i + 1).padStart(2, ' ') + '`';
const link = (label, url, emoji) => ({ type: 2, style: 5, label, url, ...(emoji ? { emoji: { name: emoji } } : {}) });
const row = (...components) => ({ type: 1, components });
const musicRow = () => row(link('Play JAVEDA', JAVEDA, '🎮'), link('Spotify', LINKS.spotify, '🎧'), link('Merch', LINKS.merch, '👕'), link('EVEN', LINKS.even, '💜'));

// ── what the bot says ──
function javedaCard() {
  return { embeds: [{ color: GOLD, title: '🎮 JAVEDA - the playable album by Lazy Jo', url: JAVEDA,
    description: '**28 songs, 28 levels: every song is a level.** Finish one to open the next, then come back and beat your score.\n\n' +
      '🏆 A scoreboard, a daily challenge and endless mode\n🤝 Online 1v1 with your friends: Hoops, Pass It On, Love Cards, Snap, Hockey, Golf for up to 4\n' +
      '📲 Get the app: free, and it plays offline\n💯 Points are earned by playing, never by streaming',
    image: { url: JAVEDA + 'og.jpg?v=2' }, footer: { text: 'lightningwolves.studio/javeda' } }], components: [musicRow()] };
}
function welcomeCard() {
  return { embeds: [{ color: GOLD, title: '🐺 Welcome to Lightning Wolves Games X TML',
    description: 'The home of **Lazy Jo** and the Lightning Wolves: artists, producers, designers, gamers and hustlers building together.\n\n' +
      '**🎮 NEW: JAVEDA, the playable album.** 28 songs, 28 levels: every song is a level. Free in your browser, or as an app on your phone. Online 1v1, a daily challenge and a scoreboard.',
    fields: [
      { name: '1 · Read the rules', value: 'The rules channel', inline: true }, { name: '2 · Pick your roles', value: 'The roles channel', inline: true },
      { name: '3 · Say hi', value: 'Introductions', inline: true }, { name: '4 · Play & post your score', value: 'The scores channel', inline: true }],
    image: { url: JAVEDA + 'og.jpg?v=2' }, footer: { text: 'Lightning Wolves · lightningwolves.studio' } }], components: [musicRow()] };
}
function rulesCard() {
  return { embeds: [{ color: BLUE, title: '📜 The rules',
    description: [
      '**1 · Be respectful.** Treat everyone with respect. Harassment, discrimination and hate speech are not tolerated.',
      '**2 · No spamming.** No spam with messages, emojis or GIFs. Keep channels clean and on topic.',
      '**3 · Appropriate content.** No NSFW. Keep it fine for everyone.',
      '**4 · Use the right channel.** Every channel says what it\'s for at the top.',
      '**5 · Promo in its place.** Your own music and links go in up-and-coming-artists, not everywhere.',
      '', '**The pack**', '🐾 **Pup**: new here. Chat a bit and you\'re a 🐺 **Wolf** at level 5 (or in 3 days).',
      '🌙 **Pack**: close friends · 👑 **Alpha**: our supporters · ⚡ **LIGHTNING WOLVES** and ⭐ **TML**: staff, ask them when you need help.',
      'Been here a while? 🌗 **Moon Wolf** after a month, 🌕 **Full Moon** after six, ⚡ **OG Wolf** after a year.'].join('\n') }] };
}
function pickerMessages() {
  return PICKER.map(g => ({ embeds: [{ color: g.color, title: g.title, description: 'Tap to get the role. Tap again to take it off.' }],
    components: chunk(g.roles, 5).map(rs => row(...rs.map(([k, e, n]) => ({ type: 2, style: 2, custom_id: 'role:' + k, label: n, emoji: { name: e } })))) }));
}
const chunk = (a, n) => a.reduce((o, x, i) => (i % n ? o[o.length - 1].push(x) : o.push([x]), o), []);
const help = () => ({ embeds: [{ color: BLUE, title: '⚡ Lightning Bot', description:
  '`/javeda` JAVEDA, the playable album\n`/top` the top 10 of a board\n`/daily` today\'s challenge\n`/rank` your level · `/leaderboard` the most active wolves\n\n' +
  'Mods: `/warn` `/warnings` `/timeout` `/kick` `/ban` `/purge`\nAdmins: `/setup welcome | rules | roles | feed | log | levels | intro`' }], flags: EPHEMERAL });

// ── JAVEDA, from the database ──
async function levelName(sb, id) {
  const { data } = await sb.from('javeda_levels').select('num, title').eq('id', id).maybeSingle();
  if (!data) return id;
  const part = (id.match(/^lvl\d+([b-z])$/) || [])[1];
  return 'Level ' + data.num + (part ? ' · Part ' + (part.charCodeAt(0) - 96) : '') + ' · ' + data.title;
}
async function today(sb) { const { data } = await sb.rpc('javeda_daily'); return data || null; }
async function board(sb, kind) {
  if (kind === 'online') {
    const { data } = await sb.from('javeda_1v1_board').select('username, wins, losses').gt('wins', 0).order('wins', { ascending: false }).limit(10);
    return { title: '🤝 Online 1v1 - most wins', rows: (data || []).map(r => [r.username, fmt(r.wins) + ' W · ' + fmt(r.losses) + ' L']) };
  }
  if (kind === 'daily') {
    const d = await today(sb); if (!d) return { title: '📅 Today\'s challenge', rows: [] };
    const { data } = await sb.from('javeda_daily_board').select('username, best_score').eq('day', d.day).order('best_score', { ascending: false }).limit(10);
    return { title: '📅 Today\'s challenge - ' + await levelName(sb, d.level), rows: (data || []).map(r => [r.username, fmt(r.best_score)]) };
  }
  const { data } = await sb.from('javeda_board').select('username, points').gt('points', 0).order('points', { ascending: false }).limit(10);
  return { title: '🏆 JAVEDA - points', rows: (data || []).map(r => [r.username, fmt(r.points) + ' pts']) };
}
function boardCard(b) {
  return { embeds: [{ color: GOLD, title: b.title, url: JAVEDA,
    description: b.rows.length ? b.rows.map((r, i) => medal(i) + ' **' + r[0] + '** - ' + r[1]).join('\n') : 'Nobody on this board yet. Be the first!',
    footer: { text: 'Make a free account in JAVEDA to get on the board' } }], components: [row(link('Play JAVEDA', JAVEDA, '🎮'))] };
}

// ── state the bot keeps (which channel is the feed, what it already said): table lightning_bot_state ──
async function getState(sb, key) { const { data } = await sb.from('lightning_bot_state').select('value').eq('key', key).maybeSingle(); return data ? data.value : null; }
async function setState(sb, key, value) { await sb.from('lightning_bot_state').upsert({ key, value, updated_at: new Date().toISOString() }); }

// ── roles: find it by name (any emoji around it), or make it ──
let rolesCache = null, rolesAt = 0;
async function guildRoles(force) {
  if (force || !rolesCache || Date.now() - rolesAt > 60000) { rolesCache = await discord('/guilds/' + GUILD() + '/roles'); rolesAt = Date.now(); }
  return rolesCache;
}
async function roleFor(key) {
  const def = ROLE[key]; if (!def) return null;
  let r = (await guildRoles()).find(x => def.re.test(x.name) && !x.managed);
  if (!r) { r = await discord('/guilds/' + GUILD() + '/roles', 'POST', { name: def.emoji + ' ' + def.name, mentionable: key === 'news' || key === 'music' }); rolesCache = null; }
  return r;
}
async function toggleRole(i, key) {
  const def = ROLE[key]; if (!def || !i.member) return 'That button is from an old message.';
  const role = await roleFor(key), has = (i.member.roles || []).includes(role.id), path = '/guilds/' + GUILD() + '/members/' + i.member.user.id + '/roles/' + role.id;
  try { await discord(path, has ? 'DELETE' : 'PUT'); }
  catch (e) { if (e.code === 50013) return '⚠️ I can\'t give **' + role.name + '** yet: staff, drag the Lightning Bot role above it in Server Settings → Roles.'; throw e; }
  return has ? 'Took off **' + role.name + '**.' : '✅ You got **' + role.name + '**.';
}

// ── the community part: levels, ranks, badges, welcomes, moderation ──
const C = require('./lightning-community')({ discord, GUILD, getState, setState, guildRoles, EPHEMERAL, GOLD, BLUE });

// ── the slash commands (registered by /api/discord/register) ──
const COMMANDS = [
  { name: 'javeda', description: 'JAVEDA - the playable album by Lazy Jo' },
  { name: 'top', description: 'The top 10 of a JAVEDA board', options: [{ type: 3, name: 'board', description: 'Which board', required: false,
    choices: [{ name: 'Points', value: 'points' }, { name: 'Online 1v1', value: 'online' }, { name: 'Today\'s challenge', value: 'daily' }] }] },
  { name: 'daily', description: 'Today\'s JAVEDA challenge' },
  { name: 'help', description: 'What Lightning Bot does' },
  { name: 'setup', description: 'Admins: post the welcome, rules or role picker here, or make this channel the JAVEDA feed',
    default_member_permissions: '8', dm_permission: false,
    options: ['welcome', 'rules', 'roles', 'feed', ...Object.keys(C.SETUP)].map(n => ({ type: 1, name: n, description: { welcome: 'Post the welcome card in this channel', rules: 'Post the rules in this channel',
      roles: 'Post the role picker in this channel', feed: 'Make this channel the JAVEDA feed (daily challenge, new #1s)', ...C.SETUP }[n] })) },
  ...C.COMMANDS,
];

async function command(i, sb) {
  const name = i.data.name;
  if (name === 'javeda') return javedaCard();
  if (name === 'help') return help();
  if (name === 'top') { if (!sb) return offline(); const opt = (i.data.options || []).find(o => o.name === 'board'); return boardCard(await board(sb, opt ? opt.value : 'points')); }
  if (name === 'daily') {
    if (!sb) return offline();
    const d = await today(sb); if (!d) return { content: 'No challenge today.', flags: EPHEMERAL };
    const b = await board(sb, 'daily');
    return { embeds: [{ color: GOLD, title: '📅 Today\'s JAVEDA challenge', url: JAVEDA, description: '**' + await levelName(sb, d.level) + '**\nThe same level for everyone today, with its own board - empty again tomorrow.\n\n' +
      (b.rows.length ? b.rows.slice(0, 5).map((r, n) => medal(n) + ' **' + r[0] + '** - ' + r[1]).join('\n') : 'Nobody has played it yet today. Be the first!') }], components: [row(link('Play today\'s challenge', JAVEDA, '🎮'))] };
  }
  if (name === 'setup') {
    const sub = i.data.options && i.data.options[0] && i.data.options[0].name, ch = i.channel_id || (i.channel && i.channel.id);
    if (sub === 'welcome') { await discord('/channels/' + ch + '/messages', 'POST', welcomeCard()); return done('Posted the welcome card.'); }
    if (sub === 'rules') { await discord('/channels/' + ch + '/messages', 'POST', rulesCard()); return done('Posted the rules.'); }
    if (sub === 'roles') { for (const m of pickerMessages()) await discord('/channels/' + ch + '/messages', 'POST', m); return done('Posted the role picker. The roles are made when someone first taps them.'); }
    if (sub === 'feed') { if (!sb) return offline(); await setState(sb, 'feed_channel', ch); return done('This channel is the JAVEDA feed now: today\'s challenge at noon, and every new #1.'); }
    if (C.SETUP[sub]) { if (!sb) return offline(); return done(await C.setup(sub, ch, sb)); }
  }
  const r = await C.command(i, sb); if (r) return r;
  return { content: 'I don\'t know that one.', flags: EPHEMERAL };
}
const done = text => ({ content: '✅ ' + text, flags: EPHEMERAL });
const offline = () => ({ content: 'JAVEDA\'s database can\'t be reached right now. Try again in a bit.', flags: EPHEMERAL });

// ── the feed: today's challenge (from noon, Brussels) and a new #1 ──
async function feed(sb) {
  const ch = process.env.DISCORD_FEED_CHANNEL || await getState(sb, 'feed_channel');
  if (!ch) return { posted: [], note: 'no feed channel yet: /setup feed in the channel' };
  const posted = [], post = async (m, what) => { await discord('/channels/' + ch + '/messages', 'POST', m); posted.push(what); };
  const d = await today(sb);
  const hour = process.env.LIGHTNING_BOT_TEST_HOUR ? +process.env.LIGHTNING_BOT_TEST_HOUR : +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', hour12: false }).format(new Date());
  if (d && hour >= 12 && (await getState(sb, 'daily_posted')) !== d.day) {
    const news = (await guildRoles().catch(() => [])).find(r => ROLE.news.re.test(r.name));
    await post({ content: news ? '<@&' + news.id + '>' : undefined, allowed_mentions: { roles: news ? [news.id] : [] },
      embeds: [{ color: GOLD, title: '📅 Today\'s JAVEDA challenge is up', url: JAVEDA, description: '**' + await levelName(sb, d.level) + '**\nThe same level for everyone today. Get on today\'s board before midnight!' }],
      components: [row(link('Play today\'s challenge', JAVEDA, '🎮'))] }, 'daily');
    await setState(sb, 'daily_posted', d.day);
  }
  // who is #1 now; the first run only remembers (no flood of "new #1" when the bot starts)
  const tops = (await getState(sb, 'tops')) || {}, now = {};
  for (const kind of ['points', 'online', 'daily']) {
    const b = await board(sb, kind); const first = b.rows[0]; if (!first) continue;
    now[kind] = (kind === 'daily' && d ? d.day + ':' : '') + first[0];
    if (tops[kind] !== undefined && tops[kind] !== now[kind]) {
      // who they passed (on the daily board only someone from today counts)
      const prev = String(tops[kind] || ''), sameDay = kind !== 'daily' || (d && prev.startsWith(d.day + ':'));
      const was = sameDay ? prev.replace(/^\d{4}-\d{2}-\d{2}:/, '') : '';
      await post({ embeds: [{ color: GOLD, title: '🏆 New #1: ' + first[0], url: JAVEDA,
        description: '**' + first[0] + '** is the new #1 on **' + b.title.replace(/^\S+\s/, '') + '** with ' + first[1] + (was && was !== first[0] ? ', passing **' + was + '**' : '') + '.' }],
        components: [row(link('Beat it', JAVEDA, '🎮'))] }, 'top:' + kind);
    }
  }
  await setState(sb, 'tops', { ...tops, ...now });
  return { posted };
}

// ── the routes ──
function mount(app, getSb) {
  // Discord: commands and button taps (the raw body, for the signature)
  app.post('/api/discord/interactions', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!verified(req)) return res.status(401).send('bad signature');
    let i; try { i = JSON.parse(req.body.toString('utf8')); } catch (e) { return res.status(400).send('bad json'); }
    if (i.type === 1) return res.json({ type: 1 });                                  // Discord checking the address
    try {
      if (i.type === 2) return res.json({ type: 4, data: await command(i, getSb()) });
      if (i.type === 3 && /^role:/.test(i.data.custom_id)) return res.json({ type: 4, data: { content: await toggleRole(i, i.data.custom_id.slice(5)), flags: EPHEMERAL } });
      return res.json({ type: 4, data: { content: 'Nothing to do here.', flags: EPHEMERAL } });
    } catch (e) {
      console.error('lightning bot:', e);
      return res.json({ type: 4, data: { content: '⚠️ Something went wrong: ' + String(e.message || e).slice(0, 300), flags: EPHEMERAL } });
    }
  });
  const keyOk = req => !!process.env.LIGHTNING_BOT_KEY && (req.get('x-lightning-key') || req.query.key) === process.env.LIGHTNING_BOT_KEY;
  // once (and after a change to the commands): put the slash commands in the server
  app.get('/api/discord/register', async (req, res) => {
    if (!keyOk(req)) return res.status(401).json({ error: 'key' });
    try { const r = await discord('/applications/' + process.env.DISCORD_APP_ID + '/guilds/' + GUILD() + '/commands', 'PUT', COMMANDS);
      res.json({ ok: true, commands: r.map(c => '/' + c.name) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  // every 5 minutes, from pg_cron: the feed
  app.post('/api/discord/feed', express.json(), async (req, res) => {
    if (!keyOk(req)) return res.status(401).json({ error: 'key' });
    const sb = getSb(); if (!sb) return res.status(503).json({ error: 'no database' });
    try { const f = await feed(sb); f.community = await C.tick(sb); res.json(f); } catch (e) { console.error('lightning bot feed:', e); res.status(500).json({ error: e.message }); }
  });
}

module.exports = { mount, COMMANDS, PICKER, _test: { feed, command, toggleRole, verified, C } };
