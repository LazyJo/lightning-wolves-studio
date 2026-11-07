# Lightning Bot — the Discord bot of "Lightning Wolves Games X TML"

The code is in `lightning-bot.js`, mounted by `server.js`. There's no bot server of its own:

- **Commands and button taps:** Discord sends them to `https://lightningwolves.studio/api/discord/interactions`.
- **The JAVEDA feed:** pg_cron in Supabase calls `https://lightningwolves.studio/api/discord/feed` every 5 minutes.

What it does:

| Command | What |
|---|---|
| `/javeda` | The JAVEDA card: what it is, plus buttons for Play, Spotify, Merch and EVEN |
| `/top` | Top 10 of a board: points, online 1v1, or today's challenge |
| `/daily` | Today's challenge and its top 5 |
| `/help` | What the bot does |
| `/regions` | Where the members come from: each region role and how many have it (counted every 5 minutes) |
| `/rank` · `/leaderboard` | Your level and XP · the 10 most active wolves |
| `/warn` `/warnings` `/timeout` `/kick` `/ban` `/purge` | Mods only (Discord's own permissions decide who). Each one goes in the log channel |
| `/setup welcome` · `rules` · `roles` · `feed` · `log` · `levels` · `intro` | Admins only. Posts the welcome card, the rules or the role picker in this channel, or makes this channel the JAVEDA feed / the log / the level-ups / the welcomes for new members |

- **Role picker:** buttons for region, what you do, notifications (🎮 Player, 🔔 JAVEDA News, 🎧 New Music) and what you play on (🕹️ PlayStation, 💻 PC, 🟩 Xbox). A tap gives the role, a second tap takes it off.
  - The bot finds a role that already exists by its name (any emoji around it), so the old ones are kept.
  - A role that doesn't exist yet is made at the first tap.
- **Community** (`lightning-community.js`), what MEE6, ProBot and carl-bot did. Every 5 minutes it reads what's new:
  - **XP for chatting**, MEE6's rules: 15–25 XP a message, at most once a minute. Level-ups are posted in the levels channel.
  - **A new member** gets 🐾 Pup and a welcome in the intro channel.
  - **🐾 Pup → 🐺 Wolf** at level 5, or after 3 days (the 3 days only for whoever joined after the bot started; old Rookies get in by level or by hand).
  - **Time badges** (only the highest): 🌗 Moon Wolf after 1 month, 🌕 Full Moon after 6, ⚡ OG Wolf after a year.
  - The ranks are found by name, old names too (Rookies = Pup, New Blood = Wolf, Trusted = Pack, VIP = Alpha). Missing ones are made.
  - **Spam and bad-word filters:** Discord's own AutoMod (Server Settings → AutoMod). **Who deleted what:** Discord's Audit Log.
  - **Music in voice** (what Green-bot did) needs a bot that's online 24/7: not part of this.
- **Feed:**
  - Today's challenge at noon (Brussels), pinging 🔔 JAVEDA News.
  - "🏆 New #1" when someone takes the top of a board.

## Setting it up (once, about 10 minutes)

The keys stay with you. They go into Vercel and Supabase, **never into a chat**.

1. **Make the bot:** https://discord.com/developers/applications → **New Application** → "Lightning Bot". (If you already have a "Lightning Bot" application, use that one: Reset Token stops the old code, and step 5 removes its old commands.)
   - Upload `discord/lightning-bot-avatar.png` as the app icon.
   - In **Bot**, upload the same avatar, and `discord/lightning-bot-banner.png` as the banner.
   - In **Bot** → **Reset Token**: copy the token straight into Vercel (step 2).
   - In **Bot**, switch on **Server Members Intent**. That lets it see who joined when, for Pup, Wolf and the badges. Message Content Intent is not needed.
2. **Vercel** → the project → Settings → Environment Variables (Production). Add:
   - `DISCORD_APP_ID`: General Information → Application ID
   - `DISCORD_PUBLIC_KEY`: General Information → Public Key
   - `DISCORD_BOT_TOKEN`: the token from step 1
   - `LIGHTNING_BOT_KEY`: make one up, long and random (e.g. 40 letters and digits). Keep it in your `.env` file on your PC.
   - `DISCORD_GUILD_ID` is only needed for another server. The default is 490308164739399681.

   Then redeploy (or push), so the settings are live.
3. **Point Discord at the bot:** General Information → **Interactions Endpoint URL**: `https://lightningwolves.studio/api/discord/interactions` → Save. Discord tests the address. If it can't save, step 2 isn't live yet.
4. **Invite it:** OAuth2 → URL Generator.
   - Scopes: `bot` + `applications.commands`.
   - Bot permissions: View Channels, Send Messages, Embed Links, Read Message History, Manage Roles, Manage Messages, Kick Members, Ban Members, Moderate Members.
   - Open the link and choose the server.
5. **Put the commands in:** open `https://lightningwolves.studio/api/discord/register?key=<your LIGHTNING_BOT_KEY>`. It shows the commands, and under `removed_old` any old global commands it took out. Do it again whenever the commands change.
6. **Roles:** Server Settings → Roles → drag **Lightning Bot** above the roles it hands out (regions, Artist, Producer…, ⚡ OG Wolf) and below the staff roles. A role above it can't be given; the bot then tells you which one.
   - **Channels it must see:** the bot only reads and posts where its role can see. In every channel that is read-only or hidden for @everyone (welcome, rules, roles, wolf-den, creators-lounge, log), add the **Lightning Bot** role with View Channel, Send Messages, Embed Links and Read Message History on "allow". Without this, `/setup` fails there and chat in hidden channels gets no XP. The private Money Corner can stay closed to it.
7. **Database:** in the Supabase SQL editor, run the newest `supabase-javeda-schema.sql`. It adds the `lightning_bot_state` table.
8. **In Discord:**
   - `/setup welcome` in #👋・welcome
   - `/setup rules` in #📜・rules
   - `/setup roles` in #🎭・roles
   - `/setup feed` in #📅・daily-challenge
   - `/setup intro` in #🙌・introductions (the welcomes for new members)
   - `/setup levels` in #🐺・wolf-den (the level-ups)
   - `/setup log` in #📋・log (warns, timeouts, kicks, bans, purges)

   Pin the welcome card.
9. **The feed every 5 minutes:** run this once in the Supabase SQL editor, with your LIGHTNING_BOT_KEY in place of `<key>`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT vault.create_secret('<key>', 'lightning_bot_key');
SELECT cron.schedule('lightning-bot-feed', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://lightningwolves.studio/api/discord/feed',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-lightning-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lightning_bot_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$$);
```

   Is it running? `SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;`
   - 200: it's running.
   - `{"posted":[],"note":"no feed channel yet..."}`: do `/setup feed`.
10. **The old bots:** once the new role picker, the levels and the welcomes work and you've checked them, remove MEE6, ProBot and carl-bot (and an old Lightning Bot if it was a separate application) (Server Settings → Integrations), and hide the old `#region` / `#roles` channels.
    - Before removing MEE6/ProBot: did they give new members a role automatically? Lightning Bot does that now.
    - Did they filter spam? Switch on AutoMod first (Server Settings → AutoMod → "Block spam" and "Block words").
    - Green-bot (music) can stay until there's a 24/7 music bot.

## Changing it
- Commands: `COMMANDS` in `lightning-bot.js`, then step 5 again.
- The roles in the picker: `PICKER` in `lightning-bot.js`. Each one has a pattern that finds an existing role by name.
- Links (Spotify, Merch, EVEN): `LINKS` in `lightning-bot.js` (the same as in `client/public/javeda/index.html`).

## The database alarm
`lightning-health.js`, at `https://lightningwolves.studio/api/health`. It checks that JAVEDA's Supabase answers (a
database read and the log-in service, 8 s each, again 5 s later before it calls it down). When it doesn't, Lightning
Bot DMs the server's owner and posts in the log channel, with the fix (Supabase → Project Settings → General →
Restart project); at most once an hour, and one "it's back" when it is. It has to be called from outside Supabase
(the 5-minute pg_cron timer runs in the same database and stops with it):

- **cron-job.org** (free): Create cronjob → URL `https://lightningwolves.studio/api/health`, every 5 minutes,
  timeout 30 s. Under Notifications, tick "on failure" too, for an email as well (the address answers 503 when down).
- Needs no key. The bot needs nothing new (it already has the DISCORD_BOT_TOKEN); Discord allows DMs from server members by default.
