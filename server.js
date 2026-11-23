require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase ────────────────────────────────────────────────────────────────
let supabase = null;
try {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    supabase = createClient(sbUrl, sbKey);
  } else {
    console.warn('Supabase not configured — running in guest-only mode');
  }
} catch (err) {
  console.warn('Supabase init failed:', err.message);
}

// ─── Anthropic ───────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── OpenAI (Whisper) ────────────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ─── Groq (Whisper-large-v3, OpenAI-compatible) ─────────────────────────────
// Same SDK, different base URL. whisper-large-v3 handles songs that whisper-1
// silently chokes on (heavy production, vocal effects, accents). OpenAI is the
// fallback when GROQ_API_KEY is missing or Groq fails mid-request.
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

// ─── Stripe ──────────────────────────────────────────────────────────────────
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('Stripe not configured — checkout endpoints will 503 until STRIPE_SECRET_KEY is set');
}

// ─── Replicate (video/image gen router) ─────────────────────────────────────
let replicate = null;
if (process.env.REPLICATE_API_TOKEN) {
  const Replicate = require('replicate');
  replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
} else {
  console.warn('Replicate not configured — /api/generate-visuals will stub out until REPLICATE_API_TOKEN is set');
}

// Map internal tier id → Stripe price id per billing interval. Price IDs are
// environment-driven so swapping between test and live mode is a single env
// change. Each tier has one Price per interval in the Stripe dashboard.
const PRICE_MAP = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  creator: {
    monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY,
    annual:  process.env.STRIPE_PRICE_CREATOR_ANNUAL,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL,
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY,
    annual:  process.env.STRIPE_PRICE_ELITE_ANNUAL,
  },
};

// How many credits each tier lands with on activation. Matches the pricing
// page copy — if the pricing numbers change, this table is the source of truth.
const TIER_CREDITS = {
  starter: 300,
  creator: 1295,
  pro:     2625,
  elite:   4550,
};

// ─── JAVEDA Pass ─────────────────────────────────────────────────────────────
// One payment opens all of JAVEDA (lightningwolves.studio/javeda) for a player straight away: every part, the
// endless and the remixes. The Pass is a row in javeda_passes that only javeda_grant_pass (service role) writes -
// from the webhook and from /api/javeda/pass/confirm when the player comes back, whichever is first. A full refund
// takes it away again (revokeJavedaPass), and a refunded payment never grants it twice. What a level
// opens is the database's business (supabase-javeda-schema.sql), not this file's.
const JAVEDA_PASS_CENTS = parseInt(process.env.JAVEDA_PASS_CENTS || '499', 10);
// where a checkout may send the player back to: the site, its previews, local dev
const JAVEDA_ORIGINS = /^https:\/\/((www\.)?lightningwolves\.studio|lightning-wolves-studio-[a-z0-9-]+-lazyjos-projects\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;

// A checkout stays "paid" after a refund, so ask the charge: the old "thank you" link or a webhook retry must not bring the Pass back.
async function javedaPaymentRefunded(session) {
  const id = session.payment_intent?.id || session.payment_intent;
  if (!id) return false;
  const intent = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
  return !!intent.latest_charge?.refunded;
}

async function grantJavedaPass(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId || session.metadata?.kind !== 'javeda_pass' || session.payment_status !== 'paid') return { pass: false };
  if (await javedaPaymentRefunded(session)) return { pass: false, refunded: true };
  const { error } = await supabase.rpc('javeda_grant_pass', { p_user: userId, p_source: 'stripe', p_ref: session.id });
  if (error) throw new Error(`javeda_grant_pass: ${error.message}`);
  return { pass: true };
}

// A payment refunded in full: the Pass it paid for goes (that one only, by its checkout). Anything else has no such
// checkout, a studio subscription for one, and is left alone.
async function revokeJavedaPass(paymentIntent) {
  const { data } = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
  const session = data[0];
  if (session?.metadata?.kind !== 'javeda_pass') return false;
  const { error } = await supabase.from('javeda_passes').delete().eq('source', 'stripe').eq('ref', session.id);
  if (error) throw new Error(`javeda_passes: ${error.message}`);
  return true;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());

// Stripe webhook needs the raw request body for signature verification —
// mount it before express.json() so the body stays a Buffer on this route.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe not configured');
  if (!supabase) return res.status(503).send('Supabase not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('STRIPE_WEBHOOK_SECRET not set');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.kind === 'javeda_pass') { await grantJavedaPass(session); break; }
        const userId = session.client_reference_id || session.metadata?.userId;
        const tier = session.metadata?.tier;
        if (userId && tier && TIER_CREDITS[tier] !== undefined) {
          await supabase
            .from('profiles')
            .update({
              tier,
              wolf_credits: TIER_CREDITS[tier],
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            })
            .eq('id', userId);
        }
        break;
      }
      // a JAVEDA Pass paid with a method that settles later (SEPA and the like)
      case 'checkout.session.async_payment_succeeded': {
        await grantJavedaPass(event.data.object);
        break;
      }
      // a partial refund (a goodwill gesture) keeps the Pass
      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.refunded && charge.payment_intent) await revokeJavedaPass(charge.payment_intent);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // Downgrade path: on cancel at period end we keep tier until the
        // period actually ends, then the deleted event flips to free.
        if (sub.cancel_at_period_end) break;
        // Reinstate or plan change — look up the profile by customer id.
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single();
        if (profile) {
          // Map price id back to tier via PRICE_MAP.
          const priceId = sub.items?.data?.[0]?.price?.id;
          const tier = Object.entries(PRICE_MAP).find(([, p]) =>
            priceId === p.monthly || priceId === p.annual
          )?.[0];
          if (tier) {
            await supabase
              .from('profiles')
              .update({ tier, wolf_credits: TIER_CREDITS[tier] })
              .eq('id', profile.id);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('profiles')
          .update({
            tier: 'free',
            wolf_credits: 100,
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', sub.customer);
        break;
      }
      default:
        // Events we don't need yet — acknowledge to stop Stripe retrying.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('Handler failed');
  }
});

// Lightning Bot (Discord): slash commands, buttons and the JAVEDA feed. Its interactions need the raw body for
// Discord's signature, so it goes before express.json(). See lightning-bot.js and LIGHTNING-BOT.md.
require('./lightning-bot').mount(app, () => supabase);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Multer ───────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = /audio|video/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only audio and video files are allowed'));
  },
});

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function getUserFromToken(req) {
  if (!supabase) return null;
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch { return null; }
}

async function getProfile(userId) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  } catch { return null; }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public config — exposes keys needed by the frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    stripeConfigured: !!stripe,
    javedaPassCents: stripe ? JAVEDA_PASS_CENTS : null,
  });
});

