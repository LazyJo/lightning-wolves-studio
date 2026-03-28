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
    tmpPath = await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let dest = null;
      let writeFinishPromise = null;

      busboy.on('file', (fieldname, fileStream, info) => {
        console.log(`[transcribe] file field="${fieldname}" filename="${info.filename}" mime="${info.mimeType}"`);

        const ext = path.extname(info.filename || '') || '.mp3';
        dest = path.join('/tmp', `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

        // Track write completion as a promise so busboy.finish can await it
        writeFinishPromise = new Promise((res, rej) => {
          const writeStream = fs.createWriteStream(dest);
          writeStream.on('finish', res);
          writeStream.on('error', rej);
          fileStream.on('error', rej);
          fileStream.pipe(writeStream);
        });
      });

      busboy.on('field', (name, val) => {
        console.log(`[transcribe] non-file field="${name}" value="${val}"`);
      });

      busboy.on('finish', async () => {
        if (!dest) {
          return reject(new Error('No audio file found in request — check FormData field name is "file"'));
        }
        try {
          await writeFinishPromise;
          resolve(dest);
        } catch (writeErr) {
          reject(writeErr);
        }
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
