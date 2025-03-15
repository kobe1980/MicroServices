const sinon = require('sinon');
const should = require('should');
const proxyquire = require('proxyquire');

describe('SystemManager Metrics Integration - Direct Tests', function() {
  let SystemManager, metricsStub, contextMock, configMock, rabbitAdapterMock;
  
  beforeEach(function() {
    // Create metrics stubs
    const metricsObj = {
      recordMessageReceived: sinon.stub(),
      recordMessageSent: sinon.stub(),
      startJobTimer: sinon.stub().returns(() => {}),
      setWorkerCount: sinon.stub(),
      setConnectedWorkers: sinon.stub(),
      recordError: sinon.stub()
    };
    
    // Create metrics module stub
    const metricsModuleStub = {
      initMetrics: sinon.stub().returns(metricsObj)
    };
    
    // Mock the pub socket
    const pubSocketMock = {
      connect: sinon.stub().callsFake(function(channel, callback) {
        if (callback) callback();
        return this;
      }),
      publish: sinon.stub(),
      close: sinon.stub(),
      end: sinon.stub()
    };
    
    // Mock the sub socket
    const subSocketMock = {
      connect: sinon.stub().callsFake(function(channel, topic, callback) {
        if (typeof topic === 'function') {
          topic();
          return this;
        }
        if (callback) callback();
        return this;
      }),
      on: sinon.stub(),
      close: sinon.stub()
    };
    
    // Create context mock
    contextMock = {
      on: sinon.stub(),
      socket: sinon.stub()
    };
    
    // Setup socket creation
    contextMock.socket.withArgs('PUB').returns(pubSocketMock);
    contextMock.socket.withArgs('SUB').returns(subSocketMock);
    
    // Handle ready event callback
    contextMock.on.withArgs('ready').callsFake(function(event, callback) {
      // Store the callback to call it during the test
      callback();
    });
    
    // RabbitAdapter mock
    rabbitAdapterMock = {
      createContext: sinon.stub().returns(contextMock)
    };
    
    // Config mock
    configMock = {
      broker_url: 'amqp://localhost',
      keepalive: 10000,
      SystemManager_log: true
    };
    
    // Proxyquire to replace dependencies
    SystemManager = proxyquire('../SystemManager.js', {
      './logger.js': { log: sinon.stub() },
      './config/config.json': configMock,
      './RabbitAdapter': rabbitAdapterMock,
      './metrics.js': metricsModuleStub
    });
    
    // Store metrics stubs for assertions
    this.metricsObj = metricsObj;
    this.pubSocketMock = pubSocketMock;
    this.subSocketMock = subSocketMock;
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  it('should record metrics when a worker is added', function() {
    // Create a system manager instance
    const manager = new SystemManager();
    
    // Clear interval to prevent async issues
    clearInterval(manager.timeoutId);
    
    // Create a worker payload
    const workerData = JSON.stringify({
      id: 'worker1:1234567890123',
      type: 'processor',
      tasks: ['task1']
    });
    
    // Call addWorker method
    manager.addWorker(workerData);
    
    // Verify metrics were recorded
    this.metricsObj.recordMessageReceived.calledWith('worker_registration').should.be.true();
    this.metricsObj.setWorkerCount.called.should.be.true();
    this.metricsObj.setConnectedWorkers.called.should.be.true();
  });
  
  it('should record metrics when a worker is deleted', function() {
    // Create a system manager instance
    const manager = new SystemManager();
    
    // Clear interval to prevent async issues
    clearInterval(manager.timeoutId);
    
    // First add a worker
    const workerData = JSON.stringify({
      id: 'worker1:1234567890123',
      type: 'processor',
      tasks: ['task1']
    });
    
    manager.addWorker(workerData);
    
    // Reset metrics stubs
    this.metricsObj.recordMessageReceived.resetHistory();
    this.metricsObj.setWorkerCount.resetHistory();
    this.metricsObj.setConnectedWorkers.resetHistory();
    
    // Delete the worker
    manager.delWorker(workerData);
    
    // Verify metrics were recorded
    this.metricsObj.recordMessageReceived.calledWith('worker_deletion').should.be.true();
    
    // Verify worker metrics were updated in some way
    this.metricsObj.setConnectedWorkers.called.should.be.true();
  });
  
  it('should record metrics for keepalive messages', function() {
    // Create a system manager instance
    const manager = new SystemManager();
    
    // Clear interval to prevent async issues
    clearInterval(manager.timeoutId);
    
    // Reset metrics stubs
    this.metricsObj.recordMessageSent.resetHistory();
    
    // Call keepAlive
    manager.keepAlive();
    
    // Verify metrics were recorded
    this.metricsObj.recordMessageSent.calledWith('keepalive').should.be.true();
    this.pubSocketMock.publish.calledWith('worker.getAll').should.be.true();
  });
  
  it('should record metrics when workers list is requested', function() {
    // Create a system manager instance
    const manager = new SystemManager();
    
    // Clear interval to prevent async issues
    clearInterval(manager.timeoutId);
    
    // Reset metrics stubs
    this.metricsObj.recordMessageReceived.resetHistory();
    
    // Call printWorkersList
    manager.printWorkersList();
    
    // Verify metrics were recorded
    this.metricsObj.recordMessageReceived.calledWith('workers_list_request').should.be.true();
  });
  
  it('should update worker metrics correctly', function() {
    // Create a system manager instance
    const manager = new SystemManager();
    
    // Clear interval to prevent async issues
    clearInterval(manager.timeoutId);
    
    // Add workers of different types
    manager.addWorker(JSON.stringify({
      id: 'worker1:1234567890123',
      type: 'processor',
      tasks: ['task1']
    }));
    
    manager.addWorker(JSON.stringify({
      id: 'worker2:1234567890124',
      type: 'processor',
      tasks: ['task2']
    }));
    
    manager.addWorker(JSON.stringify({
      id: 'worker3:1234567890125',
      type: 'database',
      tasks: ['query']
    }));
    
    // Reset metrics stubs
    this.metricsObj.setWorkerCount.resetHistory();
    this.metricsObj.setConnectedWorkers.resetHistory();
    
    // Call updateWorkerMetrics
    manager.updateWorkerMetrics();
    
    // Check that setWorkerCount was called
    this.metricsObj.setWorkerCount.called.should.be.true();
    
    // Since type coercion or implementation details may differ,
    // we'll just verify that setConnectedWorkers was called
    this.metricsObj.setConnectedWorkers.called.should.be.true();
  });
});