// JAVEDA's video box: Lazy Jo's music videos. Three sources, the first that gives any:
//  1. Lazy Jo's own pick, kept in Supabase: javeda_settings.videos, in the order to show. Each one is a YouTube video ID
//     (its title from oEmbed) or a video file in Supabase Storage, bucket media (an .mp4; without a folder it's in
//     javeda/). A title can follow after a |. Changed in the SQL Editor with
//     UPDATE javeda_settings SET videos = ARRAY['javeda-teaser.mp4', 'W998C_SZdxE', 'performance.mp4|Live'] WHERE id;
//  2. the YouTube Data API, when YOUTUBE_API_KEY is set on Vercel (the channel's uploads);
//  3. the channel's public feed (no key - YouTube switches it off for days at a time, then it answers 404).
// From 2 and 3 only the music videos: no #hashtag clips, no Shorts, no reactions or live shows.
// Kept 30 minutes here and on Vercel's edge; when nothing answers, the last list (or none).
const YT_CHANNEL = 'UCBt7oknMx1TmoRjX3hqUgWQ';
let ytVideos = { at: 0, list: null, from: null }, ytTried = 0;
const xmlText = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
function ytFeed(xml) {
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => {
    const e = m[1], id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    return id && { id, title: xmlText((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]).slice(0, 140), published: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null,
      short: /<link rel="alternate" href="https:\/\/www\.youtube\.com\/shorts\//.test(e) };
  }).filter(Boolean).slice(0, 15);
}
const ytGet = (url, json = true) => fetch(url, { signal: AbortSignal.timeout(6000) }).then(r => { if (!r.ok) throw new Error(r.status + ' ' + url.split('?')[0]); return json ? r.json() : r.text(); });
const musicVideo = v => !v.short && !/#|\breact(ion|s)?\b|\blive\b|\blive show\b/i.test(v.title);
const YT_SOURCES = {
  async api() {
    const key = process.env.YOUTUBE_API_KEY; if (!key) return [];
    const j = await ytGet('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&playlistId=UU' + YT_CHANNEL.slice(2) + '&key=' + encodeURIComponent(key));
    return (j.items || []).map(it => it.snippet || {}).filter(sn => sn.resourceId && /^[\w-]{11}$/.test(sn.resourceId.videoId) && sn.title !== 'Private video' && sn.title !== 'Deleted video')
      .map(sn => ({ id: sn.resourceId.videoId, title: String(sn.title).slice(0, 140), published: sn.publishedAt || null, short: /#shorts?\b/i.test(sn.title + ' ' + (sn.description || '')) }));
  },
  async feed() { return ytFeed(await ytGet('https://www.youtube.com/feeds/videos.xml?channel_id=' + YT_CHANNEL, false)); },
  async list() {
    if (!supabase) return [];
    const { data } = await supabase.from('javeda_settings').select('videos').eq('id', true).maybeSingle();
    const items = (data && Array.isArray(data.videos) ? data.videos : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 8);
    return (await Promise.all(items.map(x => {
      const [ref, label] = x.split('|').map(t => t.trim()), title = label ? label.slice(0, 140) : null;
      // a file in Storage: a plain path ending in .mp4 (no .., no leading /)
      if (/^[\w .()\-]+(\/[\w .()\-]+)*\.mp4$/i.test(ref) && !ref.includes('..')) {
        const path = ref.includes('/') ? ref : 'javeda/' + ref, teaser = /javeda/i.test(ref) && /teaser|trailer/i.test(ref);
        return { mp4: path, title: title || (teaser ? 'Lazy Jo \u00b7 JAVEDA' : ref.replace(/^.*\//, '').replace(/\.mp4$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()),
          teaser, short: teaser };
      }
      if (!/^[\w-]{11}$/.test(ref)) return null;
      const id = ref;
      return ytGet('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(o => ({ id, title: title || String(o.title || '').slice(0, 140), published: null, short: o.height > o.width }))
      .catch(() => ({ id, title: title || 'Lazy Jo', published: null, short: false }));
    }))).filter(Boolean);
  },
};
app.get('/api/javeda/videos', async (req, res) => {
  if ((!ytVideos.list || Date.now() - ytVideos.at > 30 * 60e3) && Date.now() - ytTried > 5 * 60e3) {
    ytTried = Date.now();   // nothing answered: not again for 5 minutes
    for (const from of ['list', 'api', 'feed']) {
      try { const list = (await YT_SOURCES[from]()).filter(v => from === 'list' || musicVideo(v)).slice(0, 8); if (list.length) { ytVideos = { at: Date.now(), list, from }; ytTried = 0; break; } }
      catch (e) { console.warn('[javeda videos]', from, e.message); }
    }
  }
  res.set('Cache-Control', ytVideos.list ? 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400' : 'no-store');
  res.json({ videos: ytVideos.list || [], from: ytVideos.from });
});
app.ytFeed = ytFeed; app.ytSources = YT_SOURCES; app.ytMusic = musicVideo;   // for the test

// Create a Stripe Checkout Session for a studio subscription tier.
// Requires a signed-in user — tier + billing interval come from the client.
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const { tier, interval, token } = req.body;
    if (!tier || !PRICE_MAP[tier]) {
      return res.status(400).json({ error: 'Unknown tier' });
    }
    const priceId = PRICE_MAP[tier][interval === 'annual' ? 'annual' : 'monthly'];
    if (!priceId) {
      return res.status(500).json({ error: `Stripe price id not configured for ${tier}/${interval}` });
    }

    const user = await getUserFromToken({ headers: { authorization: token ? `Bearer ${token}` : '' } });
    if (!user) {
      return res.status(401).json({ error: 'Sign in required before checkout' });
    }

    // Base URL for the success/cancel redirects — prod uses the deployed
    // domain, local dev falls back to the referer header or localhost.
    const origin =
      process.env.PUBLIC_APP_URL ||
      req.headers.origin ||
      req.headers.referer?.replace(/\/$/, '') ||
      'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, tier, interval },
      subscription_data: {
        metadata: { userId: user.id, tier },
      },
      success_url: `${origin}/?checkout=success&tier=${tier}`,
      cancel_url:  `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: err.message || 'Checkout failed' });
  }
});

// The JAVEDA Pass: a one-time Checkout for a signed-in player who hasn't got it yet.
app.post('/api/javeda/pass/checkout', async (req, res) => {
  if (!stripe || !supabase) return res.status(503).json({ error: "Payments aren't set up yet" });
  try {
    const { token } = req.body || {};
    const user = await getUserFromToken({ headers: { authorization: token ? `Bearer ${token}` : '' } });
    if (!user) return res.status(401).json({ error: 'Sign in first' });
    // no Pass table yet (the schema isn't run): no payment either, there'd be nowhere to put the Pass
    const { data: has, error: passErr } = await supabase.from('javeda_passes').select('user_id').eq('user_id', user.id).maybeSingle();
    if (passErr) return res.status(503).json({ error: "Payments aren't set up yet" });
    if (has) return res.status(409).json({ error: 'You already have the JAVEDA Pass' });
    const origin = JAVEDA_ORIGINS.test(req.headers.origin || '')
      ? req.headers.origin
      : (process.env.PUBLIC_APP_URL || 'https://lightningwolves.studio').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: JAVEDA_PASS_CENTS,
          tax_behavior: 'inclusive',
          product_data: {
            name: 'JAVEDA Pass',
            description: 'Every part, endless and remix of JAVEDA by Lazy Jo, open right away. One payment, yours for good.',
          },
        },
      }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { kind: 'javeda_pass', userId: user.id },
      // on the bank statement: the account's shortened descriptor, then this. "LAZY JO* JAVEDA PASS" is 20 of the 22 allowed
      payment_intent_data: { metadata: { kind: 'javeda_pass', userId: user.id }, statement_descriptor_suffix: 'JAVEDA PASS' },
      ...(process.env.JAVEDA_STRIPE_TAX === '1' ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${origin}/javeda/?pass=done&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/javeda/?pass=cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('JAVEDA Pass checkout error:', err);
    res.status(500).json({ error: 'Checkout failed. Try again in a minute.' });
  }
});

// Back from the checkout: grant the Pass now rather than wait for the webhook.
app.post('/api/javeda/pass/confirm', async (req, res) => {
  if (!stripe || !supabase) return res.status(503).json({ error: "Payments aren't set up yet" });
  try {
    const { token, session_id } = req.body || {};
    const user = await getUserFromToken({ headers: { authorization: token ? `Bearer ${token}` : '' } });
    if (!user) return res.status(401).json({ error: 'Sign in first' });
    if (typeof session_id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(session_id)) {
      return res.status(400).json({ error: 'No such checkout' });
    }
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if ((session.client_reference_id || session.metadata?.userId) !== user.id) {
      return res.status(403).json({ error: "That checkout isn't yours" });
    }
    const got = await grantJavedaPass(session);
    if (got.pass) return res.json({ pass: true });
    res.json({ ...got, status: session.payment_status });
  } catch (err) {
    console.error('JAVEDA Pass confirm error:', err);
    res.status(500).json({ error: "Couldn't check the payment" });
  }
});

// ─── LAZY JO UNIVERSE — direct single sales (/lazyjo/) ─────────────────────────
// Prices come from the same catalogue the client renders, so the browser can
// only pick *which* single and how much extra to give — never a lower price.
// Guest checkout (fans don't need a Lightning Wolves account). Delivery: after
// Stripe redirects back, /api/lazyjo/download re-verifies the Checkout Session
// with Stripe and returns a short-lived signed URL to the master in a PRIVATE
// Supabase Storage bucket.
const LAZYJO_CATALOG = require('./client/src/lazyjo/singles.json');
const LAZYJO_MAX_CENTS = 50000;            // cap "pay what you want" at €500
const LAZYJO_DOWNLOAD_DAYS = 30;           // re-download window per purchase
const LAZYJO_BUCKET = process.env.LAZYJO_MASTERS_BUCKET || 'lazyjo-masters';
const lazyjoSingle = (id) => LAZYJO_CATALOG.singles.find((s) => s.id === id);
const lazyjoTitle = (s) => (s.feat ? `${s.title} (feat. ${s.feat})` : s.title);

app.post('/api/lazyjo/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Checkout is not configured yet' });
  try {
    const { singleId, amountCents } = req.body || {};
    const single = typeof singleId === 'string' ? lazyjoSingle(singleId) : null;
    if (!single) return res.status(404).json({ error: 'Unknown single' });

    const min = single.priceCents;
    const requested = Number.isInteger(amountCents) ? amountCents : min;
    const amount = Math.max(min, Math.min(requested, LAZYJO_MAX_CENTS));

    const origin = (
      process.env.PUBLIC_APP_URL ||
      req.headers.origin ||
      'http://localhost:5173'
    ).replace(/\/$/, '');

    const productImage =
      single.cover && origin.startsWith('https://') ? [origin + encodeURI(single.cover)] : undefined;

    const metadata = {
      kind: 'lazyjo-single',
      singleId: single.id,
      amountCents: String(amount),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        single.stripePriceId && amount === min
          ? { price: single.stripePriceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: LAZYJO_CATALOG.currency,
                unit_amount: amount,
                tax_behavior: 'inclusive', // prices shown are what the fan pays, VAT included
                product_data: {
                  name: `${lazyjoTitle(single)} — ${LAZYJO_CATALOG.artist}`,
                  description: single.track && LAZYJO_CATALOG.album
                    ? `From ${LAZYJO_CATALOG.album} · track ${single.track} · WAV download · supports the artist directly`
                    : 'Digital single · high-quality download · supports the artist directly',
                  ...(productImage ? { images: productImage } : {}),
                },
              },
            },
      ],
      metadata,
      payment_intent_data: { metadata },
      // EU VAT on digital sales: set LAZYJO_STRIPE_TAX=1 once Stripe Tax is set up
      ...(process.env.LAZYJO_STRIPE_TAX === '1' ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${origin}/lazyjo/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/lazyjo/?purchase=cancelled&single=${encodeURIComponent(single.id)}`,
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('LazyJo checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

app.get('/api/lazyjo/download', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Checkout is not configured yet' });
  const sessionId = String(req.query.session_id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid purchase reference' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.kind !== 'lazyjo-single') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment has not completed yet' });
    }
    const ageDays = (Date.now() / 1000 - session.created) / 86400;
    if (ageDays > LAZYJO_DOWNLOAD_DAYS) {
      return res.status(410).json({ error: 'This download link has expired — reply to your receipt email for a new one' });
    }
    const single = lazyjoSingle(session.metadata.singleId);
    if (!single) return res.status(404).json({ error: 'Single no longer available' });

    const base = { title: lazyjoTitle(single), email: session.customer_details?.email || null };
    if (!supabase || !single.masterPath) {
      return res.json({ ...base, status: 'pending' });
    }
    const ext = (single.masterPath.split('.').pop() || 'wav').toLowerCase();
    const { data, error } = await supabase.storage
      .from(LAZYJO_BUCKET)
      .createSignedUrl(single.masterPath, 600, {
        // "Lazy Jo - 06 No Rest-No Work.wav" (no slashes etc. in file names)
        download: `${LAZYJO_CATALOG.artist} - ${single.track ? String(single.track).padStart(2, '0') + ' ' : ''}${lazyjoTitle(single)}.${ext}`
          .replace(/[\\/:*?"<>|]+/g, '-'),
      });
    if (error || !data?.signedUrl) {
      console.error('LazyJo signed URL error:', error);
      return res.json({ ...base, status: 'pending' });
    }
    res.json({ ...base, status: 'ready', url: data.signedUrl });
  } catch (err) {
    console.error('LazyJo download error:', err);
    res.status(500).json({ error: 'Could not verify purchase' });
  }
});

// ─── LAZY JO fan list ("Stay in the loop") — our own EVEN replacement ───────────
// Sign-ups land in Supabase `lazyjo_fans` (supabase-lazyjo-fans.sql). Double
// opt-in: a confirmation email goes out, and only confirmed fans receive
// newsletters. Every email has a one-click unsubscribe. Emails are sent with
// Resend (RESEND_API_KEY + LAZYJO_EMAIL_FROM on a verified domain); without it,
// sign-ups are stored and wait for their confirmation email.
const LAZYJO_CONSENT_TEXT =
  'Yes, send me news from Lazy Jo: new music, drops and shows. I can unsubscribe anytime.';
const LAZYJO_EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
const LAZYJO_FAN_SOURCES = new Set(['universe', 'purchase', 'profile', 'card', 'gate']);
const lazyjoSignupHits = new Map(); // ip -> [timestamps] (best-effort; resets per instance)

// Links in emails must only ever point at our own site, so a spoofed Origin
// header can't turn a confirmation email into a phishing link.
const LAZYJO_LINK_ORIGINS = /^(https:\/\/(www\.)?lightningwolves\.studio|https:\/\/[a-z0-9-]+-lazyjos-projects\.vercel\.app|http:\/\/localhost:\d+)$/;
function lazyjoBaseUrl(req) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  const origin = String((req && req.headers.origin) || '');
  return LAZYJO_LINK_ORIGINS.test(origin) ? origin : 'https://lightningwolves.studio';
}
const lazyjoEsc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lazyjoEmailHtml({ heading, paragraphs, button, footerUrl }) {
  const ps = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#d6e4ff">${p}</p>`)
    .join('');
  const btn = button
    ? `<p style="margin:24px 0"><a href="${lazyjoEsc(button.url)}" style="display:inline-block;background:#0e7490;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:999px;border:1px solid #22d3ee">${lazyjoEsc(button.label)}</a></p>`
    : '';
  const foot = footerUrl
    ? `<p style="margin:28px 0 0;font-size:12px;color:#7d8bb0">You get this because you joined Lazy Jo's list. <a href="${lazyjoEsc(footerUrl)}" style="color:#7d8bb0">Unsubscribe</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#030712;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#030712"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#0a1124;border:1px solid #1d2a4d;border-radius:18px"><tr><td style="padding:32px 28px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#7b8cff">Lazy Jo's Universe</p>
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#ffffff">${lazyjoEsc(heading)}</h1>
${ps}${btn}${foot}
</td></tr></table></td></tr></table></body></html>`;
}

/** Send one or many emails through Resend. Returns { sent, error }. */
async function lazyjoSendEmails(messages) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LAZYJO_EMAIL_FROM;
  if (!key || !from) return { sent: 0, error: 'email-not-configured' };
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      ...(process.env.LAZYJO_EMAIL_REPLY_TO ? { reply_to: process.env.LAZYJO_EMAIL_REPLY_TO } : {}),
      ...(m.unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    }));
    const r = await fetch(chunk.length === 1 ? 'https://api.resend.com/emails' : 'https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('Resend error', r.status, text.slice(0, 300));
      return { sent, error: `email-provider-${r.status}` };
    }
    sent += chunk.length;
  }
  return { sent, error: null };
}

function lazyjoConfirmMessage(req, fan) {
  const base = lazyjoBaseUrl(req);
  const confirmUrl = `${base}/api/lazyjo/fans/confirm?t=${fan.token}`;
  return {
    to: fan.email,
    subject: 'Confirm: stay in the loop with Lazy Jo',
    html: lazyjoEmailHtml({
      heading: fan.name ? `One tap, ${fan.name}` : 'One tap and you’re in',
      paragraphs: [
        'Confirm your email to get Lazy Jo’s new music, drops and shows first.',
        'Didn’t sign up? Ignore this email and nothing happens.',
      ],
      button: { label: 'Confirm my email', url: confirmUrl },
    }),
  };
}

async function lazyjoRequireAdmin(req, res) {
  const user = await getUserFromToken(req);
  if (!user) { res.status(401).json({ error: 'unauthenticated' }); return null; }
  const profile = await getProfile(user.id);
  if (!profile || profile.role !== 'admin') { res.status(403).json({ error: 'admin only' }); return null; }
  return { user, profile };
}

// Public: join the list.
app.post('/api/lazyjo/fans', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Sign-ups aren’t set up yet' });
  try {
    const { name, email, consent, source, website } = req.body || {};
    if (website) return res.json({ status: 'ok' }); // honeypot: bots fill hidden fields
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    const hits = (lazyjoSignupHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (hits.length >= 8) return res.status(429).json({ error: 'Too many tries. Try again in a few minutes.' });
    lazyjoSignupHits.set(ip, [...hits, now]);

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim().slice(0, 80) || null;
    if (!LAZYJO_EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'That email doesn’t look right.' });
    if (consent !== true) return res.status(400).json({ error: 'Tick the box so we can email you.' });
    const src = LAZYJO_FAN_SOURCES.has(source) ? source : 'universe';

    const { data: existing, error: findErr } = await supabase
      .from('lazyjo_fans').select('*').eq('email', cleanEmail).maybeSingle(); // stored lowercase
    if (findErr) throw findErr;

    let fan = existing;
    if (!existing) {
      const { data, error } = await supabase.from('lazyjo_fans')
        .insert({ email: cleanEmail, name: cleanName, source: src, consent_text: LAZYJO_CONSENT_TEXT })
        .select('*').single();
      if (error) throw error;
      fan = data;
    } else if (existing.unsubscribed_at || !existing.confirmed_at) {
      // coming back: fresh consent, and confirm again
      const { data, error } = await supabase.from('lazyjo_fans')
        .update({ name: cleanName || existing.name, consent_text: LAZYJO_CONSENT_TEXT, consent_at: new Date().toISOString(), unsubscribed_at: null, confirmed_at: null })
        .eq('id', existing.id).select('*').single();
      if (error) throw error;
      fan = data;
    } else {
      // already confirmed: same answer as a new sign-up (doesn't reveal who's on the list)
      return res.json({ status: 'check-email' });
    }

    const { error: mailErr } = await lazyjoSendEmails([lazyjoConfirmMessage(req, fan)]);
    if (!mailErr) {
      await supabase.from('lazyjo_fans').update({ confirm_sent_at: new Date().toISOString() }).eq('id', fan.id);
      return res.json({ status: 'check-email' });
    }
    // stored; the confirmation goes out once email is configured (admin tab)
    return res.json({ status: 'saved' });
  } catch (err) {
    console.error('lazyjo fan signup error:', err);
    res.status(500).json({ error: 'Couldn’t sign you up. Try again in a minute.' });
  }
});

