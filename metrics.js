/**
 * Metrics module for MicroServices.js
 * Collects and exposes Prometheus metrics
 */
const promClient = require('prom-client');
const http = require('http');
const logger = require('./logger.js');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const messagesReceived = new promClient.Counter({
  name: 'microservices_messages_received_total',
  help: 'Total number of messages received by service',
  labelNames: ['service', 'type'],
  registers: [register]
});

const messagesSent = new promClient.Counter({
  name: 'microservices_messages_sent_total',
  help: 'Total number of messages sent by service',
  labelNames: ['service', 'type'],
  registers: [register]
});

const jobProcessingTime = new promClient.Histogram({
  name: 'microservices_job_processing_seconds',
  help: 'Time spent processing jobs',
  labelNames: ['service', 'job_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const workersCount = new promClient.Gauge({
  name: 'microservices_workers_total',
  help: 'Number of workers by type',
  labelNames: ['type'],
  registers: [register]
});

const jobErrorsTotal = new promClient.Counter({
  name: 'microservices_job_errors_total',
  help: 'Total number of job processing errors',
  labelNames: ['service', 'error_type'],
  registers: [register]
});

const connectedWorkers = new promClient.Gauge({
  name: 'microservices_connected_workers',
  help: 'Number of workers connected to the bus',
  registers: [register]
});

/**
 * Initialize metrics collection for a service
 * @param {string} serviceName - The name of the service
 * @param {number} port - The port to expose metrics on
 */
function initMetrics(serviceName, port) {
  // In test environment, we might want to disable the HTTP server
  port = port === undefined ? 9091 : port;
  // Start the HTTP server to expose metrics
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    logger.log('MicroService', 'Metrics', `Metrics server started on port ${port}`, 'INFO');
  });

  return {
    // Record when a message is received
    recordMessageReceived: (type) => {
      messagesReceived.inc({ service: serviceName, type });
    },

    // Record when a message is sent
    recordMessageSent: (type) => {
      messagesSent.inc({ service: serviceName, type });
    },

    // Start timing a job
    startJobTimer: (jobType) => {
      return jobProcessingTime.startTimer({ service: serviceName, job_type: jobType });
    },

    // Record worker count by type
    setWorkerCount: (type, count) => {
      workersCount.set({ type }, count);
    },

    // Record error
    recordError: (errorType) => {
      jobErrorsTotal.inc({ service: serviceName, error_type: errorType });
    },

    // Set connected workers count
    setConnectedWorkers: (count) => {
      connectedWorkers.set(count);
    },
    
    // Get registry for custom metrics
    register
  };
}

module.exports = {
  initMetrics
};