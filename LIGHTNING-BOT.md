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
| `/setup welcome` · `rules` · `roles` · `feed` | Admins only. Posts the welcome card, the rules or the role picker in this channel, or makes this channel the JAVEDA feed |

- **Role picker:** buttons for region, what you do, and notifications (🎮 Player, 🔔 JAVEDA News, 🎧 New Music). A tap gives the role, a second tap takes it off.
  - The bot finds a role that already exists by its name (any emoji around it), so the old ones are kept.
  - A role that doesn't exist yet is made at the first tap.
- **Feed:**
  - Today's challenge at noon (Brussels), pinging 🔔 JAVEDA News.
  - "🏆 New #1" when someone takes the top of a board.

## Setting it up (once, about 10 minutes)

The keys stay with you. They go into Vercel and Supabase, **never into a chat**.

1. **Make the bot:** https://discord.com/developers/applications → **New Application** → "Lightning Bot".
   - Upload `discord/lightning-bot-avatar.png` as the app icon.
   - In **Bot**, upload the same avatar, and `discord/lightning-bot-banner.png` as the banner.
   - In **Bot** → **Reset Token**: copy the token straight into Vercel (step 2).
   - The bot needs no privileged intents.
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
   - Bot permissions: View Channels, Send Messages, Embed Links, Manage Roles.
   - Open the link and choose the server.
5. **Put the commands in:** open `https://lightningwolves.studio/api/discord/register?key=<your LIGHTNING_BOT_KEY>`. It shows `/javeda /top /daily /help /setup`. Do it again whenever the commands change.
6. **Roles:** Server Settings → Roles → drag **Lightning Bot** above the roles it hands out (regions, Artist, Producer…) and below the staff roles. A role above it can't be given; the bot then tells you which one.
7. **Database:** in the Supabase SQL editor, run the newest `supabase-javeda-schema.sql`. It adds the `lightning_bot_state` table.
8. **In Discord:**
   - `/setup welcome` in #👋・welcome
   - `/setup rules` in #📜・rules
   - `/setup roles` in #🎭・roles
   - `/setup feed` in #📅・daily-challenge

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
    timeout_milliseconds := 30000);
$$);
```

   Is it running? `SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;`
   - 200: it's running.
   - `{"posted":[],"note":"no feed channel yet..."}`: do `/setup feed`.
10. **The old Lightning Bot:** once the new role picker works and you've checked it, remove the old bot (Server Settings → Integrations) and hide the old `#region` / `#roles` channels.

## Changing it
- Commands: `COMMANDS` in `lightning-bot.js`, then step 5 again.
- The roles in the picker: `PICKER` in `lightning-bot.js`. Each one has a pattern that finds an existing role by name.
- Links (Spotify, Merch, EVEN): `LINKS` in `lightning-bot.js` (the same as in `client/public/javeda/index.html`).