// Public: the confirmation link in the email.
app.get('/api/lazyjo/fans/confirm', async (req, res) => {
  const base = lazyjoBaseUrl(req);
  const t = String(req.query.t || '');
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(t)) return res.redirect(302, `${base}/lazyjo/?joined=invalid`);
  const { data } = await supabase.from('lazyjo_fans')
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq('token', t).select('id').maybeSingle();
  res.redirect(302, `${base}/lazyjo/?joined=${data ? '1' : 'invalid'}`);
});

// Public: unsubscribe (GET from the email link, POST from mail apps' one-click button).
async function lazyjoUnsubscribe(req, res) {
  const base = lazyjoBaseUrl(req);
  const t = String(req.query.t || '');
  if (supabase && /^[0-9a-f-]{36}$/i.test(t)) {
    await supabase.from('lazyjo_fans').update({ unsubscribed_at: new Date().toISOString() }).eq('token', t);
  }
  if (req.method === 'POST') return res.status(200).send('ok');
  res.redirect(302, `${base}/lazyjo/?unsubscribed=1`);
}
app.get('/api/lazyjo/fans/unsubscribe', lazyjoUnsubscribe);
app.post('/api/lazyjo/fans/unsubscribe', lazyjoUnsubscribe);

// Admin: the list + counts.
app.get('/api/lazyjo/admin/fans', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    if (!(await lazyjoRequireAdmin(req, res))) return;
    const { data: fans, error } = await supabase.from('lazyjo_fans')
      .select('id,email,name,source,consent_at,confirmed_at,confirm_sent_at,unsubscribed_at,created_at')
      .order('created_at', { ascending: false }).limit(5000);
    if (error) throw error;
    const { data: broadcasts } = await supabase.from('lazyjo_broadcasts')
      .select('id,subject,sent_count,created_at').order('created_at', { ascending: false }).limit(20);
    const counts = {
      total: fans.length,
      confirmed: fans.filter((f) => f.confirmed_at && !f.unsubscribed_at).length,
      pending: fans.filter((f) => !f.confirmed_at && !f.unsubscribed_at).length,
      unsubscribed: fans.filter((f) => f.unsubscribed_at).length,
    };
    res.json({ fans, counts, broadcasts: broadcasts || [], emailConfigured: !!(process.env.RESEND_API_KEY && process.env.LAZYJO_EMAIL_FROM) });
  } catch (err) {
    console.error('lazyjo admin fans error:', err);
    res.status(500).json({ error: err.message?.includes('lazyjo_fans') ? 'Run supabase-lazyjo-fans.sql in Supabase first' : 'Could not load fans' });
  }
});

// Admin: send the confirmation email to everyone still waiting for one.
app.post('/api/lazyjo/admin/fans/send-confirmations', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    if (!(await lazyjoRequireAdmin(req, res))) return;
    const { data: pending, error } = await supabase.from('lazyjo_fans')
      .select('*').is('confirmed_at', null).is('unsubscribed_at', null).is('confirm_sent_at', null).limit(1000);
    if (error) throw error;
    if (!pending.length) return res.json({ sent: 0 });
    const { sent, error: mailErr } = await lazyjoSendEmails(pending.map((f) => lazyjoConfirmMessage(req, f)));
    if (sent) {
      await supabase.from('lazyjo_fans').update({ confirm_sent_at: new Date().toISOString() })
        .in('id', pending.slice(0, sent).map((f) => f.id));
    }
    if (mailErr) return res.status(502).json({ error: mailErr === 'email-not-configured' ? 'Email isn’t set up yet (RESEND_API_KEY + LAZYJO_EMAIL_FROM)' : 'Email provider error', sent });
    res.json({ sent });
  } catch (err) {
    console.error('lazyjo confirmations error:', err);
    res.status(500).json({ error: 'Could not send confirmations' });
  }
});

// Admin: email every confirmed fan (or only yourself with test: true).
app.post('/api/lazyjo/admin/broadcast', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const admin = await lazyjoRequireAdmin(req, res);
    if (!admin) return;
    const subject = String(req.body?.subject || '').trim().slice(0, 140);
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    const test = req.body?.test === true;
    if (!subject || !message) return res.status(400).json({ error: 'Add a subject and a message' });
    const base = lazyjoBaseUrl(req);
    // plain text in, safe HTML out: paragraphs + clickable links
    const paragraphs = message.split(/\n{2,}/).map((p) =>
      lazyjoEsc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#22d3ee">$1</a>'));
    let recipients;
    if (test) {
      recipients = [{ email: admin.user.email, token: null }];
    } else {
      const { data, error } = await supabase.from('lazyjo_fans')
        .select('email,token').not('confirmed_at', 'is', null).is('unsubscribed_at', null).limit(5000);
      if (error) throw error;
      recipients = data;
    }
    if (!recipients.length) return res.status(400).json({ error: 'No confirmed fans yet' });
    const messages = recipients.map((r) => {
      const unsubscribeUrl = r.token ? `${base}/api/lazyjo/fans/unsubscribe?t=${r.token}` : `${base}/lazyjo/`;
      return { to: r.email, subject, unsubscribeUrl, html: lazyjoEmailHtml({ heading: subject, paragraphs, button: { label: 'Open Lazy Jo’s Universe', url: `${base}/lazyjo/` }, footerUrl: unsubscribeUrl }) };
    });
    const { sent, error: mailErr } = await lazyjoSendEmails(messages);
    if (!test && sent) {
      await supabase.from('lazyjo_broadcasts').insert({ subject, body: message, sent_count: sent, sent_by: admin.user.id });
    }
    if (mailErr) return res.status(502).json({ error: mailErr === 'email-not-configured' ? 'Email isn’t set up yet (RESEND_API_KEY + LAZYJO_EMAIL_FROM)' : 'Email provider error', sent });
    res.json({ sent, test });
  } catch (err) {
    console.error('lazyjo broadcast error:', err);
    res.status(500).json({ error: 'Could not send' });
  }
});

