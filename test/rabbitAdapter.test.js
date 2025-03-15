const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const EventEmitter = require('events');

// Create mocks for the modules
const amqpMock = {
  connect: sinon.stub()
};

const loggerMock = {
  log: sinon.stub()
};

// Use proxyquire to inject our mocks
const rabbitAdapter = proxyquire('../RabbitAdapter', {
  'amqplib': amqpMock,
  './logger.js': loggerMock
});

describe('RabbitAdapter', function() {
  let mockConnection, mockChannel, mockConsume;
  
  beforeEach(function() {
    // Set up mocks for amqplib
    mockChannel = {
      assertExchange: sinon.stub().resolves({}),
      assertQueue: sinon.stub().resolves({ queue: 'test-queue' }),
      bindQueue: sinon.stub().resolves({}),
      consume: sinon.stub().callsFake((queue, callback) => {
        mockConsume = callback;
        return Promise.resolve({ consumerTag: 'consumer-tag' });
      }),
      publish: sinon.stub().returns(true),
      ack: sinon.stub(),
      cancel: sinon.stub()
    };
    
    mockConnection = {
      createChannel: sinon.stub().resolves(mockChannel),
      on: sinon.stub()
    };
    
    // Setup the amqplib connect mock
    amqpMock.connect.resolves(mockConnection);
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  describe('createContext', function() {
    it('should create a context with the provided URL', async function() {
      const context = rabbitAdapter.createContext('amqp://test-host');
      
      assert.strictEqual(context instanceof Object, true);
      assert.strictEqual(context.url, 'amqp://test-host');
      
      // Wait for connection initialization to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      sinon.assert.calledWith(amqpMock.connect, 'amqp://test-host');
    });
    
    it('should handle connection errors in context creation', async function() {
      amqpMock.connect.rejects(new Error('Context creation error'));
      
      // Create context - this should not throw despite the error
      const context = rabbitAdapter.createContext('amqp://test-host');
      
      // Wait for error handling to occur
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Just verify that an error was logged
      assert(loggerMock.log.called, 'Error should be logged');
      
      // Reset for other tests
      amqpMock.connect.resolves(mockConnection);
    });
  });
  
  describe('Context', function() {
    let context;
    
    beforeEach(async function() {
      context = rabbitAdapter.createContext('amqp://test-host');
      // Wait for connection initialization to complete
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    it('should create sockets of the specified type', function() {
      const pubSocket = context.socket('PUB');
      const subSocket = context.socket('SUB');
      
      assert.strictEqual(pubSocket.type, 'PUB');
      assert.strictEqual(subSocket.type, 'SUB');
    });
    
    it('should throw an error for invalid socket types', function() {
      assert.throws(() => {
        context.socket('INVALID');
      }, /Invalid socket type/);
    });
    
    it('should emit ready event after connection', async function() {
      const readyCallback = sinon.stub();
      
      // Create a new instance via internal constructor
      const RabbitContext = rabbitAdapter.createContext('amqp://test-host').constructor;
      const newContext = new RabbitContext('amqp://test-host');
      newContext.on('ready', readyCallback);
      
      await newContext.connect();
      
      sinon.assert.called(readyCallback);
    });
    
    it('should handle connection errors', async function() {
      amqpMock.connect.rejects(new Error('Connection failed'));
      
      // Create a new instance via internal constructor
      const RabbitContext = rabbitAdapter.createContext('amqp://test-host').constructor;
      const newContext = new RabbitContext('amqp://test-host');
      const result = await newContext.connect();
      
      assert.strictEqual(result, false);
      // Should log the error
      sinon.assert.calledWith(
        loggerMock.log,
        'RabbitAdapter', 'Connection', 'Failed to connect: Connection failed', 'ERROR'
      );
      
      // Reset for other tests
      amqpMock.connect.resolves(mockConnection);
    });
    
    it('should handle connection error events', async function() {
      // Create a new connection and trigger an error event
      const newConnection = {
        createChannel: sinon.stub().resolves(mockChannel),
        on: sinon.stub().callsFake((event, callback) => {
          if (event === 'error') {
            // Call the error handler immediately to simulate an error
            callback(new Error('Connection error event'));
          }
        })
      };
      
      amqpMock.connect.resolves(newConnection);
      
      // Create a new context and connect
      const context = rabbitAdapter.createContext('amqp://test-host');
      
      // Wait for connection initialization to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error was logged
      sinon.assert.calledWith(
        loggerMock.log,
        'RabbitAdapter', 'Connection', 'Connection error: Connection error event', 'ERROR'
      );
      
      // Reset for other tests
      amqpMock.connect.resolves(mockConnection);
    });
  });
  
  describe('Socket', function() {
    let context, pubSocket, subSocket;
    
    beforeEach(async function() {
      context = rabbitAdapter.createContext('amqp://test-host');
      // Wait for connection to be established
      await new Promise(resolve => setTimeout(resolve, 50));
      
      pubSocket = context.socket('PUB');
      subSocket = context.socket('SUB');
    });
    
    it('should connect to an exchange', async function() {
      await pubSocket.connect('test-exchange', 'test.topic', sinon.stub());
      
      sinon.assert.calledWith(
        mockChannel.assertExchange,
        'test-exchange', 'topic', { durable: false }
      );
    });
    
    it('should set up subscriber properly', async function() {
      const callback = sinon.stub();
      await subSocket.connect('test-exchange', 'test.topic', callback);
      
      sinon.assert.called(mockChannel.assertQueue);
      sinon.assert.calledWith(
        mockChannel.bindQueue,
        'test-queue', 'test-exchange', 'test.topic'
      );
      sinon.assert.called(mockChannel.consume);
      sinon.assert.called(callback);
    });
    
    it('should emit data events for received messages', async function() {
      const dataCallback = sinon.stub();
      await subSocket.connect('test-exchange', 'test.topic', sinon.stub());
      
      subSocket.on('data', dataCallback);
      
      // Simulate receiving a message
      const testMessage = { content: Buffer.from('test message') };
      mockConsume(testMessage);
      
      sinon.assert.calledWith(dataCallback, Buffer.from('test message'));
      sinon.assert.calledWith(mockChannel.ack, testMessage);
    });
    
    it('should publish messages to the exchange', async function() {
      await pubSocket.connect('test-exchange', null, sinon.stub());
      
      pubSocket.publish('test.topic', 'test message');
      
      sinon.assert.calledWith(
        mockChannel.publish,
        'test-exchange', 
        'test.topic', 
        Buffer.from('test message')
      );
    });
    
    it('should handle buffer messages correctly', async function() {
      await pubSocket.connect('test-exchange', null, sinon.stub());
      
      const buffer = Buffer.from('test buffer');
      pubSocket.publish('test.topic', buffer);
      
      sinon.assert.calledWith(
        mockChannel.publish,
        'test-exchange', 
        'test.topic', 
        buffer
      );
    });
    
    it('should close the socket properly', async function() {
      await subSocket.connect('test-exchange', 'test.topic', sinon.stub());
      
      subSocket.close();
      
      sinon.assert.calledWith(mockChannel.cancel, 'test-queue');
    });
    
    it('should throw error when publishing without connecting first', function() {
      assert.throws(() => {
        pubSocket.publish('test.topic', 'test message');
      }, /Socket not connected to any exchange/);
    });
    
    it('should handle connection errors in socket.connect', async function() {
      // Setup mock to throw an error when assertExchange is called
      mockChannel.assertExchange.rejects(new Error('Socket connection error'));
      
      try {
        await pubSocket.connect('test-exchange', 'test.topic', sinon.stub());
        // Should not reach here
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Socket connection error');
        // Verify error was logged
        sinon.assert.calledWith(
          loggerMock.log,
          'RabbitAdapter', 'Socket', 'Error connecting socket: Socket connection error', 'ERROR'
        );
      }
      
      // Reset the mock for other tests
      mockChannel.assertExchange.resolves({});
    });
    
    it('should end the socket properly', function() {
      const closeSpy = sinon.spy(pubSocket, 'close');
      
      pubSocket.end();
      
      sinon.assert.calledOnce(closeSpy);
      
      // Restore original method
      closeSpy.restore();
    });
  });
});