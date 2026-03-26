const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Vercel serverless function config — disable body parser, allow up to 50mb
module.exports.config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let tmpPath = null;

  try {
    // Parse multipart/form-data with busboy
    tmpPath = await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let savedPath = null;
      let writeError = null;

      busboy.on('file', (fieldname, fileStream, info) => {
        const ext = path.extname(info.filename || 'audio.mp3') || '.mp3';
        const dest = path.join('/tmp', `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        const writeStream = fs.createWriteStream(dest);

        fileStream.on('error', (err) => { writeError = err; });
        writeStream.on('error', (err) => { writeError = err; });
        writeStream.on('finish', () => { savedPath = dest; });
        fileStream.pipe(writeStream);
      });

      busboy.on('finish', () => {
        if (writeError) return reject(writeError);
        if (!savedPath) return reject(new Error('No audio file found in request'));
        resolve(savedPath);
      });

      busboy.on('error', reject);
      req.pipe(busboy);
    });

    // Call Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const transcriptLines = (transcription.segments || []).map((seg) => ({
      ts: secsToTs(seg.start),
      text: seg.text.trim(),
    }));

    console.log(`[transcribe] success — ${transcriptLines.length} segments`);
    return res.json({ transcriptLines });

  } catch (err) {
    console.error('[transcribe] error:', err.message);
    return res.status(500).json({ error: err.message || 'Transcription failed' });
  } finally {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
};

function secsToTs(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