// Opens a Stripe billing portal session so paying users can manage
// their own subscription (cancel, change card, view invoices) — no
// support ticket needed. Requires an existing stripe_customer_id
// on the user's profile (set on first checkout.session.completed).
app.post('/api/create-portal-session', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const { token } = req.body;
    const user = await getUserFromToken({ headers: { authorization: token ? `Bearer ${token}` : '' } });
    if (!user) return res.status(401).json({ error: 'Sign in required' });

    const profile = await getProfile(user.id);
    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const origin =
      process.env.PUBLIC_APP_URL ||
      req.headers.origin ||
      req.headers.referer?.replace(/\/$/, '') ||
      'http://localhost:5173';

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: origin,
    });
    res.json({ url: portal.url });
  } catch (err) {
    console.error('Create portal session error:', err);
    res.status(500).json({ error: err.message || 'Portal failed' });
  }
});

// File upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// ─── Whisper Transcription ──────────────────────────────────────────────────
// Use memory storage for serverless (Vercel has read-only filesystem)
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/**
 * Transcription — Groq whisper-large-v3 (primary) with OpenAI whisper-1
 * fallback. Both return verbose_json with segment + word timestamps so the
 * client gets real per-word timing for karaoke. whisper-large-v3 handles
 * songs whisper-1 chokes on deterministically (heavy mixes, effects, accents).
 *
 * Two intake modes:
 *  - JSON `{ audioUrl, language }` — preferred. Client uploads the file directly
 *    to Supabase Storage, then sends us the public URL. This bypasses Vercel's
 *    4.5 MB request body limit (which silently breaks any song bigger than that
 *    on multipart upload).
 *  - multipart `file` — legacy path, only works for compressed clips < 4.5 MB.
 *
 * (Demucs vocal-isolation pre-step was attempted and rolled back — the
 * Replicate model identifiers couldn't be verified live. Comes back once we
 * confirm the right `owner/name:version` against Replicate's API.)
 */
app.post('/api/transcribe', memUpload.single('file'), async (req, res) => {
  try {
    if (!groq && !openai) {
      return res.status(500).json({
        error: 'No transcription provider configured. Set GROQ_API_KEY (preferred) or OPENAI_API_KEY in Vercel.',
      });
    }

    const langMap = { French: 'fr', Dutch: 'nl', Spanish: 'es', English: 'en' };
    const langCode = langMap[req.body.language] || 'en';

    // Resolve the audio source. Prefer the URL path (no Vercel body limit).
    let audioBuffer;
    let filename;
    let contentType;
    const audioUrl = typeof req.body.audioUrl === 'string' ? req.body.audioUrl : null;
    if (audioUrl) {
      try { new URL(audioUrl); } catch { return res.status(400).json({ error: 'Invalid audioUrl' }); }
      const fetched = await fetch(audioUrl);
      if (!fetched.ok) {
        return res.status(400).json({ error: `Could not fetch audio from URL (HTTP ${fetched.status})` });
      }
      audioBuffer = Buffer.from(await fetched.arrayBuffer());
      filename = audioUrl.split('/').pop()?.split('?')[0] || 'audio.mp3';
      contentType = fetched.headers.get('content-type') || 'audio/mpeg';
    } else if (req.file) {
      audioBuffer = req.file.buffer;
      filename = req.file.originalname || 'audio.mp3';
      contentType = req.file.mimetype || 'audio/mpeg';
    } else {
      return res.status(400).json({ error: 'No audio provided. Send JSON {audioUrl} or multipart file.' });
    }

    const buildFile = () => new File([audioBuffer], filename, { type: contentType });

    const tryProvider = async (client, model, label) => {
      const transcription = await client.audio.transcriptions.create({
        file: buildFile(),
        model,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
        language: langCode,
      });
      return { transcription, label };
    };

    let result;
    let groqError;
    if (groq) {
      try {
        result = await tryProvider(groq, 'whisper-large-v3', 'groq');
      } catch (err) {
        groqError = err;
        console.warn('[transcribe] Groq failed, falling back to OpenAI:', err?.error?.message || err?.message);
      }
    }
    if (!result) {
      if (!openai) throw groqError || new Error('Groq unavailable and no OpenAI fallback configured');
      result = await tryProvider(openai, 'whisper-1', 'openai');
    }

    const { transcription, label } = result;
    res.json({
      success: true,
      text: transcription.text || '',
      segments: transcription.segments || [],
      words: transcription.words || [],
      language: transcription.language || langCode,
      duration: transcription.duration,
      provider: label,
    });
  } catch (err) {
    console.error('[transcribe] error:', err);
    const detail = err?.error?.message || err?.message || 'Transcription failed';
    res.status(500).json({ error: detail });
  }
});

// ─── Vocal isolation (Demucs stem separation) ───────────────────────────────
// Heavily-produced songs bury the vocal under the mix, so whisper mishears the
// lyrics or returns nothing at all. We isolate the vocal stem FIRST, then
// transcribe that clean stem — the single biggest accuracy win for lyric
// burn-in. Demucs takes 30s–2min (past Vercel's 60s function cap), so this is
// async: create returns a Replicate prediction id, client polls the status route.
//
// Model: cjwbw/demucs. Input `audio` (URL), `stem:"vocals"` returns just the
// vocal + an accompaniment mix; output is an object keyed by stem name. The
// version is resolved live from Replicate so it can't silently go stale — the
// hardcoded hash is only a fallback if that lookup fails.
const DEMUCS_FALLBACK_VERSION =
  '25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953';
let demucsVersionCache = null;
async function resolveDemucsVersion() {
  if (demucsVersionCache) return demucsVersionCache;
  try {
    const model = await replicate.models.get('cjwbw', 'demucs');
    demucsVersionCache = model?.latest_version?.id || DEMUCS_FALLBACK_VERSION;
  } catch (err) {
    console.warn('[separate-vocals] version lookup failed, using fallback:', err?.message);
    demucsVersionCache = DEMUCS_FALLBACK_VERSION;
  }
  return demucsVersionCache;
}

app.post('/api/separate-vocals', async (req, res) => {
  try {
    if (!replicate) {
      return res.status(503).json({ error: 'Vocal isolation offline — REPLICATE_API_TOKEN not set.' });
    }
    const audioUrl = typeof req.body?.audioUrl === 'string' ? req.body.audioUrl : null;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });
    try { new URL(audioUrl); } catch { return res.status(400).json({ error: 'Invalid audioUrl' }); }

    const version = await resolveDemucsVersion();
    const prediction = await replicate.predictions.create({
      version,
      input: { audio: audioUrl, stem: 'vocals', model_name: 'htdemucs', output_format: 'mp3' },
    });
    res.json({ id: prediction.id, status: prediction.status });
  } catch (err) {
    console.error('[separate-vocals] create error:', err);
    res.status(500).json({ error: err?.message || 'Vocal isolation failed to start' });
  }
});

app.get('/api/separate-vocals/:id', async (req, res) => {
  try {
    if (!replicate) return res.status(503).json({ error: 'Replicate not configured' });
    const prediction = await replicate.predictions.get(req.params.id);
    // Output is an object { vocals, drums, bass, ... }; with stem="vocals" only
    // `vocals` and an accompaniment track are populated. Tolerate string / array
    // shapes too in case the model build changes its return type.
    const out = prediction.output;
    let vocalsUrl = null;
    if (out) {
      if (typeof out === 'string') vocalsUrl = out;
      else if (typeof out.vocals === 'string') vocalsUrl = out.vocals;
      else if (Array.isArray(out)) vocalsUrl = out.find((u) => typeof u === 'string' && /vocal/i.test(u)) || out[0] || null;
    }
    res.json({
      status: prediction.status,
      vocalsUrl: prediction.status === 'succeeded' ? vocalsUrl : null,
      error: prediction.error || null,
    });
  } catch (err) {
    console.error('[separate-vocals] status error:', err);
    res.status(500).json({ error: err?.message || 'Status check failed' });
  }
});

// ── Lyrics polish (Claude Fable 5) ───────────────────────────────────────────
// Whisper transcripts are scrappy: no punctuation, random casing, misheard
// words, zero structure. This endpoint corrects each word IN PLACE — the
// response has exactly as many words as the request, so the client can keep
// every original timestamp — and returns section markers ([VERSE]/[CHORUS])
// separately for the transcript view. Timings are never touched.
const POLISHED_LYRICS_SCHEMA = {
  type: 'object',
  properties: {
    words: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          label: { type: 'string' },
        },
        required: ['index', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['words', 'sections'],
  additionalProperties: false,
};

app.post('/api/polish-lyrics', async (req, res) => {
  try {
    const { words, language, title, artist, genre } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'words array required' });
    }
    if (words.length > 800) {
      return res.status(400).json({ error: 'too many words (max 800)' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const tokens = words.map((w) => String(w.word ?? '').trim());
    const numbered = tokens.map((t, i) => `${i}: ${t}`).join('\n');

    const systemPrompt = `You are a professional lyric transcription editor. You receive a raw word-per-line Whisper transcription of a song's vocal. Return the SAME number of words, corrected in place:
- Fix casing and add punctuation (attached to the word it follows).
- Fix obvious mishearings using the song's context — but stay conservative: when unsure, keep the original word.
- NEVER merge, split, drop, add, or reorder words. words[i] must be the corrected form of input word i. Same array length, always.
Also identify song sections. Return them as {index, label} where index is the word index the section starts at and label is like "[INTRO]", "[VERSE 1]", "[CHORUS]", "[BRIDGE]", "[OUTRO]". Only mark sections you are reasonably confident about; an empty array is fine.`;

    const userPrompt = `Song: "${title || 'Unknown'}" by ${artist || 'Unknown'}${genre ? ` (${genre})` : ''}. Language: ${language || 'unknown'}.
Raw Whisper words (index: word):
${numbered}`;

    const message = await anthropic.messages.create(
      {
        model: process.env.CLAUDE_MODEL || 'claude-fable-5',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: POLISHED_LYRICS_SCHEMA } },
        fallbacks: 'default',
      },
      { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } },
    );

    if (message.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'Polish declined — keeping the raw transcription.' });
    }

    const textBlock = message.content.find((b) => b.type === 'text');
    const out = JSON.parse(textBlock ? textBlock.text : '{}');

    // Hard safety gate: the whole design rests on 1:1 word mapping. If the
    // model merged/dropped anything, reject so the client keeps raw Whisper.
    if (!Array.isArray(out.words) || out.words.length !== tokens.length) {
      return res.status(422).json({ error: 'word count mismatch — raw transcription kept' });
    }
    const sections = (Array.isArray(out.sections) ? out.sections : [])
      .filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index <= tokens.length && typeof s.label === 'string')
      .sort((a, b) => a.index - b.index);

    res.json({ success: true, words: out.words.map((w) => String(w)), sections });
  } catch (err) {
    console.error('Polish-lyrics error:', err);
    res.status(500).json({ error: err.message || 'Polish failed' });
  }
});

