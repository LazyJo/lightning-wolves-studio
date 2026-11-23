-- ═══════════════════════════════════════════════════════════════════════════
-- LAZY JO fan list ("Stay in the loop") — replaces the EVEN fan sign-up.
-- Run this in Supabase > SQL Editor. Safe to re-run.
--
-- Who can touch it: nobody from the browser. RLS is on with no policies, so
-- only the server (service role, server.js /api/lazyjo/fans*) reads or writes.
-- GDPR: we store the exact consent wording and when it was given, use double
-- opt-in (confirmed_at) before any newsletter goes out, and every email carries
-- a one-click unsubscribe (token). Deleting a row = erasing the fan.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lazyjo_fans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  name             TEXT,
  source           TEXT NOT NULL DEFAULT 'universe',   -- universe | purchase | profile | even-import
  consent_text     TEXT NOT NULL,                      -- the exact sentence they agreed to
  consent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ,                        -- double opt-in: only confirmed fans get newsletters
  confirm_sent_at  TIMESTAMPTZ,
  unsubscribed_at  TIMESTAMPTZ,
  token            UUID NOT NULL DEFAULT gen_random_uuid(), -- confirm + unsubscribe links
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lazyjo_fans_email_key ON lazyjo_fans (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS lazyjo_fans_token_key ON lazyjo_fans (token);

ALTER TABLE lazyjo_fans ENABLE ROW LEVEL SECURITY;

-- What was sent to the list, and to how many (history for the admin tab).
CREATE TABLE IF NOT EXISTS lazyjo_broadcasts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  sent_count  INT  NOT NULL DEFAULT 0,
  sent_by     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lazyjo_broadcasts ENABLE ROW LEVEL SECURITY;
