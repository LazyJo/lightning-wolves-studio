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

// Model registry with credit costs
const VISION_MODELS = {
  'nanobanana-pro':     { name: 'NanoBanana Pro',       credits: 15, status: 'access' },
  'nanobanana':         { name: 'NanoBanana',           credits: 10, status: 'access' },
  'grok-imagine':       { name: 'Grok Imagine',        credits: 15, status: 'access' },
  'sora-2':             { name: 'Sora 2',              credits: 20, status: 'legacy' },
  'kling-3':            { name: 'Kling 3.0',           credits: 20, status: 'coming-soon' },
  'kling-motion':       { name: 'Kling Motion Control', credits: 15, status: 'access' },
  'seedream-4.5':       { name: 'Seedream 4.5',        credits: 12, status: 'access' },
  'seedance-2':         { name: 'Seedance 2.0',        credits: 18, status: 'coming-soon' },
};

// Get available models
app.get('/api/models', (req, res) => {
  const models = Object.entries(VISION_MODELS).map(([id, model]) => ({
    id,
    ...model,
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

// Generate visuals (placeholder — will connect to Replicate/Fal.ai later)
app.post('/api/generate-visuals', async (req, res) => {
  try {
    const { modelId, prompt, type, token } = req.body;

    if (!modelId || !prompt) {
      return res.status(400).json({ error: 'modelId and prompt are required' });
    }

    const model = VISION_MODELS[modelId];
    if (!model) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }

    if (model.status === 'coming-soon') {
      return res.status(400).json({ error: 'COMING_SOON', message: `${model.name} is coming soon!` });
    }

    // Check credits
    let user = null;
    let credits = 100; // guest default

    if (token) {
      user = await getUserFromToken({ headers: { authorization: `Bearer ${token}` } });
      if (user) {
        const profile = await getProfile(user.id);
        credits = profile?.wolf_credits ?? 0;
      }
    }

    if (credits < model.credits) {
      return res.status(403).json({
        error: 'INSUFFICIENT_CREDITS',
        message: `Not enough credits. Need ${model.credits}, have ${credits}.`,
        needed: model.credits,
        current: credits,
      });
    }

    // Deduct credits
    if (user) {
      await supabase
        .from('profiles')
        .update({ wolf_credits: credits - model.credits })
        .eq('id', user.id);

      // Log the visual generation
      await supabase.from('visual_generations').insert({
        user_id: user.id,
        model_id: modelId,
        prompt,
        type: type || 'scene',
        credits_used: model.credits,
        status: 'completed', // placeholder — will be 'processing' when real APIs connected
      });
    }

    // Placeholder response — will be replaced with actual API call
    res.json({
      success: true,
      generation: {
        id: `gen_${Date.now()}`,
        model: model.name,
        prompt,
        type: type || 'scene',
        creditsUsed: model.credits,
        remainingCredits: credits - model.credits,
        status: 'completed',
        message: `${model.name} generation queued. Connect external API (Replicate/Fal.ai) to enable real generation.`,
      },
    });
  } catch (err) {
    console.error('Generate visuals error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
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