// Main generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { title, artist, genre, bpm, language, mood, wolfId, token } = req.body;

    // Validate required fields
    if (!title || !artist || !genre || !language) {
      return res.status(400).json({ error: 'title, artist, genre, and language are required' });
    }

    // ── Auth / generation limit check ──────────────────────────────────────
    let user = null;
    let isMember = false;

    if (token) {
      user = await getUserFromToken({ headers: { authorization: `Bearer ${token}` } });
      if (user) {
        const profile = await getProfile(user.id);
        isMember = profile?.role === 'member';

        if (!isMember) {
          // Public user: check monthly limit (3 free)
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          const { count } = await supabase
            .from('generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth);

          if (count >= 3) {
            return res.status(403).json({ error: 'LIMIT_REACHED', message: 'Monthly generation limit reached. Join the Pack for unlimited access!' });
          }
        }
      }
    }

    // ── Check API key ──────────────────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured. Add it in Vercel Environment Variables or .env file.' });
    }

    // ── Build Claude prompt ────────────────────────────────────────────────
    // Fable 5 responds best to goals over prescriptions — output shape is
    // enforced by output_config.format below, so the prompt is pure craft.
    const systemPrompt = `You are Lightning Wolves Lyrics Studio — a professional AI music production assistant for independent artists. Write like a seasoned songwriter and creative director: lyrics with a real emotional arc and a hook that sticks, beat cuts a video editor would actually place, cinematic visual prompts an AI video model can execute, and social tips grounded in how this genre actually performs. Everything tailored precisely to the genre, language, and vibe provided.`;

    const userPrompt = buildUserPrompt({ title, artist, genre, bpm, language, mood });

    // ── Call Claude (Fable 5) ──────────────────────────────────────────────
    // - Thinking is always on for Fable — never send a `thinking` param.
    // - max_tokens caps thinking + response together, so 16K, not 4K.
    // - effort "low" keeps latency inside Vercel's 60s function cap while
    //   still beating the old claude-sonnet-4 output quality.
    // - fallbacks:"default" re-runs a rare safety decline on Opus in the
    //   same call instead of surfacing an error to the artist.
    const message = await anthropic.messages.create(
      {
        model: process.env.CLAUDE_MODEL || 'claude-fable-5',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: LYRICS_PACK_SCHEMA } },
        fallbacks: 'default',
      },
      { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } },
    );

    if (message.stop_reason === 'refusal') {
      // Whole fallback chain declined — extremely rare for lyrics content.
      return res.status(502).json({ error: 'The AI declined this request. Try rephrasing the title or mood.' });
    }

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock ? textBlock.text : '';

    // Robust JSON extraction — handle markdown fences, extra text, etc.
    let pack;
    try {
      // Try direct parse first
      pack = JSON.parse(raw.trim());
    } catch {
      try {
        // Strip markdown fences
        const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        pack = JSON.parse(stripped);
      } catch {
        try {
          // Find JSON object in the response (between first { and last })
          const firstBrace = raw.indexOf('{');
          const lastBrace = raw.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            pack = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
          } else {
            return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
          }
        } catch {
          return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
        }
      }
    }

    // ── Persist generation record ──────────────────────────────────────────
    if (user) {
      await supabase.from('generations').insert({
        user_id: user.id,
        title,
        artist,
        genre,
        language,
        wolf_id: wolfId || null,
      });

      // Track referral-originated generations
      const profile = await getProfile(user.id);
      if (profile?.referred_by) {
        await supabase.from('referral_stats').insert({
          referrer_id: profile.referred_by,
          referred_user_id: user.id,
          generation_title: title,
        }).onConflict('id').merge();
      }
    }

    res.json({ success: true, pack, meta: { title, artist, genre, language, wolfId } });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// (2026-11-15: the old /api/auth/signup is gone. It made accounts for any email with the service key, already marked
// as confirmed and without Supabase's sign-up limits - unlimited fake accounts. Nothing used it: the Studio and JAVEDA
// sign up through Supabase Auth in the browser.)

