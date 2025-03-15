/**
 * RabbitAdapter - Adapter to make amqplib behave like rabbit.js
 * This module replaces the rabbit.js dependency with the modern amqplib
 */

const amqp = require('amqplib');
const EventEmitter = require('events');
const logger = require('./logger.js');

function RabbitContext(url) {
  this.url = url;
  this.connection = null;
  this.channel = null;
  this.exchanges = {};
  this.eventEmitter = new EventEmitter();

  // Mimic rabbit.js event
  this.on = (event, callback) => {
    this.eventEmitter.on(event, callback);
  };
}

RabbitContext.prototype.connect = async function() {
  try {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    this.eventEmitter.emit('ready');
    
    // Handle connection errors
    this.connection.on('error', (err) => {
      logger.log("RabbitAdapter", "Connection", "Connection error: " + err.message, "ERROR");
    });
    
    return true;
  } catch (error) {
    logger.log("RabbitAdapter", "Connection", "Failed to connect: " + error.message, "ERROR");
    return false;
  }
};

// Define socket types
const SOCKET_TYPES = {
  PUB: 'PUB',
  SUB: 'SUB'
};

// Socket implementation
function Socket(context, type, options) {
  this.context = context;
  this.type = type;
  this.options = options || {};
  this.exchange = null;
  this.queue = null;
  this.eventEmitter = new EventEmitter();
  
  // Mimic rabbit.js events
  this.on = (event, callback) => {
    this.eventEmitter.on(event, callback);
  };
}

Socket.prototype.connect = async function(exchange, routingKey, callback) {
  try {
    // Handle the case where routingKey is actually a callback (no routing key provided)
    if (typeof routingKey === 'function' && callback === undefined) {
      callback = routingKey;
      routingKey = '';
    }
    
    // Create the exchange if it doesn't exist
    await this.context.channel.assertExchange(exchange, 'topic', { durable: false });
    this.exchange = exchange;
    
    if (this.type === SOCKET_TYPES.SUB) {
      // For subscribers, create a unique queue and bind to the routing key
      const q = await this.context.channel.assertQueue('', { exclusive: true });
      this.queue = q.queue;
      
      // Use empty string as default if routingKey not provided
      const actualRoutingKey = routingKey || '';
      
      // Binding with routing key
      await this.context.channel.bindQueue(q.queue, exchange, actualRoutingKey);
      
      // Start consuming messages
      await this.context.channel.consume(q.queue, (msg) => {
        if (msg !== null) {
          this.eventEmitter.emit('data', msg.content);
          this.context.channel.ack(msg);
        }
      });
    }
    
    // Call the callback to signal successful connection
    if (callback && typeof callback === 'function') {
      callback();
    }
  } catch (error) {
    logger.log("RabbitAdapter", "Socket", "Error connecting socket: " + error.message, "ERROR");
    throw error;
  }
};

Socket.prototype.publish = function(routingKey, message) {
  if (!this.exchange) {
    throw new Error('Socket not connected to any exchange');
  }
  
  // Publish message to the exchange with the routing key
  return this.context.channel.publish(
    this.exchange, 
    routingKey, 
    Buffer.isBuffer(message) ? message : Buffer.from(message)
  );
};

Socket.prototype.close = function() {
  // Clean up resources
  if (this.queue) {
    this.context.channel.cancel(this.queue);
  }
};

Socket.prototype.end = function() {
  this.close();
};

// Factory methods
RabbitContext.prototype.socket = function(type, options) {
  if (!Object.values(SOCKET_TYPES).includes(type)) {
    throw new Error(`Invalid socket type: ${type}`);
  }
  
  return new Socket(this, type, options);
};

// Entry point - create a context
function createContext(url) {
  const context = new RabbitContext(url);
  // Connect immediately
  context.connect().catch(err => {
    logger.log("RabbitAdapter", "Context", "Failed to create context: " + err.message, "ERROR");
  });
  return context;
}

module.exports = {
  createContext,
  SOCKET_TYPES
};