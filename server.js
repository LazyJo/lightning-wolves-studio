require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Lazy-init clients (avoid crash if env vars missing) ─────────────────────
let supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(url, key);
  }
  return supabase;
}

let anthropic = null;
function getAnthropic() {
  if (anthropic) return anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Multer (use /tmp on Vercel, ./uploads locally) ──────────────────────────
const uploadsDir = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, 'uploads');
if (!process.env.VERCEL) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch { /* exists */ }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const allowed = /audio|video/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only audio and video files are allowed'));
  },
});

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function getUserFromToken(req) {
  const sb = getSupabase();
  if (!sb) return null;
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public config — exposes only safe, public-facing keys to the frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
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

// Main generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { title, artist, genre, bpm, language, mood, wolfId, token } = req.body;

    if (!title || !artist || !genre || !language) {
      return res.status(400).json({ error: 'title, artist, genre, and language are required' });
    }

    const sb = getSupabase();
    let user = null;
    let isMember = false;

    if (token && sb) {
      user = await getUserFromToken({ headers: { authorization: `Bearer ${token}` } });
      if (user) {
        const profile = await getProfile(user.id);
        isMember = profile?.role === 'member';

        if (!isMember) {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const { count } = await sb
            .from('generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth);

          if (count >= 3) {
            return res.status(403).json({ error: 'LIMIT_REACHED', message: 'Monthly generation limit reached.' });
          }
        }
      }
    }

    const ai = getAnthropic();
    if (!ai) {
      return res.status(503).json({ error: 'AI service not configured. Set ANTHROPIC_API_KEY.' });
    }

    const systemPrompt = `You are Lightning Wolves Lyrics Studio — a professional AI music production assistant for independent artists. Generate complete, authentic, emotionally resonant song content tailored precisely to the genre, language and vibe provided. Always respond with valid JSON only, no markdown, no explanation outside the JSON.`;

    const userPrompt = buildUserPrompt({ title, artist, genre, bpm, language, mood });

    const message = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let pack;
    try {
      pack = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (user && sb) {
      await sb.from('generations').insert({
        user_id: user.id, title, artist, genre, language, wolf_id: wolfId || null,
      });

      const profile = await getProfile(user.id);
      if (profile?.referred_by) {
        await sb.from('referral_stats').insert({
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

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ error: 'Auth not configured' });

    const { email, password, promoCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await sb.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (error) return res.status(400).json({ error: error.message });

    const userId = data.user.id;

    let referredBy = null;
    if (promoCode) {
      const { data: referrer } = await sb
        .from('profiles')
        .select('id')
        .eq('promo_code', promoCode.toUpperCase())
        .single();
      if (referrer) referredBy = referrer.id;
    }

    await sb.from('profiles').insert({
      id: userId, email, role: 'public', referred_by: referredBy, generations_count: 0,
    });

    res.json({ success: true, userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Member dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const sb = getSupabase();
    if (!sb) return res.status(503).json({ error: 'Not configured' });

    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await getProfile(user.id);
    if (profile?.role !== 'member') return res.status(403).json({ error: 'Members only' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: referralCount } = await sb
      .from('referral_stats')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .gte('created_at', startOfMonth);

    const { count: referredGens } = await sb
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by_member', user.id);

    const { count: ownGens } = await sb
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const REVENUE_PER_GEN = 0.5;
    const totalRevenue = (referredGens || 0) * REVENUE_PER_GEN;
    const membersPoolShare = totalRevenue * 0.4;
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
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ error: 'Not configured' });
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const { data } = await sb
    .from('profiles')
    .select('id, email')
    .eq('promo_code', code.toUpperCase())
    .single();

  if (!data) return res.status(404).json({ valid: false });
  res.json({ valid: true });
});

// Transcription endpoint
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
    res.json({
      success: true,
      words: [],
      message: 'Transcription endpoint ready. Connect Whisper API for word-level timestamps.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

// Model health config endpoint
app.get('/api/models', (req, res) => {
  res.json({
    models: {
      grok: { name: 'Grok Imagine', status: 'green', enabled: true, cost: 10 },
      seedance: { name: 'Seedance 2.0', status: 'yellow', enabled: false, cost: 15 },
      kling: { name: 'Kling', status: 'green', enabled: true, cost: 15 },
    },
    primaryModel: 'grok',
    fallbackModel: 'kling',
  });
});

app.post('/api/models', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await getProfile(user.id);
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json({ success: true, message: 'Model config updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fallback to index.html (SPA) ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 100MB.' });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Only listen when not on Vercel ──────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Lightning Wolves Studio running on port ${PORT}`);
  });
}

module.exports = app;

// ─── Prompt builder ──────────────────────────────────────────────────────────
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
    {"section": "Intro (0:00-0:16)", "prompt": "Detailed cinematic visual prompt for AI video generation"},
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