// Member dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await getProfile(user.id);
    if (profile?.role !== 'member') return res.status(403).json({ error: 'Members only' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Referral count this month
    const { count: referralCount } = await supabase
      .from('referral_stats')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .gte('created_at', startOfMonth);

    // Total generations by referred users
    const { count: referredGens } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by_member', user.id);

    // Own generations
    const { count: ownGens } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Earnings estimate (simple formula: members pool 40% split by referrals)
    const REVENUE_PER_GEN = 0.5; // $0.50 per generation estimate
    const totalRevenue = (referredGens || 0) * REVENUE_PER_GEN;
    const membersPoolShare = totalRevenue * 0.4;
    // Estimate based on referral weight (simplified)
    const earningsEstimate = referralCount > 0 ? (membersPoolShare / Math.max(referralCount, 1)).toFixed(2) : '0.00';

    res.json({
      profile,
      stats: {
        referralCount: referralCount || 0,
        referredGenerations: referredGens || 0,
        ownGenerations: ownGens || 0,
        earningsEstimate,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify promo code
app.post('/api/promo/verify', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('promo_code', code.toUpperCase())
    .single();

  if (!data) return res.status(404).json({ valid: false });
  res.json({ valid: true });
});

// ─── Wolf Vision: Visual Generation ──────────────────────────────────────────

// Registry of every "Wolf Vision" model exposed to the UI. Each entry carries:
//   - name/credits/status — what the client renders on pricing + picker
//   - kind — "image" | "video" (determines how the result is previewed)
//   - provider — "replicate" | "openai" | "disabled"
//   - replicateModel — owner/name or owner/name:version for `replicate.predictions.create`
//   - buildInput(prompt, opts) — maps our prompt+options to the model's input schema
//
// When a new model launches we add a line here — the endpoint doesn't change.
const VISION_MODELS = {
  'nanobanana-pro': {
    name: 'NanoBanana Pro',
    credits: 15,
    status: 'access',
    kind: 'image',
    provider: 'replicate',
    replicateModel: 'google/nano-banana',
    buildInput: (prompt) => ({ prompt, output_format: 'png' }),
  },
  'nanobanana-2': {
    // Public-facing "new" badge on pricing — same Google Gemini image model
    // as Pro but with lighter params so it's the cheaper daily driver.
    name: 'NanoBanana 2',
    credits: 10,
    status: 'new',
    kind: 'image',
    provider: 'replicate',
    replicateModel: 'google/nano-banana',
    buildInput: (prompt) => ({ prompt, output_format: 'jpg' }),
  },
  'grok-imagine': {
    // xAI Grok Imagine has no public Replicate build yet. We fall back to a
    // premium image model so the tier promise still delivers; when Grok opens
    // up, swap this block to provider: 'xai' with the direct endpoint.
    name: 'Grok Imagine',
    credits: 15,
    status: 'access',
    kind: 'image',
    provider: 'replicate',
    replicateModel: 'black-forest-labs/flux-1.1-pro',
    buildInput: (prompt) => ({ prompt, aspect_ratio: '16:9', output_format: 'jpg' }),
  },
  'sora-2': {
    // Sora 2 runs through OpenAI directly (not on Replicate). Requires the
    // calling account to have Sora API access — OpenAI returns a clear error
    // if you don't, which bubbles up to the user as "MODEL_UNAVAILABLE".
    name: 'Sora 2',
    credits: 20,
    status: 'legacy',
    kind: 'video',
    provider: 'openai',
    openaiModel: 'sora-2',
    buildInput: (prompt, opts = {}) => {
      // Compute `size` from the UI's resolution (480p|720p) + aspectRatio (9:16|16:9).
      // Falls back to 1280x720 landscape if anything's missing.
      const portrait = opts.aspectRatio === '9:16';
      const base = opts.resolution === '720p' ? [1280, 720] : [854, 480];
      const [w, h] = portrait ? [base[1], base[0]] : base;
      return {
        prompt,
        seconds: String(opts.duration || 4),
        size: opts.size || `${w}x${h}`,
      };
    },
  },
  'kling-3': {
    name: 'Kling 3.0',
    credits: 20,
    status: 'coming-soon',
    kind: 'video',
    provider: 'disabled',
  },
  'kling-motion': {
    name: 'Kling Motion Control',
    credits: 15,
    status: 'access',
    kind: 'video',
    provider: 'replicate',
    // v1.6-standard supports text-to-video (no start_image required).
    // v2.0+ are image-to-video only — would need a separate frame-gen step.
    replicateModel: 'kwaivgi/kling-v1.6-standard',
    buildInput: (prompt, opts = {}) => {
      // Kling only accepts duration ∈ {5, 10}. Round each section to the
      // closer legal value so the API doesn't 422.
      const requested = Number(opts.duration) || 5;
      const duration = requested >= 7.5 ? 10 : 5;
      // Same for aspect_ratio — must be 16:9, 9:16, or 1:1.
      const allowedRatios = ['16:9', '9:16', '1:1'];
      const aspect_ratio = allowedRatios.includes(opts.aspectRatio)
        ? opts.aspectRatio
        : '16:9';
      return {
        prompt,
        duration,
        aspect_ratio,
        negative_prompt: opts.negativePrompt || '',
      };
    },
  },
  'seedream-4.5': {
    name: 'Seedream 4.5',
    credits: 12,
    status: 'access',
    kind: 'image',
    provider: 'replicate',
    replicateModel: 'bytedance/seedream-4',
    buildInput: (prompt) => ({ prompt, aspect_ratio: '16:9' }),
  },
  'seedance-2': {
    name: 'Seedance 2.0',
    credits: 18,
    status: 'coming-soon',
    kind: 'video',
    provider: 'disabled',
  },
};

// Get available models — strip backend-only fields before sending to client
app.get('/api/models', (req, res) => {
  const models = Object.entries(VISION_MODELS).map(([id, m]) => ({
    id,
    name: m.name,
    credits: m.credits,
    status: m.status,
    kind: m.kind,
  }));
  res.json({ models });
});

// Get user credits + plan tier
app.get('/api/credits', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.json({ credits: 100, tier: 'free', isGuest: true });

    const profile = await getProfile(user.id);
    res.json({
      credits: profile?.wolf_credits ?? 100,
      tier: profile?.tier || 'free',
      isGuest: false,
      displayName: profile?.display_name || profile?.email,
      role: profile?.role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kick off a visual generation. Returns immediately with a predictionId —
// the client polls /api/visuals/:id for progress. Video models take 1–3 min
// which blows Vercel's function timeout, so we must go async.
app.post('/api/generate-visuals', async (req, res) => {
  try {
    const { modelId, prompt, type, options, token } = req.body;

    if (!modelId || !prompt) {
      return res.status(400).json({ error: 'modelId and prompt are required' });
    }

    const model = VISION_MODELS[modelId];
    if (!model) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }
    if (model.status === 'coming-soon' || model.provider === 'disabled') {
      return res.status(400).json({
        error: 'MODEL_UNAVAILABLE',
        message: `${model.name} is not available yet.`,
      });
    }
    if (model.provider === 'replicate' && !replicate) {
      return res.status(503).json({
        error: 'REPLICATE_NOT_CONFIGURED',
        message: 'Video generation is offline — REPLICATE_API_TOKEN not set.',
      });
    }
    if (model.provider === 'openai' && !openai) {
      return res.status(503).json({
        error: 'OPENAI_NOT_CONFIGURED',
        message: `${model.name} is offline — OPENAI_API_KEY not set.`,
      });
    }

    // ── Auth + credit check ──────────────────────────────────────────────
    // Authed users: check Supabase credits, deduct on success.
    // Guests (Lone Wolf path): proceed without auth — matches the pattern of
    // /api/generate which also allows guest calls. Client-side localStorage
    // enforces the "3 free generations" cap in ScenesView. Cost exposure is
    // intentional for try-before-buy onboarding.
    let user = null;
    let credits = 0;
    if (token) {
      user = await getUserFromToken({ headers: { authorization: `Bearer ${token}` } });
      if (user) {
        const profile = await getProfile(user.id);
        credits = profile?.wolf_credits ?? 0;
      }
    }

    if (user && credits < model.credits) {
      return res.status(403).json({
        error: 'INSUFFICIENT_CREDITS',
        message: `Not enough credits. Need ${model.credits}, have ${credits}.`,
        needed: model.credits,
        current: credits,
      });
    }

    // ── Fire the prediction (router: replicate vs openai) ────────────────
    // We normalise the upstream response into a { id, status } shape so
    // the persist/poll code below doesn't have to know which provider ran.
    let prediction;
    try {
      if (model.provider === 'replicate') {
        const rep = await replicate.predictions.create({
          model: model.replicateModel,
          input: model.buildInput(prompt, options || {}),
        });
        prediction = { id: `rep_${rep.id}`, status: rep.status };
      } else if (model.provider === 'openai') {
        // OpenAI's video API (Sora 2). Create kicks off an async job whose
        // id we prefix so the status endpoint can route back to OpenAI.
        const job = await openai.videos.create(model.buildInput(prompt, options || {}));
        prediction = { id: `oa_${job.id}`, status: job.status || 'starting' };
      } else {
        return res.status(500).json({
          error: 'PROVIDER_NOT_IMPLEMENTED',
          message: `${model.name} provider wiring is missing.`,
        });
      }
    } catch (err) {
      console.error('Upstream create failed:', err);
      return res.status(502).json({
        error: 'UPSTREAM_FAILED',
        message: err.message || 'Model provider rejected the request.',
      });
    }

    // Deduct credits only after the prediction is accepted upstream. If the
    // prediction fails later, we'll refund inside the status endpoint.
    // Guests (no user) skip deduction + logging — they're anonymous.
    if (user) {
      await supabase
        .from('profiles')
        .update({ wolf_credits: credits - model.credits })
        .eq('id', user.id);

      await supabase.from('visual_generations').insert({
        user_id: user.id,
        prediction_id: prediction.id,
        model_id: modelId,
        prompt,
        type: type || 'scene',
        credits_used: model.credits,
        status: prediction.status,
      });
    }

    res.json({
      success: true,
      generation: {
        id: prediction.id,
        model: model.name,
        modelId,
        kind: model.kind,
        prompt,
        type: type || 'scene',
        creditsUsed: user ? model.credits : 0,
        remainingCredits: user ? credits - model.credits : null,
        status: prediction.status,
      },
    });
  } catch (err) {
    console.error('Generate visuals error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Poll a prediction's status + output. Called by the client every few
// seconds after /api/generate-visuals returns a prediction id.
// The id carries a provider prefix (rep_ or oa_) so we route to the
// right backend without a db lookup on the hot path.
app.get('/api/visuals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });

    let prediction;
    if (id.startsWith('rep_')) {
      if (!replicate) return res.status(503).json({ error: 'Replicate not configured' });
      const rep = await replicate.predictions.get(id.slice(4));
      prediction = { status: rep.status, output: rep.output, error: rep.error, logs: rep.logs };
    } else if (id.startsWith('oa_')) {
      if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });
      const job = await openai.videos.retrieve(id.slice(3));
      // Map OpenAI's statuses ("queued" | "in_progress" | "completed" | "failed")
      // to our Replicate-style vocabulary so the client has one shape.
      const statusMap = {
        queued:      'starting',
        in_progress: 'processing',
        completed:   'succeeded',
        failed:      'failed',
      };
      prediction = {
        status: statusMap[job.status] || job.status,
        output: job.status === 'completed' ? [`/api/visuals/${id}/download`] : null,
        error: job.error?.message || null,
      };
    } else {
      return res.status(400).json({ error: 'Unknown prediction id format' });
    }

    // Normalise the output — Replicate returns either a string URL or an
    // array of URLs depending on the model. We always give the client an
    // array of strings so it can render a gallery or just take [0].
    let output = null;
    if (prediction.output) {
      output = Array.isArray(prediction.output)
        ? prediction.output.filter(Boolean).map(String)
        : [String(prediction.output)];
    }

    // If the prediction hard-failed or got canceled, refund the credits
    // back to the user so they're not burned for nothing.
    if ((prediction.status === 'failed' || prediction.status === 'canceled') && supabase) {
      const { data: record } = await supabase
        .from('visual_generations')
        .select('id, user_id, credits_used, status')
        .eq('prediction_id', id)
        .single();
      if (record && record.status !== 'failed' && record.status !== 'canceled') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wolf_credits')
          .eq('id', record.user_id)
          .single();
        if (profile) {
          await supabase
            .from('profiles')
            .update({ wolf_credits: (profile.wolf_credits || 0) + record.credits_used })
            .eq('id', record.user_id);
        }
        await supabase
          .from('visual_generations')
          .update({ status: prediction.status })
          .eq('prediction_id', id);
      }
    } else if (prediction.status === 'succeeded' && supabase) {
      // Store the final URL so we don't have to re-fetch from Replicate later.
      await supabase
        .from('visual_generations')
        .update({
          status: 'succeeded',
          output_url: output?.[0] || null,
        })
        .eq('prediction_id', id);
    }

    res.json({
      id,
      status: prediction.status,
      output,
      error: prediction.error || null,
      logs: prediction.logs || null,
    });
  } catch (err) {
    console.error('Visual status error:', err);
    res.status(500).json({ error: err.message || 'Status check failed' });
  }
});

// OpenAI video download proxy. Sora delivers binaries via the SDK rather
// than a public URL, so we stream them through the server. The status
// endpoint hands the client this URL as the "output" for oa_-prefixed ids.
app.get('/api/visuals/:id/download', async (req, res) => {
  try {
    if (!openai) return res.status(503).send('OpenAI not configured');
    const { id } = req.params;
    if (!id.startsWith('oa_')) return res.status(400).send('Invalid id');
    const videoId = id.slice(3);
    const content = await openai.videos.downloadContent(videoId);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // The SDK returns a web-standard Response or stream — handle both.
    if (content?.body?.pipe) {
      content.body.pipe(res);
    } else if (content?.arrayBuffer) {
      const buf = Buffer.from(await content.arrayBuffer());
      res.send(buf);
    } else {
      res.status(500).send('Unexpected download shape');
    }
  } catch (err) {
    console.error('Visual download error:', err);
    res.status(500).send(err.message || 'Download failed');
  }
});

// ─── Pack Awards (monthly Lightning rewards) ─────────────────────────────────
// Idempotent: re-running for the same period is a no-op (UNIQUE constraint
// on pack_awards). Awards 4 categories per the agreed scheme:
//   hottest      — 200 credits to the wolf with most ⚡⚡ received that month
//   top_track    — 100 credits to the author of the single highest-bolt track
//   generosity   —  75 credits to the wolf who gave the most ⚡⚡ to others
//   streak       —  50 credits to the longest active-streak wolf (≥7 days, ≥3 tracks)
// Sock-puppet defense: ⚡⚡ from accounts < 7 days old don't count toward
// "received" or "top_track". Self-bolts excluded from "given".
const AWARD_CONFIG = {
  hottest:    { credits: 200, label: '🌟 Pack Hottest' },
  top_track:  { credits: 100, label: '🥇 Top Lightning Track' },
  generosity: { credits: 75,  label: '⚡ Pack Generosity' },
  streak:     { credits: 50,  label: '🔥 Streak Champion' },
};

function previousMonthRange(refDate = new Date()) {
  // First day of the previous month, in UTC.
  const start = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 1, 1));
  // First day of this month.
  const end = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
  return { start, end };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function loadProfile(supabase, id) {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, wolf_id')
    .eq('id', id)
    .maybeSingle();
  return data || null;
}

async function computeAwards(supabase, periodStart, periodEnd) {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  // Reactor must have signed up at least 7 days before periodEnd to count.
  const reactorAgeCutoff = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Pull all ⚡⚡ reactions inside the period, joined to their messages.
  const { data: rxRows } = await supabase
    .from('hub_reactions')
    .select(`
      user_id,
      message_id,
      created_at,
      hub_messages!inner(id, author_id, song_url, audio_url, room_id, deleted_at, created_at)
    `)
    .eq('emoji', '⚡⚡')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .limit(20000);

  // 2) Pull profile created_at for every distinct reactor so we can apply
  //    the 7-day age cutoff.
  const reactorIds = Array.from(new Set((rxRows || []).map((r) => r.user_id)));
  let reactorAges = new Map();
  if (reactorIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, created_at')
      .in('id', reactorIds);
    (profs || []).forEach((p) => reactorAges.set(p.id, p.created_at));
  }

  const isQualifiedReactor = (userId) => {
    const created = reactorAges.get(userId);
    if (!created) return false;
    return created < reactorAgeCutoff;
  };

  // 3) Tally received + top track + generosity.
  const receivedByAuthor = new Map();   // author_id -> count
  const boltsByMessage = new Map();     // message_id -> { count, author_id, song_url, audio_url }
  const givenByReactor = new Map();     // user_id -> count (excluding self-bolts)

  (rxRows || []).forEach((r) => {
    const m = Array.isArray(r.hub_messages) ? r.hub_messages[0] : r.hub_messages;
    if (!m || m.deleted_at) return;
    const isSong = !!m.song_url;
    const isBeat = !!m.audio_url && m.room_id === 'beats';
    if (!isSong && !isBeat) return;
    if (!isQualifiedReactor(r.user_id)) return;
    // received + top track (excluding self)
    if (r.user_id !== m.author_id) {
      receivedByAuthor.set(m.author_id, (receivedByAuthor.get(m.author_id) || 0) + 1);
      const cur = boltsByMessage.get(m.id) || { count: 0, author_id: m.author_id, song_url: m.song_url, audio_url: m.audio_url };
      cur.count += 1;
      boltsByMessage.set(m.id, cur);
    }
    // generosity (also excluding self)
    if (r.user_id !== m.author_id) {
      givenByReactor.set(r.user_id, (givenByReactor.get(r.user_id) || 0) + 1);
    }
  });

  function pickTop(map) {
    let topId = null;
    let topVal = 0;
    for (const [id, val] of map.entries()) {
      if (val > topVal) {
        topVal = val;
        topId = id;
      }
    }
    return topId ? { id: topId, value: topVal } : null;
  }

  const hottest = pickTop(receivedByAuthor);
  const generosity = pickTop(givenByReactor);

  // top track
  let topTrack = null;
  for (const [msgId, info] of boltsByMessage.entries()) {
    if (!topTrack || info.count > topTrack.count) {
      topTrack = { messageId: msgId, ...info };
    }
  }

  // 4) Streak champion — longest streak of consecutive days with at least
  //    one song_url post in the period, gated on >=3 tracks shared.
  const { data: songMsgs } = await supabase
    .from('hub_messages')
    .select('author_id, created_at')
    .not('song_url', 'is', null)
    .is('deleted_at', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .limit(20000);

  const datesByAuthor = new Map(); // author -> Set of yyyy-mm-dd
  (songMsgs || []).forEach((m) => {
    const day = new Date(m.created_at).toISOString().slice(0, 10);
    let set = datesByAuthor.get(m.author_id);
    if (!set) {
      set = new Set();
      datesByAuthor.set(m.author_id, set);
    }
    set.add(day);
  });
  let streak = null;
  for (const [authorId, days] of datesByAuthor.entries()) {
    if (days.size < 3) continue;
    const sorted = Array.from(days).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const next = new Date(sorted[i]);
      const diff = Math.round((next.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
      if (diff === 1) { cur += 1; best = Math.max(best, cur); } else { cur = 1; }
    }
    if (best >= 7 && (!streak || best > streak.value)) {
      streak = { id: authorId, value: best };
    }
  }

  // 5) Build award rows. Each is null if no winner.
  const winners = [];
  if (hottest) winners.push({ award_type: 'hottest', recipient_id: hottest.id, metric: hottest.value });
  if (topTrack) winners.push({ award_type: 'top_track', recipient_id: topTrack.author_id, metric: topTrack.count, message_id: topTrack.messageId });
  if (generosity) winners.push({ award_type: 'generosity', recipient_id: generosity.id, metric: generosity.value });
  if (streak) winners.push({ award_type: 'streak', recipient_id: streak.id, metric: streak.value });
  return winners;
}

app.post('/api/award-pack', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const refDate = req.query.month
      ? new Date(`${req.query.month}-15T00:00:00Z`) // 15th of any day in target month
      : new Date();
    const { start, end } = previousMonthRange(refDate);
    const periodStart = isoDate(start);
    const periodEnd = isoDate(new Date(end.getTime() - 24 * 60 * 60 * 1000)); // last day of period

    // Idempotency: if any award row exists for this periodStart, return existing.
    const { data: existing } = await supabase
      .from('pack_awards')
      .select('*')
      .eq('period_start', periodStart);
    if (existing && existing.length > 0) {
      return res.json({ period_start: periodStart, awards: existing, alreadyGranted: true });
    }

    const winners = await computeAwards(supabase, start, end);
    const granted = [];
    for (const w of winners) {
      const cfg = AWARD_CONFIG[w.award_type];
      const profile = await loadProfile(supabase, w.recipient_id);
      // Insert award row
      const { data: row, error: insErr } = await supabase
        .from('pack_awards')
        .insert({
          recipient_id: w.recipient_id,
          award_type: w.award_type,
          period_start: periodStart,
          period_end: periodEnd,
          credits_granted: cfg.credits,
          metric: w.metric,
          message_id: w.message_id || null,
          recipient_name: profile?.display_name || null,
          recipient_wolf_id: profile?.wolf_id || null,
        })
        .select()
        .single();
      if (insErr) {
        // 23505 = unique violation — another caller raced ahead. Skip.
        if (insErr.code === '23505') continue;
        throw insErr;
      }
      // Bump wolf_credits on the recipient
      const { data: prof } = await supabase
        .from('profiles')
        .select('wolf_credits')
        .eq('id', w.recipient_id)
        .maybeSingle();
      const newCredits = (prof?.wolf_credits || 0) + cfg.credits;
      await supabase
        .from('profiles')
        .update({ wolf_credits: newCredits })
        .eq('id', w.recipient_id);
      granted.push(row);
    }

    res.json({ period_start: periodStart, awards: granted, alreadyGranted: false });
  } catch (err) {
    console.error('Award pack error:', err);
    res.status(500).json({ error: err.message || 'Award failed' });
  }
});

app.get('/api/pack-awards', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { data, error } = await supabase
      .from('pack_awards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(req.query.limit ? Math.min(50, parseInt(req.query.limit, 10)) : 12);
    if (error) throw error;
    res.json({ awards: data || [] });
  } catch (err) {
    console.error('Pack awards list error:', err);
    res.status(500).json({ error: err.message || 'List failed' });
  }
});

// ─── Stripe MRR (admin-only) ─────────────────────────────────────────────────
// Pulls real recurring revenue from Stripe Billing — sums every active
// subscription's price * quantity normalized to a monthly cadence
// (yearly intervals divided by 12, weekly multiplied by ~4.33). Cached
// in-memory for 5 min so the admin dashboard doesn't hammer the API
// every page load. Returns mocked: true with no MRR when STRIPE_SECRET_KEY
// is missing — UI falls back to the tier-count estimate in that case.
const MRR_CACHE_MS = 5 * 60 * 1000;
let mrrCache = null;

function intervalToMonthlyMultiplier(interval, count) {
  const c = count || 1;
  if (interval === 'month') return 1 / c;
  if (interval === 'year')  return 1 / (12 * c);
  if (interval === 'week')  return 4.33 / c;
  if (interval === 'day')   return 30 / c;
  return 1; // unknown — treat as monthly
}

app.get('/api/admin/mrr', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'admin only' });
    }

    if (!stripe) {
      return res.json({
        mocked: true,
        mrrCents: 0,
        currency: 'eur',
        activeSubscriptions: 0,
        generatedAt: new Date().toISOString(),
        note: 'Stripe not configured — UI shows tier-count estimate.',
      });
    }

    const force = req.query.refresh === '1';
    if (!force && mrrCache && Date.now() - mrrCache.cachedAt < MRR_CACHE_MS) {
      return res.json(mrrCache.payload);
    }

    let mrrCents = 0;
    let activeSubscriptions = 0;
    let currency = 'eur';
    let cursor = null;
    // Page through Stripe — 100/page cap, will rarely take more than a
    // single round-trip until subs grow past 100 active. Cancelled +
    // unpaid subs are excluded by status='active'.
    for (let i = 0; i < 20; i++) {
      const list = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        starting_after: cursor || undefined,
        expand: ['data.items.data.price'],
      });
      for (const sub of list.data) {
        activeSubscriptions += 1;
        for (const item of sub.items.data) {
          const price = item.price;
          if (!price?.recurring) continue;
          const monthly =
            (price.unit_amount || 0) *
            (item.quantity || 1) *
            intervalToMonthlyMultiplier(price.recurring.interval, price.recurring.interval_count);
          mrrCents += monthly;
          if (price.currency) currency = price.currency;
        }
      }
      if (!list.has_more) break;
      cursor = list.data[list.data.length - 1]?.id;
    }

    const payload = {
      mocked: false,
      mrrCents: Math.round(mrrCents),
      currency,
      activeSubscriptions,
      generatedAt: new Date().toISOString(),
    };
    mrrCache = { cachedAt: Date.now(), payload };
    res.json(payload);
  } catch (err) {
    console.error('MRR fetch error:', err);
    res.status(500).json({ error: err.message || 'MRR fetch failed' });
  }
});

