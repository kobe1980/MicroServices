const sinon = require('sinon');
const should = require('should');
const proxyquire = require('proxyquire');

describe('SystemManager Metrics Integration', function() {
  let SystemManager, metricsStub, rabbitAdapterStub, loggerStub, compressorStub;
  
  beforeEach(function() {
    // Create metrics stubs
    metricsStub = {
      recordMessageReceived: sinon.stub(),
      recordMessageSent: sinon.stub(),
      startJobTimer: sinon.stub().returns(() => {}),
      setWorkerCount: sinon.stub(),
      setConnectedWorkers: sinon.stub(),
      recordError: sinon.stub()
    };
    
    // Create metrics module stub
    const metricsModuleStub = {
      initMetrics: sinon.stub().returns(metricsStub)
    };
    
    // Create logger stub
    loggerStub = {
      log: sinon.stub()
    };
    
    // Create Compressor mock
    compressorStub = function() {
      return {
        serialize: sinon.stub().callsFake(o => JSON.stringify(o)),
        deserialize: sinon.stub().callsFake(s => typeof s === 'string' ? JSON.parse(s) : s)
      };
    };
    
    // Mock pub socket
    const pubSocketStub = {
      connect: sinon.stub().callsFake(function(channel, callback) {
        if (callback) callback();
        return this;
      }),
      publish: sinon.stub(),
      close: sinon.stub(),
      end: sinon.stub()
    };
    
    // Mock sub socket
    const subSocketStub = {
      connect: sinon.stub().callsFake(function(channel, topic, callback) {
        if (typeof topic === 'function') {
          topic(); // topic is actually callback
        } else if (callback) {
          callback();
        }
        return this;
      }),
      on: sinon.stub(),
      close: sinon.stub(),
      emit: sinon.stub().callsFake(function(event, data) {
        const handlers = this._handlers || {};
        const handler = handlers[event];
        if (handler) {
          handler(data);
        }
        return this;
      }),
      _handlers: {}
    };
    
    // Data handlers for different topics
    const handlers = {};
    
    // Store "on" handlers
    subSocketStub.on.callsFake(function(event, handler) {
      if (!this._handlers) {
        this._handlers = {};
      }
      this._handlers[event] = handler;
      return this;
    });
    
    // Update connect to track the topic
    const originalConnect = subSocketStub.connect;
    subSocketStub.connect = function(channel, topic, callback) {
      this.lastTopic = topic;
      return originalConnect.call(this, channel, topic, callback);
    };
    
    // Mock context
    const contextStub = {
      on: sinon.stub(),
      socket: sinon.stub().callsFake(function(type) {
        if (type === 'PUB') {
          return pubSocketStub;
        } else {
          return subSocketStub;
        }
      })
    };
    
    // Handle ready event
    contextStub.on.withArgs('ready').callsFake(function(event, callback) {
      contextStub.readyCallback = callback;
    });
    
    // Mock RabbitAdapter
    rabbitAdapterStub = {
      createContext: sinon.stub().returns(contextStub)
    };
    
    // Mock config
    const configStub = {
      SystemManager_log: true,
      broker_url: 'amqp://localhost',
      keepalive: 10 // Short interval to avoid hanging
    };
    
    // Require the SystemManager with our stubs
    SystemManager = proxyquire('../SystemManager.js', {
      './logger.js': loggerStub,
      './config/config.json': configStub,
      './Compressor.js': compressorStub,
      './metrics.js': metricsModuleStub,
      './RabbitAdapter': rabbitAdapterStub
    });
    
    // Make the handlers accessible to tests
    this.handlers = handlers;
    this.pubSocketStub = pubSocketStub;
    this.subSocketStub = subSocketStub;
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  describe('Worker management and metrics recording', function() {
    let systemManager;
    
    beforeEach(function() {
      systemManager = new SystemManager();
      
      // Trigger the ready event to initialize the system
      systemManager.context.readyCallback();
      
      // Disable keepalive interval to prevent test interference
      clearInterval(systemManager.timeoutId);
    });
    
    afterEach(function() {
      if (systemManager) {
        systemManager.kill();
      }
    });
    
    it('should record metrics when a new worker is added', function() {
      // Create a mock worker data
      const workerData = JSON.stringify({
        id: 'worker1:1234567890123',
        type: 'processor',
        tasks: ['task1', 'task2']
      });
      
      // Simulate adding a worker
      systemManager.addWorker(workerData);
      
      // Verify metrics were recorded
      metricsStub.recordMessageReceived.calledWith('worker_registration').should.be.true();
      
      // Verify worker count metrics were updated
      metricsStub.setWorkerCount.calledWith('processor', 1).should.be.true();
      
      // Verify total workers count
      metricsStub.setConnectedWorkers.calledWith(1).should.be.true();
    });
    
    it('should record metrics when multiple workers of different types are added', function() {
      // Add first worker
      systemManager.addWorker(JSON.stringify({
        id: 'worker1:1234567890123',
        type: 'processor',
        tasks: ['task1']
      }));
      
      // Add second worker of same type
      systemManager.addWorker(JSON.stringify({
        id: 'worker2:1234567890124',
        type: 'processor',
        tasks: ['task1', 'task2']
      }));
      
      // Add third worker of different type
      systemManager.addWorker(JSON.stringify({
        id: 'worker3:1234567890125',
        type: 'database',
        tasks: ['query']
      }));
      
      // Verify metrics recording count
      metricsStub.recordMessageReceived.callCount.should.equal(3);
      
      // Reset counters to verify final state
      metricsStub.setWorkerCount.resetHistory();
      metricsStub.setConnectedWorkers.resetHistory();
      
      // Update metrics one more time to get final values
      systemManager.updateWorkerMetrics();
      
      // Verify correct worker counts by type
      metricsStub.setWorkerCount.getCalls().should.matchAny(function(call) {
        return call.args[0] === 'processor' && call.args[1] === 2;
      });
      
      metricsStub.setWorkerCount.getCalls().should.matchAny(function(call) {
        return call.args[0] === 'database' && call.args[1] === 1;
      });
      
      // Verify total workers count is 3
      metricsStub.setConnectedWorkers.calledWith(3).should.be.true();
    });
    
    it('should record metrics when a worker is deleted', function() {
      // First add a worker
      systemManager.addWorker(JSON.stringify({
        id: 'worker1:1234567890123',
        type: 'processor',
        tasks: ['task1']
      }));
      
      // Reset stubs to clearly see delete operations
      metricsStub.recordMessageReceived.resetHistory();
      metricsStub.setWorkerCount.resetHistory();
      metricsStub.setConnectedWorkers.resetHistory();
      
      // Now delete the worker
      systemManager.delWorker(JSON.stringify({
        id: 'worker1:1234567890123'
      }));
      
      // Verify metrics were recorded
      metricsStub.recordMessageReceived.calledWith('worker_deletion').should.be.true();
      
      // Verify connected workers is 0
      metricsStub.setConnectedWorkers.calledWith(0).should.be.true();
    });
    
    it('should record metrics for keepalive messages', function() {
      // Call keepAlive manually (avoiding the setInterval)
      systemManager.keepAlive();
      
      // Verify metrics were recorded
      metricsStub.recordMessageSent.calledWith('keepalive').should.be.true();
      
      // Verify message was published
      this.pubSocketStub.publish.calledWith('worker.getAll', sinon.match.string).should.be.true();
    });
    
    it('should record metrics when workers list is requested', function() {
      // Add a worker first
      systemManager.addWorker(JSON.stringify({
        id: 'worker1:1234567890123',
        type: 'processor',
        tasks: ['task1']
      }));
      
      // Reset metrics stubs
      metricsStub.recordMessageReceived.resetHistory();
      metricsStub.setWorkerCount.resetHistory();
      metricsStub.setConnectedWorkers.resetHistory();
      
      // Call printWorkersList
      systemManager.printWorkersList();
      
      // Verify metrics were recorded
      metricsStub.recordMessageReceived.calledWith('workers_list_request').should.be.true();
      
      // Verify worker metrics were updated
      metricsStub.setConnectedWorkers.calledOnce.should.be.true();
    });
    
    it('should record metrics and timer when processing a job request', function() {
      // Instead of using emit directly, we need to find the handler and call it
      // Add a worker that can handle our job
      systemManager.addWorker(JSON.stringify({
        id: 'processor:1234567890123',
        type: 'processor',
        tasks: ['task1']
      }));
      
      // Reset metrics
      metricsStub.recordMessageReceived.resetHistory();
      metricsStub.startJobTimer.resetHistory();
      
      // Create job data that matches our worker
      const jobData = {
        id: 'job123',
        sender: 'client1',
        workers_list: ['processor:*'],
        workers_list_id: 0,
        data: { task: 'process something' }
      };
      
      // Mock the deserialize method to return our test data
      systemManager.compressor.deserialize = sinon.stub().returns(jobData);
      
      // Find the data handler for job requests (manually mocking what would happen at runtime)
      // This is a direct approach since the emit() is not working as expected
      // Access the handler that was registered on notification_nextjob_sub
      const dataHandler = systemManager.notification_nextjob_sub._handlers.data;
      
      // Direct call to the handler with our job data
      dataHandler(Buffer.from(JSON.stringify(jobData)));
      
      // Verify metrics were recorded
      metricsStub.recordMessageReceived.calledWith('job_request').should.be.true();
      metricsStub.startJobTimer.calledWith('job_validation').should.be.true();
    });
    
    it('should record error metrics when no worker is available for a job', function() {
      // Reset metrics
      metricsStub.recordError.resetHistory();
      metricsStub.recordMessageReceived.resetHistory();
      
      // Create job data that doesn't match any workers
      const jobData = {
        id: 'job123',
        sender: 'client1',
        workers_list: ['unknown:*'],
        workers_list_id: 0,
        data: { task: 'process something' }
      };
      
      // Mock the deserialize method to return our test data
      systemManager.compressor.deserialize = sinon.stub().returns(jobData);
      
      // Find the data handler for job requests
      const dataHandler = systemManager.notification_nextjob_sub._handlers.data;
      
      // Direct call to the handler with our job data
      dataHandler(Buffer.from(JSON.stringify(jobData)));
      
      // Verify error metrics were recorded
      metricsStub.recordError.calledWith('no_worker_available').should.be.true();
    });
  });
});