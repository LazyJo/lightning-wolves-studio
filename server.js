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
  });
});

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

app.post('/api/transcribe', memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
    if (!openai) return res.status(500).json({ error: 'OPENAI_API_KEY not configured. Add it in Vercel Environment Variables.' });

    // Create a File-like object from the buffer for OpenAI SDK
    const file = new File([req.file.buffer], req.file.originalname, { type: req.file.mimetype });

    const langCode = req.body.language === 'French' ? 'fr' :
                     req.body.language === 'Dutch' ? 'nl' :
                     req.body.language === 'Spanish' ? 'es' : 'en';

    // Call Whisper API with buffer
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: langCode,
    });

    res.json({
      success: true,
      text: transcription.text,
      segments: transcription.segments || [],
      words: transcription.words || [],
      language: transcription.language,
      duration: transcription.duration,
    });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: err.message || 'Transcription failed' });
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
    const systemPrompt = `You are Lightning Wolves Lyrics Studio — a professional AI music production assistant for independent artists. Generate complete, authentic, emotionally resonant song content tailored precisely to the genre, language and vibe provided. Always respond with valid JSON only, no markdown, no explanation outside the JSON.`;

    const userPrompt = buildUserPrompt({ title, artist, genre, bpm, language, mood });

    // ── Call Claude ────────────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';

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

// Signup endpoint (creates profile with promo code tracking)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, promoCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return res.status(400).json({ error: error.message });

    const userId = data.user.id;

    // Find referrer from promo code
    let referredBy = null;
    if (promoCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('promo_code', promoCode.toUpperCase())
        .single();
      if (referrer) referredBy = referrer.id;
    }

    // Create profile
    await supabase.from('profiles').insert({
      id: userId,
      email,
      role: 'public',
      referred_by: referredBy,
      generations_count: 0,
    });

    res.json({ success: true, userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    replicateModel: 'kwaivgi/kling-v2.1',
    buildInput: (prompt, opts = {}) => ({
      prompt,
      duration: opts.duration || 5,
      aspect_ratio: opts.aspectRatio || '16:9',
      negative_prompt: opts.negativePrompt || '',
    }),
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