// ─── Cover Art history (per-user gallery) ────────────────────────────────────
// Signed-in wolves' generations sync across devices via this table.
// Lone Wolves keep their gallery in localStorage on the client.
app.get('/api/cover-art/history', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const { data, error } = await supabase
      .from('cover_art_history')
      .select('id, image_url, prompt, model_id, aspect, resolution, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(48);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err) {
    console.error('Cover art history list error:', err);
    res.status(500).json({ error: err.message || 'list failed' });
  }
});

// Replicate output URLs expire after ~1 hour, which left signed-in
// wolves staring at broken thumbnails after a relog. We mirror every
// inbound URL into our own `wolf-hub-media` bucket so the gallery is
// permanent until the user manually deletes an entry.
async function rehostCoverArtToStorage(srcUrl, userId) {
  const resp = await fetch(srcUrl);
  if (!resp.ok) throw new Error(`fetch ${resp.status}`);
  const contentType = resp.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await resp.arrayBuffer());
  const extFromCT = (contentType.split('/')[1] || 'png').toLowerCase();
  const ext = extFromCT.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `cover-art/${userId}/${Date.now()}-${rand}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('wolf-hub-media')
    .upload(path, buf, { contentType, upsert: false });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from('wolf-hub-media').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('no public url');
  return urlData.publicUrl;
}

app.post('/api/cover-art/history', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const { imageUrl, prompt, modelId, aspect, resolution } = req.body || {};
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl required' });
    }

    // Rehost any URL we don't already own. If the URL is already on our
    // bucket (legacy backfill or retry path) skip the round-trip.
    let storedUrl = imageUrl;
    const alreadyOurs = imageUrl.includes('/wolf-hub-media/');
    if (!alreadyOurs) {
      try {
        storedUrl = await rehostCoverArtToStorage(imageUrl, user.id);
      } catch (rehostErr) {
        console.warn('[cover-art] rehost failed, falling back to source URL:', rehostErr.message || rehostErr);
        // Save the original URL anyway — the user still sees it for ~1h
        // and we'd rather log + degrade than fail the save outright.
      }
    }

    const { data, error } = await supabase
      .from('cover_art_history')
      .insert({
        user_id: user.id,
        image_url: storedUrl,
        prompt: prompt || null,
        model_id: modelId || null,
        aspect: aspect || null,
        resolution: resolution || null,
      })
      .select('id, image_url, prompt, model_id, aspect, resolution, created_at')
      .single();
    if (error) throw error;
    res.json({ item: data });
  } catch (err) {
    console.error('Cover art history save error:', err);
    res.status(500).json({ error: err.message || 'save failed' });
  }
});

app.delete('/api/cover-art/history/:id', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const id = req.params.id;
    if (id === 'all') {
      const { error } = await supabase
        .from('cover_art_history')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cover_art_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Cover art history delete error:', err);
    res.status(500).json({ error: err.message || 'delete failed' });
  }
});

// ─── Social stats (YouTube subscriber counts on profile pills) ──────────────
// Pulls live subscriber counts from the YouTube Data API for any wolf whose
// `youtube_url` is set. Cached in-memory per channel for 1h so we don't blow
// through the daily quota on every profile open. Returns `{ youtubeSubs:
// null }` (rather than 4xx) when the key is missing or the URL doesn't
// resolve — the UI just hides the count badge gracefully in that case.
const SOCIAL_CACHE_MS = 60 * 60 * 1000;
const socialCache = new Map(); // key: cacheKey → { value, cachedAt }

// Map a YouTube URL Joeri's wolves paste into something the Data API can
// resolve. Supports the four common shapes:
//   • https://youtube.com/@handle  → forHandle=@handle
//   • https://youtube.com/channel/UCxxx → id=UCxxx
//   • https://youtube.com/c/Name → forUsername=Name (legacy)
//   • https://youtube.com/user/Name → forUsername=Name (legacy)
// Returns { param, value } the Data API accepts, or null if unparseable.
function parseYouTubeQuery(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (!/youtube\.com$|youtu\.be$/.test(u.hostname.replace(/^www\./, ''))) return null;
  const pathParts = u.pathname.split('/').filter(Boolean);
  // /@handle
  if (pathParts[0]?.startsWith('@')) {
    return { param: 'forHandle', value: pathParts[0] };
  }
  // /channel/UCxxx
  if (pathParts[0] === 'channel' && pathParts[1]?.startsWith('UC')) {
    return { param: 'id', value: pathParts[1] };
  }
  // /c/Name or /user/Name
  if ((pathParts[0] === 'c' || pathParts[0] === 'user') && pathParts[1]) {
    return { param: 'forUsername', value: pathParts[1] };
  }
  return null;
}

async function fetchYouTubeSubs(rawUrl) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { count: null, reason: 'no_key' };
  const q = parseYouTubeQuery(rawUrl);
  if (!q) return { count: null, reason: 'unparseable_url' };

  const params = new URLSearchParams({
    part: 'statistics',
    [q.param]: q.value,
    key,
  });
  const apiUrl = `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
  const resp = await fetch(apiUrl);
  if (!resp.ok) return { count: null, reason: `http_${resp.status}` };
  const data = await resp.json();
  const channel = data.items?.[0];
  if (!channel) return { count: null, reason: 'no_channel' };
  // hiddenSubscriberCount means the channel has chosen to hide the count
  // (we still want to surface that gracefully rather than show a stale 0).
  if (channel.statistics?.hiddenSubscriberCount) {
    return { count: null, reason: 'hidden' };
  }
  const raw = channel.statistics?.subscriberCount;
  const num = typeof raw === 'string' ? Number(raw) : null;
  return { count: Number.isFinite(num) ? num : null, reason: 'ok' };
}

app.get('/api/social-stats', async (req, res) => {
  try {
    const youtubeUrl = typeof req.query.youtube === 'string' ? req.query.youtube : null;
    const force = req.query.refresh === '1';
    const out = { youtubeSubs: null, youtubeReason: null, cachedAt: null };

    if (youtubeUrl) {
      const cacheKey = `yt:${youtubeUrl}`;
      const cached = socialCache.get(cacheKey);
      if (!force && cached && Date.now() - cached.cachedAt < SOCIAL_CACHE_MS) {
        out.youtubeSubs = cached.value.count;
        out.youtubeReason = cached.value.reason;
        out.cachedAt = new Date(cached.cachedAt).toISOString();
      } else {
        const fresh = await fetchYouTubeSubs(youtubeUrl);
        socialCache.set(cacheKey, { value: fresh, cachedAt: Date.now() });
        out.youtubeSubs = fresh.count;
        out.youtubeReason = fresh.reason;
        out.cachedAt = new Date().toISOString();
      }
    }

    res.json(out);
  } catch (err) {
    console.error('Social stats error:', err);
    // Never 500 the UI for this — degrade to null counts.
    res.json({ youtubeSubs: null, youtubeReason: 'error', cachedAt: null });
  }
});

// ─── Credit requests (out-of-credits → ask the admin) ───────────────────────
// Wolves who hit INSUFFICIENT_CREDITS on /api/generate-visuals can file a
// request from the error UI. Admins approve from the Members page; the
// approval bumps profiles.wolf_credits and stamps the row as 'granted'
// in the same atomic admin step.
app.post('/api/credit-requests', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const { message, neededCredits, modelId } = req.body || {};

    // Avoid duplicate noise — if the wolf already has a pending request,
    // surface it instead of creating a second row.
    const { data: existing } = await supabase
      .from('credit_requests')
      .select('id, message, needed_credits, model_id, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return res.json({ item: existing, alreadyPending: true });

    const { data, error } = await supabase
      .from('credit_requests')
      .insert({
        user_id: user.id,
        message: typeof message === 'string' ? message.slice(0, 500) : null,
        needed_credits: Number.isInteger(neededCredits) ? neededCredits : null,
        model_id: typeof modelId === 'string' ? modelId.slice(0, 64) : null,
      })
      .select('id, message, needed_credits, model_id, status, created_at')
      .single();
    if (error) throw error;
    res.json({ item: data, alreadyPending: false });
  } catch (err) {
    console.error('Credit request create error:', err);
    res.status(500).json({ error: err.message || 'request failed' });
  }
});

app.get('/api/credit-requests', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'admin only' });
    }
    const status = req.query.status === 'all' ? null : (req.query.status || 'pending');
    let q = supabase
      .from('credit_requests')
      .select(`
        id, message, needed_credits, model_id, status, granted_amount,
        granted_by, granted_at, created_at,
        user:profiles!credit_requests_user_id_fkey (id, display_name, email, wolf_id, wolf_credits)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err) {
    console.error('Credit request list error:', err);
    res.status(500).json({ error: err.message || 'list failed' });
  }
});

