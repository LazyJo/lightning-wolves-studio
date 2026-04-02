const app = require('../server');
module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
    sizeLimit: '100mb',
  },
  maxDuration: 120,
};
