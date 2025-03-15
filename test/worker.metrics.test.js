const sinon = require('sinon');
const should = require('should');
const proxyquire = require('proxyquire');

describe('Worker Metrics Integration - Direct Tests', function() {
  let Worker, metricsObj, metricsModuleStub, contextMock, configMock, rabbitAdapterMock;
  
  beforeEach(function() {
    // Create metrics stubs
    metricsObj = {
      recordMessageReceived: sinon.stub(),
      recordMessageSent: sinon.stub(),
      startJobTimer: sinon.stub().returns(() => {}),
      setWorkerCount: sinon.stub(),
      setConnectedWorkers: sinon.stub(),
      recordError: sinon.stub()
    };
    
    // Create metrics module stub
    metricsModuleStub = {
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
      contextMock.readyCallback = callback;
    });
    
    // RabbitAdapter mock
    rabbitAdapterMock = {
      createContext: sinon.stub().returns(contextMock)
    };
    
    // Compressor mock
    const compressorMock = function() {
      return {
        serialize: sinon.stub().callsFake(o => JSON.stringify(o)),
        deserialize: sinon.stub().callsFake(s => typeof s === 'string' ? JSON.parse(s) : s)
      };
    };
    
    // Config mock
    configMock = {
      broker_url: 'amqp://localhost',
      Worker_log: false
    };
    
    // Proxyquire to replace dependencies
    Worker = proxyquire('../Worker.js', {
      './logger.js': { log: sinon.stub() },
      './config/config.json': configMock,
      './RabbitAdapter': rabbitAdapterMock,
      './metrics.js': metricsModuleStub,
      './Compressor.js': compressorMock
    });
    
    // Store metrics stubs for assertions
    this.metricsObj = metricsObj;
    this.pubSocketMock = pubSocketMock;
    this.subSocketMock = subSocketMock;
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  it('should initialize metrics when created', function() {
    const worker = new Worker('TestWorker');
    
    // Verify metrics was initialized with correct service name
    metricsModuleStub.initMetrics.calledWith('worker-TestWorker').should.be.true();
    
    // Check that worker has metrics property
    should.exist(worker.metrics);
  });
  
  it('should record metrics when sending a job to next worker', function() {
    const worker = new Worker('TestWorker');
    
    // Manually set up required objects
    contextMock.readyCallback();
    
    // Prepare test data
    const nextWorkers = ['WorkerType:*'];
    const data = { test: 'data' };
    
    // Set up metrics to be tested
    metricsObj.recordMessageSent.resetHistory();
    
    // Call the method
    worker.sendToNextWorker(nextWorkers, data);
    
    // Verify message publish was attempted
    worker.pub.publish.called.should.be.true();
    
    // Verify metrics recording was attempted
    metricsObj.recordMessageSent.called.should.be.true();
  });
  
  it('should record metrics when job retry is needed', function() {
    const worker = new Worker('TestWorker');
    
    // Clear context handlers to prevent errors
    contextMock.readyCallback();
    
    // Create a job that needs to be resent
    const nextWorkers = ['WorkerType:*'];
    const jobToSend = {
      timeoutId: null,
      job: {
        workers_list: nextWorkers,
        workers_list_id: 0,
        data: { test: 'data' },
        sender: worker.getConfig(),
        id: 'test-job-id'
      },
      tries: 1
    };
    
    // Mock the sendToNextWorker method to prevent actual sending
    sinon.stub(worker, 'sendToNextWorker');
    
    // Call the resend method
    worker.resend(nextWorkers, jobToSend);
    
    // Verify error metric was recorded
    this.metricsObj.recordError.calledWith('job_retry').should.be.true();
  });
  
  it('should record metrics when max retries are exceeded', function() {
    const worker = new Worker('TestWorker');
    
    // Clear context handlers to prevent errors
    contextMock.readyCallback();
    
    // Create a job that has reached max retries
    const nextWorkers = ['WorkerType:*'];
    const jobToSend = {
      timeoutId: null,
      job: {
        workers_list: nextWorkers,
        workers_list_id: 0,
        data: { test: 'data' },
        sender: worker.getConfig(),
        id: 'test-job-id'
      },
      tries: 6 // Exceeds the default job_retry of 5
    };
    
    // Mock treatError method
    sinon.stub(worker, 'treatError');
    
    // Call the resend method
    worker.resend(nextWorkers, jobToSend);
    
    // Verify error metrics were recorded
    this.metricsObj.recordError.getCalls().should.matchAny(function(call) {
      return call.args[0] === 'job_retry';
    });
    
    this.metricsObj.recordError.getCalls().should.matchAny(function(call) {
      return call.args[0] === 'job_max_retries_exceeded';
    });
    
    // Verify treatError was called
    worker.treatError.calledOnce.should.be.true();
  });
  
  it('should record metrics when activating a job', function() {
    const worker = new Worker('TestWorker');
    
    // Clear context handlers to prevent errors
    contextMock.readyCallback();
    
    // Mock the doJob method
    sinon.stub(worker, 'doJob');
    
    // Create job data
    const jobData = {
      workers_list: ['WorkerType:*'],
      workers_list_id: 0,
      data: { test: 'data' }
    };
    
    // Call activateJob
    worker.activateJob(jobData);
    
    // Verify job activation was recorded
    this.metricsObj.recordMessageReceived.calledWith('job_activated').should.be.true();
    
    // Verify job timer was started
    this.metricsObj.startJobTimer.calledWith('job_processing').should.be.true();
    
    // Verify timer was stored with the job data
    worker.doJob.calledOnce.should.be.true();
    const jobDataPassedToDoJob = worker.doJob.getCall(0).args[0];
    should.exist(jobDataPassedToDoJob.metricTimer);
  });
  
  it('should record metrics when registering as a worker', function() {
    const worker = new Worker('TestWorker');
    
    // Simulate worker registration
    // Call ready callback
    contextMock.readyCallback();
    
    // Manually trigger the worker registration
    worker.pub.publish("worker.new.send", "{}");
    
    // Reset the metrics to avoid counting the previous publish
    metricsObj.recordMessageSent.resetHistory();
    
    // Call the method that should record metrics
    const registerFn = worker.pub.connect.getCalls().find(call => 
      call.args[0] === 'notifications'
    );
    
    if (registerFn && registerFn.args[1]) {
      registerFn.args[1]();
    }
    
    // Now check that worker registration is being tracked
    worker.pub.publish("worker.new.send", worker.compressor.serialize(worker.getConfig()));
    
    // Verify worker registration metrics - at least one message was sent
    metricsObj.recordMessageSent.called.should.be.true();
  });
});