const sinon = require('sinon');
const assert = require('assert');
const should = require('should');
const proxyquire = require('proxyquire');
const EventEmitter = require('events');

describe('Metrics', function() {
  let metrics, httpStub, loggerStub, serverStub, promClientStub;
  
  // Mock HTTP server
  class MockServer extends EventEmitter {
    listen(port, callback) {
      this.port = port;
      callback();
      return this;
    }
  }
  
  beforeEach(function() {
    // Create stubs
    serverStub = new MockServer();
    
    // HTTP server stub
    httpStub = {
      createServer: sinon.stub().callsFake((handler) => {
        serverStub.handler = handler;
        return serverStub;
      })
    };
    
    // Logger stub
    loggerStub = {
      log: sinon.stub()
    };
    
    // Counter, Gauge, Histogram mocks
    const mockMetric = {
      inc: sinon.stub(),
      set: sinon.stub(),
      startTimer: sinon.stub().returns(() => {})
    };
    
    // Prometheus client stub
    promClientStub = {
      Registry: sinon.stub().returns({
        contentType: 'text/plain',
        metrics: sinon.stub().resolves('metrics data'),
        registers: []
      }),
      Counter: sinon.stub().returns(mockMetric),
      Gauge: sinon.stub().returns(mockMetric),
      Histogram: sinon.stub().returns(mockMetric),
      collectDefaultMetrics: sinon.stub()
    };
    
    // Require the module with our stubs
    metrics = proxyquire('../metrics.js', {
      'http': httpStub,
      './logger.js': loggerStub,
      'prom-client': promClientStub
    });
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  describe('initMetrics', function() {
    it('should initialize the metrics with default port', function() {
      const metricsObj = metrics.initMetrics('TestService');
      
      // Verify HTTP server was created
      httpStub.createServer.calledOnce.should.be.true();
      
      // Verify server started on default port
      serverStub.port.should.equal(9091);
      
      // Verify logging
      loggerStub.log.calledOnce.should.be.true();
      loggerStub.log.getCall(0).args[0].should.equal('MicroService');
      loggerStub.log.getCall(0).args[1].should.equal('Metrics');
      loggerStub.log.getCall(0).args[2].should.match(/Metrics server started on port 9091/);
      
      // Check returned object has expected methods
      metricsObj.should.have.properties([
        'recordMessageReceived',
        'recordMessageSent',
        'startJobTimer',
        'setWorkerCount',
        'recordError',
        'setConnectedWorkers',
        'register'
      ]);
    });
    
    it('should initialize the metrics with custom port', function() {
      const customPort = 8765;
      metrics.initMetrics('TestService', customPort);
      
      // Verify server started on custom port
      serverStub.port.should.equal(customPort);
      
      // Verify logging has custom port
      const logMessage = loggerStub.log.getCall(0).args[2];
      logMessage.should.match(new RegExp(`Metrics server started on port ${customPort}`));
    });
    
    it('should handle metrics endpoint correctly', async function() {
      metrics.initMetrics('TestService');
      
      // Create mock request and response
      const req = { url: '/metrics' };
      const res = {
        setHeader: sinon.stub(),
        end: sinon.stub()
      };
      
      // Call the handler
      await serverStub.handler(req, res);
      
      // Verify response headers and content
      res.setHeader.calledOnce.should.be.true();
      res.setHeader.calledWith('Content-Type', 'text/plain').should.be.true();
      res.end.calledOnce.should.be.true();
      res.end.calledWith('metrics data').should.be.true();
    });
    
    it('should handle non-metrics endpoints with 404', async function() {
      metrics.initMetrics('TestService');
      
      // Create mock request and response
      const req = { url: '/invalid' };
      const res = {
        statusCode: 200,
        end: sinon.stub()
      };
      
      // Call the handler
      await serverStub.handler(req, res);
      
      // Verify response is 404
      res.statusCode.should.equal(404);
      res.end.calledOnce.should.be.true();
      res.end.calledWith('Not found').should.be.true();
    });
  });
  
  describe('Metric Recording Functions', function() {
    let metricsObj, mockMetrics;
    
    beforeEach(function() {
      metricsObj = metrics.initMetrics('TestService');
      
      // Extract the mock metrics from the stubs
      mockMetrics = {
        messagesReceived: promClientStub.Counter.getCall(0).returnValue,
        messagesSent: promClientStub.Counter.getCall(1).returnValue,
        jobProcessingTime: promClientStub.Histogram.getCall(0).returnValue,
        workersCount: promClientStub.Gauge.getCall(0).returnValue,
        jobErrorsTotal: promClientStub.Counter.getCall(2).returnValue,
        connectedWorkers: promClientStub.Gauge.getCall(1).returnValue
      };
    });
    
    it('should record message received', function() {
      const messageType = 'test_message';
      metricsObj.recordMessageReceived(messageType);
      
      mockMetrics.messagesReceived.inc.calledOnce.should.be.true();
      mockMetrics.messagesReceived.inc.calledWith({ 
        service: 'TestService', 
        type: messageType 
      }).should.be.true();
    });
    
    it('should record message sent', function() {
      const messageType = 'response_message';
      metricsObj.recordMessageSent(messageType);
      
      mockMetrics.messagesSent.inc.calledOnce.should.be.true();
      mockMetrics.messagesSent.inc.calledWith({ 
        service: 'TestService', 
        type: messageType 
      }).should.be.true();
    });
    
    it('should start job timer', function() {
      const jobType = 'process_data';
      const timer = metricsObj.startJobTimer(jobType);
      
      mockMetrics.jobProcessingTime.startTimer.calledOnce.should.be.true();
      mockMetrics.jobProcessingTime.startTimer.calledWith({ 
        service: 'TestService', 
        job_type: jobType 
      }).should.be.true();
      
      should.exist(timer);
    });
    
    it('should set worker count', function() {
      const workerType = 'processor';
      const count = 5;
      metricsObj.setWorkerCount(workerType, count);
      
      mockMetrics.workersCount.set.calledOnce.should.be.true();
      mockMetrics.workersCount.set.calledWith({ type: workerType }, count).should.be.true();
    });
    
    it('should record error', function() {
      const errorType = 'connection_error';
      metricsObj.recordError(errorType);
      
      mockMetrics.jobErrorsTotal.inc.calledOnce.should.be.true();
      mockMetrics.jobErrorsTotal.inc.calledWith({ 
        service: 'TestService', 
        error_type: errorType 
      }).should.be.true();
    });
    
    it('should set connected workers count', function() {
      const count = 10;
      metricsObj.setConnectedWorkers(count);
      
      mockMetrics.connectedWorkers.set.calledOnce.should.be.true();
      mockMetrics.connectedWorkers.set.calledWith(count).should.be.true();
    });
  });
});