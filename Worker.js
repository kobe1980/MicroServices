// Parent Class of any worker
var logger = require('./logger.js');

function Worker(type) {
	this.type = type;
	this.id = type+new Date().getTime();
	logger.log("MicroService", "Worker", "Starting client - type: "+type+", id: "+this.id);
	this.pub;
	this.notifications_error_sub;
	this.notifications_newworker_sub;
	this.notifications_workerslist_sub;
	this.notifications_getAll_sub;
	this.notifications_workerdel_sub;
	this.notifications_nextjob_sub;
	this.notifications_nextjoback_sub;
	this.nextJobForMe = true; // boolean: when worker is in a pool of workers of the same type, they have to determine who's next.
	this.jobsSent = Array();
	this.job_retry=5; //nb of retry
	this.sameTypeWorkers = Array();

	var self=this;
	this.context = require('rabbit.js').createContext('amqp://localhost');
	this.context.on('ready', function() {
  		self.pub = self.context.socket('PUB', {routing: 'topic'});
		self.notifications_error_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_getAll_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_newworker_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_workerdel_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_workerslist_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_nextjob_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_nextjoback_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notifications_newworker_sub.connect('notifications', 'worker.new.send', function() {
			self.notifications_workerslist_sub.connect('notifications', 'worker.list', function() {
				self.notifications_workerslist_sub.on('data', function(data) {
					self.updateWorkersList(data);
				});
				self.notifications_newworker_sub.on('data', function(data) {
					self.newWorker(data);
				});
	  			self.pub.connect('notifications', function() {
					logger.log("MicroService", "Worker", "Connected to notifications");
					self.pub.publish("worker.new.send", JSON.stringify(self.getConfig()));
				});
			});
  		});
		self.notifications_workerdel_sub.connect('notifications', 'worker.del', function() {
			logger.log("MicroService", "Worker", "Connected to notification, Topic worker.del");
			self.notifications_workerdel_sub.on('data', function(data) {
				self.delWorker(data);
			});
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
				self.pub.publish("worker.new.resend", JSON.stringify(self.getConfig()));
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
	// setInterval(function() {self.printSameTypeWorkers();}, 8000); // print workers list for debug
}

Worker.prototype.getConfig = function() {
	return {id: this.id, type: this.type};
}

Worker.prototype.kill = function() {
	logger.log("MicroService", "Worker", "Stopping client");
	this.pub.publish('worker.del', JSON.stringify(this.getConfig()));
	for (var i in this.sameTypeWorkers) {
		logger.log("MicroService", "Worker", "sameTypeWorker["+i+"] = "+JSON.stringify(this.sameTypeWorkers[i]));
	}
}

Worker.prototype.sendToNextWorker = function(next_workers, data, jobId, tries) {
	logger.log("MicroService", "Worker", "Sending data to the next worker on the list.");
	var self = this;
	var job_to_send = {timeoutId: null, job: {workers_list: next_workers, data: data, sender: this.getConfig(), id: (jobId?jobId:"J"+new Date().getTime())}, tries: (tries?tries:1)};
	this.pub.publish('worker.next', JSON.stringify(job_to_send.job));
	job_to_send.timeoutId = setTimeout(function() {self.resend(next_workers, job_to_send)}, 2000);
	this.jobsSent.push(job_to_send);
}

Worker.prototype.resend = function(next_workers, job_to_send) {
	logger.log("MicroService", "Worker", "No worker took the job, resending it");
	clearTimeout(job_to_send.timeoutId);
	if (job_to_send.tries >= this.job_retry) {
		logger.log("MicroService", "Worker", "Job Send " + this.job_retry + " times. Stopping", "ERROR");
		return this.treatError({error: "Job send too many times"});
	}
	this.sendToNextWorker(next_workers, job_to_send.job.data, job_to_send.job.id, (job_to_send.tries+1));
}

Worker.prototype.receiveError = function(error) {
	logger.log("MicroService", "Worker", "Receiving error: "+error, "ERROR");
	var e = JSON.parse(error);
	if (e.target.id == this.id) {
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
	this.updateSameTypeWorkers();
}

Worker.prototype.clearJobTimeout = function(jobId, LEVEL) {
	for (var i in this.jobsSent) {
		if (this.jobsSent[i].job.id == jobId) {
			logger.log("MicroService", "Worker", "Job found. Deleting timeout: "+jobId, LEVEL);
			clearTimeout(this.jobsSent[i].timeoutId);
		}
	}
}

// Add a new worker on the list if another worker of the same type announce itself on the bus
Worker.prototype.newWorker = function(worker) {
	oWorker = JSON.parse(worker);
	if (oWorker.type == this.type) {
		logger.log("MicroService", "Worker", "New Worker add on the list of worker type "+this.type);
		var size = this.sameTypeWorkers.push({worker: oWorker, isNext: false});
		this.updateSameTypeWorkers();
		if (this.sameTypeWorkers[0].worker.id == this.id && oWorker.id != this.id) {
			logger.log("MicroService", "Worker", "First on the list, sending list to others");
			this.pub.publish('worker.list', JSON.stringify(this.sameTypeWorkers));
		}
	}
}

Worker.prototype.delWorker = function(worker) {
	oWorker = JSON.parse(worker);
	if (oWorker.type == this.type) {
		logger.log("MicroService", "Worker", "Removing a worker on the list");
		for (var i in this.sameTypeWorkers) {
			if (this.sameTypeWorkers[i].worker.id == oWorker.id) {
				this.sameTypeWorkers.splice(i, 1);
				this.updateSameTypeWorkers((i>this.sameTypeWorkers.length-1)?0:i);
				break;
			}
		}
	}
}

Worker.prototype.updateWorkersList = function(workers_list) {
	logger.log("MicroService", "Worker", "Updating Workers List");
	this.sameTypeWorkers = JSON.parse(workers_list);
}

Worker.prototype.setNextJobForMe = function(forMe) {
	this.nextJobForMe = forMe;
}

Worker.prototype.updateSameTypeWorkers = function(position) {
	logger.log("MicroService", "Worker", "UpdateSameTypeWorkers : "+position);
	if (position) {
		for (var i in this.sameTypeWorkers) {
			if (i == position) {
				this.sameTypeWorkers[i].isNext = true;
				if (this.sameTypeWorkers[i].worker.id == this.id) this.setNextJobForMe(true);
			} else {
				this.sameTypeWorkers[i].isNext = false;
			}
		}
	} else {
		if (this.sameTypeWorkers.length == 1) this.sameTypeWorkers[0].isNext = true;
		else {
			for (var i in this.sameTypeWorkers) {
				if (this.sameTypeWorkers[i].isNext == true) {
					var nextWorker = ((i/1+1) >= this.sameTypeWorkers.length?0:(i/1+1));
					this.sameTypeWorkers[i].isNext=false;
					this.sameTypeWorkers[nextWorker].isNext=true;
					if (this.sameTypeWorkers[nextWorker].worker.id == this.id) this.setNextJobForMe(true);
					else this.setNextJobForMe(false);
					break;
				}
			}
		}
	}	
}

Worker.prototype.printSameTypeWorkers = function() {
	logger.log("MicroService", "Worker", "--------------------------------------------------");
	logger.log("MicroService", "Worker", "this.nextJobForMe: "+this.nextJobForMe);
	for (var i in this.sameTypeWorkers) {
		logger.log("MicroService", "Worker", JSON.stringify(this.sameTypeWorkers[i]));
	}
}

module.exports = Worker;
