require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabase = process.env.SUPABASE_URL
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
    )
  : null;

// ─── Anthropic ───────────────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── OpenAI (Whisper transcription) ─────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Multer (file uploads) ──────────────────────────────────────────────────
const uploadsDir = path.join(require('os').tmpdir(), 'lw-uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir, limits: { fileSize: 100 * 1024 * 1024 } });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function getUserFromToken(req) {
  if (!supabase) return null;
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfile(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
// Use a Router so routes work both locally (/api/generate) and on Vercel
// serverless (/generate — Vercel strips the /api prefix for api/ functions).
const router = express.Router();
app.use('/api', router);
app.use('/', router);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public config — exposes only safe, public-facing keys to the frontend
router.get('/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
});

// Test endpoint — confirms API routing is live
router.get('/test', (req, res) => res.json({ status: 'ok' }));

// Test Whisper connectivity
router.get('/test-whisper', (req, res) => {
  res.json({
    openaiKeyExists: !!process.env.OPENAI_API_KEY,
    openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openaiClientReady: !!openai,
    anthropicKeyExists: !!process.env.ANTHROPIC_API_KEY,
  });
});

// Upload + Whisper transcription endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('[upload] OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY, 'length:', process.env.OPENAI_API_KEY?.length);
    console.log('[upload] openai client ready:', !!openai);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, path: tmpPath, size, mimetype } = req.file;
    const sizeMB = (size / 1024 / 1024).toFixed(1);
    console.log('[upload] file received:', originalname, sizeMB + 'MB', mimetype);

    // Transcribe with Whisper if OpenAI is configured
    let transcript = null;
    if (openai) {
      console.log('[upload] calling Whisper API for:', originalname);
      try {
        const fileStream = fs.createReadStream(tmpPath);
        const result = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        });
        console.log('[upload] Whisper raw result keys:', Object.keys(result));
        console.log('[upload] Whisper text (first 200):', (result.text || '').slice(0, 200));
        console.log('[upload] Whisper segments count:', result.segments?.length || 0);
        transcript = {
          text: result.text,
          segments: (result.segments || []).map(s => ({
            start: s.start,
            end: s.end,
            text: s.text,
          })),
          language: result.language,
          duration: result.duration,
        };
        console.log('[upload] transcription done, segments:', transcript.segments.length);
      } catch (whisperErr) {
        console.error('[upload] Whisper API error:', whisperErr.message);
        console.error('[upload] Whisper error details:', JSON.stringify(whisperErr.error || whisperErr.response?.data || {}, null, 2));
        // Clean up and return the actual error
        try { fs.unlinkSync(tmpPath); } catch {}
        return res.status(502).json({ error: `Whisper transcription failed: ${whisperErr.message}` });
      }
    } else {
      // Clean up and return error — transcription is required
      try { fs.unlinkSync(tmpPath); } catch {}
      return res.status(503).json({ error: 'Whisper not configured. Set OPENAI_API_KEY to enable transcription.' });
    }

    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch {}

    res.json({
      originalName: originalname,
      size: sizeMB,
      mimetype,
      transcript,
    });
  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Main generation endpoint
