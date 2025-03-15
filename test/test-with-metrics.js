// Test runner that includes metrics tests but with HTTP servers disabled

// Set environment variable to disable metrics HTTP servers
process.env.DISABLE_METRICS_HTTP = 'true';

// Override metrics initialization to always disable HTTP server
const originalInit = require('../metrics.js').initMetrics;
require('../metrics.js').initMetrics = function(serviceName, port, disableHttp) {
  return originalInit(serviceName, port, true);
};

// Run all tests
require('./test.js');