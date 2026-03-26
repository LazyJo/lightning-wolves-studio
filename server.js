require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── OpenAI (Whisper) ─────────────────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Multer (multipart uploads to /tmp) ──────────────────────────────────────
const uploadsDir = '/tmp/uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public config — exposes public-facing keys to the frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL     || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    openaiApiKey:    process.env.OPENAI_API_KEY   || null,
  });
});

// Test endpoint — confirms API routing is live
app.get('/api/test', (req, res) => res.json({ status: 'ok' }));

// Transcription endpoint — receives audio as multipart/form-data, returns transcript lines
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  if (!openai) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided.' });
  }
  const tmpPath = req.file.path;
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    const transcriptLines = (transcription.segments || []).map(seg => ({
      ts: secsToTs(seg.start),
      text: seg.text.trim(),
    }));
    res.json({ transcriptLines });
  } catch (err) {
    console.error('[transcribe] Whisper error:', err.message);
    res.status(500).json({ error: err.message || 'Transcription failed' });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

function secsToTs(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

    // ── Transcript from frontend Whisper call (if provided) ────────────────
    const { transcriptLines } = req.body;
    const transcribedLyrics = Array.isArray(transcriptLines) && transcriptLines.length > 0
      ? transcriptLines
      : null;

    // ── Build Claude prompt ────────────────────────────────────────────────
    const systemPrompt = `You are Lightning Wolves Lyrics Studio — a professional AI music production assistant for independent artists. Always respond with valid JSON only, no markdown, no explanation outside the JSON.`;

    const userPrompt = transcribedLyrics
      ? buildPromptWithTranscription({ title, artist, genre, bpm, language, mood, lyrics: transcribedLyrics })
      : buildUserPrompt({ title, artist, genre, bpm, language, mood });

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

    // If we used transcription, the lyrics come from Whisper — not from Claude's JSON
    if (transcribedLyrics) pack.lyrics = transcribedLyrics;

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

// ─── Fallback to index.html (SPA) ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
function buildUserPrompt({ title, artist, genre, bpm, language, mood }) {
  return `Generate a music production pack for this track:

Title: ${title}
Artist: ${artist}
Genre: ${genre}
Language: ${language}${bpm ? `\nBPM: ${bpm}` : ''}${mood ? `\nMood: ${mood}` : ''}

Return ONLY a JSON object with exactly this structure (no text before or after):
{
  "lyrics": [
    {"ts": "0:00", "text": "[INTRO]"},
    {"ts": "0:08", "text": "first lyric line"},
    {"ts": "0:16", "text": "[VERSE 1]"},
    {"ts": "0:24", "text": "verse lyric line"}
  ],
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
- Lyrics: 20+ lines in ${language}, section headers like [INTRO] [VERSE 1] [CHORUS] [BRIDGE] [OUTRO]
- Timestamps format: "M:SS" (e.g. "1:04")
- beats: exactly 4 entries covering intro, verse, chorus, outro
- prompts: exactly 3 entries, each prompt 1-2 sentences, cinematic style for ${genre}
- tips: exactly 3 entries, specific to ${genre}
- No literal newlines inside string values. No smart quotes. Straight ASCII only.`;
}

function buildPromptWithTranscription({ title, artist, genre, bpm, language, mood, lyrics }) {
  const lyricsText = lyrics.map(l => `[${l.ts}] ${l.text}`).join('\n');
  return `Generate a music production pack for this track. The lyrics have already been transcribed — do NOT generate new lyrics.

Title: ${title}
Artist: ${artist}
Genre: ${genre}
Language: ${language}${bpm ? `\nBPM: ${bpm}` : ''}${mood ? `\nMood: ${mood}` : ''}

Transcribed lyrics with timestamps:
${lyricsText}

Return ONLY a JSON object with exactly this structure (no text before or after):
{
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
- Use the real lyric timestamps to place beat cuts accurately
- prompts: exactly 3 entries, 1-2 sentences each, cinematic style for ${genre}
- tips: exactly 3 entries, specific to ${genre}
- No literal newlines inside string values. No smart quotes. Straight ASCII only.`;
}
