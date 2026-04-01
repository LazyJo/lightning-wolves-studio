const app = require('../server');

// Disable Vercel's automatic body parsing so Express can handle it
module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
  maxDuration: 60,
};
