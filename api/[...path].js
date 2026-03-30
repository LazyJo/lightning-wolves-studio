const app = require('../server');

// Disable Vercel's automatic body parsing so Express/multer can handle it
module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
    sizeLimit: '150mb',
  },
};
