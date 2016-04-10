var logger = require('./logger.js');
var auto_config = {id: "WA"+new Date().getTime(), type: "WA"};

logger.log("MicroService", "Helper", "Starting client");

var context = require('rabbit.js').createContext('amqp://localhost');
var pub; //subscriber to all events
context.on('ready', function() {
  pub = context.socket('PUB', {routing: 'topic'});
  pub.connect('polling', function() {
	logger.log("MicroService", "Helper", "Connected to polling");
	pub.publish("worker.list", "Give me the worker list");
  });
});