// Admin grant: bumps profiles.wolf_credits by `amount` and stamps the
// request as 'granted'. Both writes go through the service-role
// supabase client so the wolf_credits update doesn't depend on the
// admin's own RLS context.
app.post('/api/credit-requests/:id/grant', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'admin only' });
    }
    const id = req.params.id;
    const { amount } = req.body || {};
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer' });
    }

    // Look up the target wolf so we can compute their new balance.
    const { data: reqRow, error: reqErr } = await supabase
      .from('credit_requests')
      .select('id, user_id, status')
      .eq('id', id)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!reqRow) return res.status(404).json({ error: 'request not found' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ error: 'request already resolved' });
    }

    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, wolf_credits')
      .eq('id', reqRow.user_id)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!targetProfile) return res.status(404).json({ error: 'target wolf not found' });

    const nextCredits = (targetProfile.wolf_credits ?? 0) + amount;
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ wolf_credits: nextCredits })
      .eq('id', reqRow.user_id);
    if (updErr) throw updErr;

    const { data: updated, error: stampErr } = await supabase
      .from('credit_requests')
      .update({
        status: 'granted',
        granted_amount: amount,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, granted_amount, granted_by, granted_at')
      .single();
    if (stampErr) throw stampErr;

    res.json({ item: updated, newCredits: nextCredits });
  } catch (err) {
    console.error('Credit request grant error:', err);
    res.status(500).json({ error: err.message || 'grant failed' });
  }
});

app.post('/api/credit-requests/:id/deny', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'database offline' });
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'admin only' });
    }
    const { data, error } = await supabase
      .from('credit_requests')
      .update({
        status: 'denied',
        granted_by: user.id,
        granted_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('id, status, granted_at')
      .single();
    if (error) throw error;
    res.json({ item: data });
  } catch (err) {
    console.error('Credit request deny error:', err);
    res.status(500).json({ error: err.message || 'deny failed' });
  }
});

// ─── Fallback to index.html (SPA) ────────────────────────────────────────────
app.get('*', (req, res) => {
  // Try multiple paths (local dev vs Vercel deployment)
  const candidates = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, 'client', 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 50MB)' });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Lightning Wolves Studio running on port ${PORT}`);
});

module.exports = app;

// ─── Prompt builder ───────────────────────────────────────────────────────────
// Structured-outputs schema for /api/generate — mirrors the JSON shape that
// buildUserPrompt describes. Enforced server-side by the API (output_config
// .format), so the response is guaranteed-valid JSON in exactly this shape.
// Note: structured outputs forbid min/max constraints — content requirements
// (line counts, SRT formatting) stay in the prompt.
const LYRICS_PACK_SCHEMA = {
  type: 'object',
  properties: {
    lyrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ts: { type: 'string' }, text: { type: 'string' } },
        required: ['ts', 'text'],
        additionalProperties: false,
      },
    },
    srt: { type: 'string' },
    beats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ts: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['CUT', 'FADE', 'ZOOM', 'FLASH'] },
        },
        required: ['ts', 'label', 'type'],
        additionalProperties: false,
      },
    },
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { section: { type: 'string' }, prompt: { type: 'string' } },
        required: ['section', 'prompt'],
        additionalProperties: false,
      },
    },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, tip: { type: 'string' } },
        required: ['title', 'tip'],
        additionalProperties: false,
      },
    },
  },
  required: ['lyrics', 'srt', 'beats', 'prompts', 'tips'],
  additionalProperties: false,
};

function buildUserPrompt({ title, artist, genre, bpm, language, mood }) {
  return `Generate a complete music production pack for the following track:

Track Title: ${title}
Artist: ${artist}
Genre: ${genre}
Language: ${language}${bpm ? `\nBPM: ${bpm}` : ''}${mood ? `\nMood/Vibe: ${mood}` : ''}

Return ONLY a valid JSON object with this exact structure:
{
  "lyrics": [
    {"ts": "0:00", "text": "lyric line here"},
    {"ts": "0:05", "text": "next lyric line"}
  ],
  "srt": "1\\n00:00:00,000 --> 00:00:05,000\\nLyric line here\\n\\n2\\n00:00:05,000 --> 00:00:10,000\\nNext lyric line\\n\\n",
  "beats": [
    {"ts": "0:00", "label": "Intro start", "type": "CUT"},
    {"ts": "0:16", "label": "Verse 1 drop", "type": "CUT"},
    {"ts": "0:32", "label": "Pre-chorus build", "type": "FADE"},
    {"ts": "0:48", "label": "Chorus hit", "type": "ZOOM"},
    {"ts": "1:04", "label": "Flash moment", "type": "FLASH"}
  ],
  "prompts": [
    {"section": "Intro (0:00-0:16)", "prompt": "Detailed cinematic visual prompt for Kling/Runway/PixVerse AI video generation, describing camera angles, lighting, atmosphere, movement, style for this section"},
    {"section": "Verse 1 (0:16-0:48)", "prompt": "..."}
  ],
  "tips": [
    {"title": "TikTok Hook", "tip": "Specific actionable advice for this genre on TikTok"},
    {"title": "Instagram Reels", "tip": "Specific advice for Reels"},
    {"title": "YouTube Shorts", "tip": "Specific advice for Shorts"},
    {"title": "Visual Style", "tip": "Genre-specific visual tip"},
    {"title": "Trending Audio", "tip": "How to leverage this track on social media"}
  ]
}

Requirements:
- Write authentic ${genre} lyrics in ${language} (minimum 24 lines covering: intro, verse 1, pre-chorus, chorus, verse 2, bridge, outro)
- Include section headers as lyric lines (e.g. {"ts": "0:16", "text": "[VERSE 1]"})
- SRT must be properly formatted subtitle file content
- Beat cuts should cover the full song structure with realistic timestamps
- AI prompts should be highly detailed and cinematic, tailored to ${genre} aesthetics
- Tips must be specific to ${genre} and current social media trends
- All content must be in ${language}`;
}