router.post('/generate', async (req, res) => {
  console.log('[generate] hit — method:', req.method, 'url:', req.url, 'originalUrl:', req.originalUrl);
  try {
    const { title, artist, genre, bpm, language, mood, wolfId, token, transcript } = req.body || {};

    // Validate required fields
    if (!title || !artist || !genre || !language) {
      return res.status(400).json({ error: 'title, artist, genre, and language are required' });
    }

    // Check Anthropic is configured
    if (!anthropic) {
      return res.status(503).json({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' });
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

    // ── Build lyrics from transcript or error ──────────────────────────────
    // When a transcript exists, use Whisper's real segments — never ask Claude
    // to invent lyrics. Claude only generates beats, prompts, and tips.
    let whisperLyrics = null;
    if (transcript && transcript.segments && transcript.segments.length > 0) {
      whisperLyrics = transcript.segments.map(s => ({
        ts: formatTimestamp(s.start),
        text: s.text.trim(),
      }));
    }

    // ── Build Claude prompt ────────────────────────────────────────────────
    const systemPrompt = `You are Lightning Wolves Lyrics Studio — a professional AI music production assistant for independent artists. Always respond with valid JSON only, no markdown, no explanation outside the JSON.`;

    const userPrompt = buildUserPrompt({ title, artist, genre, bpm, language, mood, hasTranscript: !!whisperLyrics });

    // ── Call Claude ────────────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';
    console.log('[generate] raw Claude response (first 500 chars):', raw.slice(0, 500));

    // Extract the outermost JSON object, tolerating any preamble or markdown fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate] No JSON object found in response. Full raw:', raw);
      return res.status(500).json({ error: 'Failed to parse AI response: no JSON object found', raw });
    }

    // Sanitize: replace literal control characters inside JSON string values.
    // Claude sometimes emits raw newlines/tabs inside string values which is
    // invalid JSON — this walks the string char-by-char to fix only those cases.
    const sanitized = sanitizeJsonString(jsonMatch[0]);

    let pack;
    try {
      pack = JSON.parse(sanitized);
    } catch (parseErr) {
      console.error('[generate] JSON.parse failed:', parseErr.message, '\nSanitized (first 300):', sanitized.slice(0, 300));
      return res.status(500).json({ error: 'Failed to parse AI response', raw });
    }

    // Use real Whisper lyrics — never use Claude-generated lyrics when we have a transcript
    if (whisperLyrics) {
      pack.lyrics = whisperLyrics;
    }

    // Generate SRT server-side from the lyrics array
    pack.srt = buildSrt(pack.lyrics);

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
router.post('/auth/signup', async (req, res) => {
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
router.get('/dashboard', async (req, res) => {
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
router.post('/promo/verify', async (req, res) => {
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

// ─── Fallback ────────────────────────────────────────────────────────────────
// GET: serve SPA index.html. Other methods: return JSON 404 (not 405).
app.all('*', (req, res) => {
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  }
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 50MB)' });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Lightning Wolves Studio running on port ${PORT}`);
  });
}

module.exports = app;

// ─── JSON sanitizer ───────────────────────────────────────────────────────────
// Walks the string character-by-character and escapes literal control characters
// (newline, carriage return, tab) that appear inside JSON string values.
// These are valid in JSON only as \n \r \t — Claude occasionally emits them raw.
function sanitizeJsonString(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }
    result += ch;
  }
  return result;
}

// ─── SRT builder ─────────────────────────────────────────────────────────────
// Converts the lyrics array [{ts:"0:16", text:"..."}] to an SRT string.
// Each subtitle shows for 4 seconds (or until the next line).
function buildSrt(lyrics) {
  if (!Array.isArray(lyrics) || lyrics.length === 0) return '';

  function tsToSeconds(ts) {
    if (!ts) return 0;
    const parts = String(ts).split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }

  function formatSrtTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},000`;
  }

  return lyrics.map((line, i) => {
    const start = tsToSeconds(line.ts);
    const nextStart = i + 1 < lyrics.length ? tsToSeconds(lyrics[i + 1].ts) : start + 4;
    const end = Math.max(start + 1, nextStart);
    return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${line.text}`;
  }).join('\n\n') + '\n\n';
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildUserPrompt({ title, artist, genre, bpm, language, mood, hasTranscript }) {
  // When we have a real transcript, do NOT ask Claude for lyrics at all.
  // Lyrics come directly from Whisper segments (overwritten server-side).
  // Claude only generates beats, prompts, and tips.
  const lyricsInstruction = hasTranscript
    ? '- "lyrics": return an EMPTY array []. The real lyrics are handled separately from the transcription.'
    : `- "lyrics": 20+ lines in ${language}, section headers like [INTRO] [VERSE 1] [CHORUS] [BRIDGE] [OUTRO], timestamps format "M:SS"`;

  return `Generate a music production pack for this track:

Title: ${title}
Artist: ${artist}
Genre: ${genre}
Language: ${language}${bpm ? `\nBPM: ${bpm}` : ''}${mood ? `\nMood: ${mood}` : ''}

Return ONLY a JSON object with exactly this structure (no text before or after):
{
  "lyrics": [],
  "beats": [
    {"ts": "0:00", "label": "Intro", "type": "CUT"},
    {"ts": "0:32", "label": "Verse 1", "type": "CUT"},
    {"ts": "1:04", "label": "Chorus", "type": "ZOOM"},
    {"ts": "2:00", "label": "Outro", "type": "FADE"}
  ],
  "prompts": [
    {"section": "Intro", "prompt": "cinematic AI video prompt for this section"},
    {"section": "Verse", "prompt": "cinematic AI video prompt for this section"},
    {"section": "Chorus", "prompt": "cinematic AI video prompt for this section"}
  ],
  "tips": [
    {"title": "TikTok", "tip": "actionable tip for this genre on TikTok"},
    {"title": "Reels", "tip": "actionable tip for Instagram Reels"},
    {"title": "Shorts", "tip": "actionable tip for YouTube Shorts"}
  ]
}

Rules:
${lyricsInstruction}
- beats: exactly 4 entries covering intro, verse, chorus, outro. Timestamps format "M:SS"
- prompts: exactly 3 entries, each prompt 1-2 sentences, cinematic style for ${genre}
- tips: exactly 3 entries, specific to ${genre}
- No literal newlines inside string values. No smart quotes. Straight ASCII only.`;
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
