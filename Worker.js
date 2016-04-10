// Parent Class of any worker
var logger = require('./logger.js');

function Worker(type) {
	logger.log("MicroService", "Worker", "Starting client");
	this.type = type;
	this.id = type+new Date().getTime();
	this.pub;
	this.notifications_error_sub;
	this.notifications_getAll_sub;

	var self=this;
	this.context = require('rabbit.js').createContext('amqp://localhost');
	this.context.on('ready', function() {
  		self.pub = self.context.socket('PUB', {routing: 'topic'});
		self.notifications_error_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_getAll_sub = self.context.socket('SUB', {routing: 'topic'});
  		self.pub.connect('notifications', function() {
			logger.log("MicroService", "Worker", "Connected to notifications");
			self.pub.publish("worker.new", JSON.stringify(self.getConfig()));
  		});
		self.notifications_error_sub.connect('notifications', 'error', function() {
			logger.log("MicroService", "Worker", "Connected to notification, Topic error");
			self.notifications_error_sub.on('data', function(data) {
				self.receiveError(data);
			});
		});
		self.notifications_getAll_sub.connect('notifications', 'worker.getAll', function() {
			logger.log("microService", "Worker", "Connected to notifications, Topic worker.getAll");
			self.notifications_getAll_sub.on('data', function(data) {
				self.pub.publish("worker.new", JSON.stringify(self.getConfig()));
			});
		});
	});

	process.on('SIGINT', function() {
		self.kill();
		setTimeout(process.exit, 500); // Mandatory. If no timeout, the end of the process occurs before the message to be sent.
	});
}

Worker.prototype.getConfig = function() {
	return {id: this.id, type: this.type};
}

Worker.prototype.kill = function() {
	logger.log("MicroService", "Worker", "Stopping client");
	this.pub.publish('worker.del', JSON.stringify(this.getConfig()));
}

Worker.prototype.sendToNextWorker = function(next_workers, data) {
	logger.log("MicroService", "Worker", "Sending data to the next worker on the list");
	this.pub.publish('worker.next', JSON.stringify({workers_list: next_workers, data: data, sender: this.getConfig()}));
}

Worker.prototype.receiveError = function(error) {
	logger.log("MicroService", "Worker", "Receiving error: "+error, "ERROR");
	var e = JSON.parse(error);
	if (e.target.id = this.id) {
		logger.log("MicroService", "Worker", "Error is for this worker. Do something", "ERROR");
		this.treatError(error);
	} else {
		// DO NOTHING, ERROR NOT FOR THIS WORKER
	}
}

// Need to be surcharged by any child class
Worker.prototype.treatError = function(error) {

}

module.exports = Worker;
