const app = require('../server');
module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
    // Vercel Pro/Enterprise allows up to 100MB with streaming.
    // Hobby plan has a 4.5MB limit — files larger than that will fail.
    // Whisper accepts up to 25MB.
    sizeLimit: '25mb',
  },
  maxDuration: 120,
};
