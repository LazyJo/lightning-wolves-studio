# javeda-push — JAVEDA's notifications

"Today's challenge is up" and "someone beat your score", for phones (and browsers) that turned them on in JAVEDA.

How it fits together:

1. **The page** (`client/public/javeda/index.html`) asks the browser for a push address and sends it, with what the
   player wants, to `javeda_push_set` (the Notifications section of `supabase-javeda-schema.sql`). Then it calls this
   function with `{"hello": "<that address>"}` for a first message, so the player sees it works.
2. **The scores**: triggers on `javeda_progress` and `javeda_daily_scores` queue everyone a new best passes who asked
   for "beaten" (`javeda_push_queue`).
3. **pg_cron** calls this function every 5 minutes with `{"run": true}` and the `x-javeda-key` header. It sends the
   queue (`javeda_push_take`: one message a player, at most one every 6 hours) and, once a day from noon in Brussels,
   today's challenge (`javeda_push_daily_due`).
4. **The service worker** (`client/public/javeda/sw.js`) shows the message; a tap opens JAVEDA on that board.

The secrets are in `L:\Lazy Jo\Lightning Wolves\GAME\.env.javeda-push.local` (never in the repo). The public VAPID
key is also in index.html (`VAPID`) — the two must match, or no phone gets anything.

Setting it up again (project `wjvvkffroujkhbisxnab`):

```bash
npx supabase secrets set --env-file "L:/Lazy Jo/Lightning Wolves/GAME/.env.javeda-push.local" --project-ref wjvvkffroujkhbisxnab
npx supabase functions deploy javeda-push --no-verify-jwt --use-api --project-ref wjvvkffroujkhbisxnab
```

and once, in the SQL editor (with the JAVEDA_PUSH_KEY value from that file in place of `<key>`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT vault.create_secret('<key>', 'javeda_push_key');
SELECT cron.schedule('javeda-push', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://wjvvkffroujkhbisxnab.supabase.co/functions/v1/javeda-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-javeda-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'javeda_push_key')),
    body := '{"run": true}'::jsonb,
    timeout_milliseconds := 60000);
$$);
```

Is it running? `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'javeda-push') ORDER BY start_time DESC LIMIT 5;`
and `SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;`
