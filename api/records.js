const { handler } = require('../lib/records-handler.cjs');
module.exports = handler(require('../lib/database.cjs'));
