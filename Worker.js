// Parent Class of any worker
var logger = require('./logger.js');

function Worker(type) {
	logger.log("MicroService", "Worker", "Starting client");
	this.type = type;
	this.id = type+new Date().getTime();
	this.pub;
	this.notifications_error_sub;
	this.notifications_getAll_sub;
	this.notifications_nextjob_sub;
	this.notifications_nextjoback_sub;
	this.nextJobForMe = true; // boolean: when worker is in a pool of workers of the same type, they have to determine who's next.
	this.jobsSent = Array();

	var self=this;
	this.context = require('rabbit.js').createContext('amqp://localhost');
	this.context.on('ready', function() {
  		self.pub = self.context.socket('PUB', {routing: 'topic'});
		self.notifications_error_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_getAll_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_nextjob_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_nextjoback_sub = self.context.socket('SUB', {routing: 'topic'});
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
			logger.log("MicroService", "Worker", "Connected to notifications, Topic worker.getAll");
			self.notifications_getAll_sub.on('data', function(data) {
				self.pub.publish("worker.new", JSON.stringify(self.getConfig()));
			});
		});
		self.notifications_nextjob_sub.connect('notifications', 'worker.next', function() {
			logger.log("MicroService", "Worker", "Connected to notifications, Topic worker.next");
			self.notifications_nextjob_sub.on('data', function(data) {
				self.receiveNextJob(data);
			});
		});
		self.notifications_nextjoback_sub.connect('notifications', 'worker.next.ack', function() {
			logger.log("MicroService", "Worker", "Connected to notifications, Topic worker.next.ack");
			self.notifications_nextjoback_sub.on('data', function(data) {
				self.receiveNextJobAck(data);
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
	var self = this;
	var job_to_send = {timeoutId: null, job: {workers_list: next_workers, data: data, sender: this.getConfig(), id: "J"+new Date().getTime()}};
	this.pub.publish('worker.next', JSON.stringify(job_to_send.job));
	job_to_send.timeoutId = setTimeout(function() {self.resend(next_workers, job_to_send)}, 2000);
	this.jobsSent.push(job_to_send);
}

Worker.prototype.resend = function(next_workers, job_to_send) {
	logger.log("MicroService", "Worker", "No worker took the job, resending it");
	clearTimeout(job_to_send.timeoutId);
	this.sendToNextWorker(next_workers, job_to_send.job.data);
}

Worker.prototype.receiveError = function(error) {
	logger.log("MicroService", "Worker", "Receiving error: "+error, "ERROR");
	var e = JSON.parse(error);
	if (e.target.id = this.id) {
		logger.log("MicroService", "Worker", "Error is for this worker. Do something", "ERROR");
		this.clearJobTimeout(e.id, "ERROR");
		this.treatError(error);
	} else {
		// DO NOTHING, ERROR NOT FOR THIS WORKER
	}
}

// Need to be surcharged by any child class
Worker.prototype.treatError = function(error) {

}

Worker.prototype.receiveNextJob = function(data) {
	logger.log("MicroService", "Worker", "Receiving next job: "+data);
	oData = JSON.parse(data);
	if (this.nextJobForMe && oData.workers_list[0] == this.type) {
		this.pub.publish("worker.next.ack", data);
		this.doJob(oData);
	}
}

// Need to be surcharged by any child class
Worker.prototype.doJob = function(data) {

}

Worker.prototype.receiveNextJobAck = function(data) {
	logger.log("MicroService", "Worker", "Receiving next job Ack: "+data);
	oData = JSON.parse(data);
	this.clearJobTimeout(oData.id, "INFO");	
}

Worker.prototype.clearJobTimeout = function(jobId, LEVEL) {
	for (var i in this.jobsSent) {
		if (this.jobsSent[i].job.id == jobId) {
			logger.log("MicroService", "Worker", "Job found. Deleting timeout: "+jobId, LEVEL);
			clearTimeout(this.jobsSent[i].timeoutId);
		}
	}
}

module.exports = Worker;
