// Parent Class of any worker
var logger = require('./logger.js');
var config = require('./config/config.json');
var Compressor = require('./Compressor.js');

function Worker(type) {
	this.type = type;
	this.id = type+":"+new Date().getTime();
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Starting client - type: "+type+", id: "+this.id);
	this.compressor = new Compressor();
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
	const rabbitAdapter = require('./RabbitAdapter');
	this.context = rabbitAdapter.createContext(config.broker_url);
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
					if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notifications");
					self.pub.publish("worker.new.send", self.compressor.serialize(self.getConfig()));
				});
			});
  		});
		self.notifications_workerdel_sub.connect('notifications', 'worker.del', function() {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notification, Topic worker.del");
			self.notifications_workerdel_sub.on('data', function(data) {
				self.delWorker(data);
			});
		});
		self.notifications_error_sub.connect('notifications', 'error', function() {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notification, Topic error");
			self.notifications_error_sub.on('data', function(data) {
				self.receiveError(data);
			});
		});
		self.notifications_getAll_sub.connect('notifications', 'worker.getAll', function() {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notifications, Topic worker.getAll");
			self.notifications_getAll_sub.on('data', function(data) {
				self.pub.publish("worker.new.resend", self.compressor.serialize(self.getConfig()));
			});
		});
		self.notifications_nextjob_sub.connect('notifications', 'worker.next', function() {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notifications, Topic worker.next");
			self.notifications_nextjob_sub.on('data', function(data) {
				self.receiveNextJob(data);
			});
		});
		self.notifications_nextjoback_sub.connect('notifications', 'worker.next.ack', function() {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+self.id, "Connected to notifications, Topic worker.next.ack");
			self.notifications_nextjoback_sub.on('data', function(data) {
				self.receiveNextJobAck(data);
			});
		});
	});

	process.on('SIGINT', function() {
		self.kill();
		setTimeout(process.exit, 200); // Mandatory. If no timeout, the end of the process occurs before the message to be sent.
	});
}

Worker.prototype.getConfig = function() {
	return {id: this.id, type: this.type};
}

Worker.prototype.kill = function() {
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Stopping client");
	for (var i in this.sameTypeWorkers) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "sameTypeWorker["+i+"] = "+JSON.stringify(this.sameTypeWorkers[i]));
	}
	for (var j in this.jobsSent) {
		clearTimeout(this.jobsSent[j].timeoutId);
	}
	this.pub.publish('worker.del', this.compressor.serialize(this.getConfig()));
	this.notifications_error_sub.close();
	this.notifications_getAll_sub.close();
	this.notifications_newworker_sub.close();
	this.notifications_workerdel_sub.close();
	this.notifications_workerslist_sub.close();
	this.notifications_nextjob_sub.close();
	this.notifications_nextjoback_sub.close();
	this.pub.end();
}

Worker.prototype.sendToNextWorker = function(next_workers, data, workers_list_id, jobId, tries) {
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Sending data to the next worker on the list.");
	var self = this;
	var job_to_send = {timeoutId: null, job: {workers_list: next_workers, workers_list_id: (workers_list_id?workers_list_id:0), data: data, sender: this.getConfig(), id: (jobId?jobId:"J"+new Date().getTime())}, tries: (tries?tries:1)};
	this.pub.publish('worker.next', this.compressor.serialize(job_to_send.job));
	job_to_send.timeoutId = setTimeout(function() {self.resend(next_workers, job_to_send)}, 2000);
	if (!tries) this.jobsSent.push(job_to_send);
	else this.updateJobsSent(job_to_send);
}

Worker.prototype.updateJobsSent = function(job) {
	for (var i in this.jobsSent) {
		if (job.job.id == this.jobsSent[i].job.id) {
			this.jobsSent[i]=job;
			return true;
		}
	}
	return false;
}

Worker.prototype.resend = function(next_workers, job_to_send) {
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "No worker took the job, resending it");
	clearTimeout(job_to_send.timeoutId);
	job_to_send.timeoutId=null;
	if (job_to_send.tries >= this.job_retry) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Job Send " + this.job_retry + " times. Stopping", "ERROR");
		return this.treatError({error: "Job send too many times", data: job_to_send.job.data});
	}
	this.sendToNextWorker(next_workers, job_to_send.job.data, job_to_send.job.workers_list_id, job_to_send.job.id, (job_to_send.tries+1));
}

Worker.prototype.receiveError = function(error) {
	var e = this.compressor.deserialize(error);
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Receiving error: "+JSON.stringify(e), "ERROR");
	if (e.target == this.id) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Error is for this worker. Do something", "ERROR");
		this.clearJobTimeout(e.id, "ERROR");
		this.treatError(e);
	} else {
		// DO NOTHING, ERROR NOT FOR THIS WORKER
	}
}

// Need to be surcharged by any child class
Worker.prototype.treatError = function(error) {

}

Worker.prototype.receiveNextJob = function(data) {
	var oData = this.compressor.deserialize(data);
	var nextId = oData.workers_list[oData.workers_list_id];
	// Manage the case where the worker is directly reached. Specific format on workers_list
	if (nextId.match(new RegExp(this.type+":[0-9]{13}"))) {
		if (nextId == this.id) {
		//take it even if it's not the one who should
			if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Receiving a job for this worker specificly");
			this.activateJob(oData, true);
		}
	} else {
		if (this.nextJobForMe && nextId == this.type+":*") {
			this.activateJob(oData);
		}
	}
}

Worker.prototype.activateJob = function(oData, ignoreUpdate) {
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Receiving next job: "+JSON.stringify(oData));
	if (oData.workers_list.length > (oData.workers_list_id+1))  {oData.workers_list_id = (oData.workers_list_id+1);}
	if (ignoreUpdate) {oData.ignoreUpdate = ignoreUpdate;}
	this.pub.publish("worker.next.ack", this.compressor.serialize(oData));
	this.doJob(oData);
}

// Need to be surcharged by any child class
Worker.prototype.doJob = function(data) {

}

Worker.prototype.receiveNextJobAck = function(data) {
	var oData = this.compressor.deserialize(data);
	if (oData.sender.type == this.type) {
		if (oData.sender.id == this.id) {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Receiving next job Ack: "+JSON.stringify(oData));
			this.clearJobTimeout(oData.id, "INFO");	
			this.deleteJobSent(oData);
		}
		if (!oData.ignoreUpdate) this.updateSameTypeWorkers();
	}
}

Worker.prototype.clearJobTimeout = function(jobId, LEVEL) {
	for (var i in this.jobsSent) {
		if (this.jobsSent[i].job.id == jobId) {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Job found. Deleting timeout: "+jobId, LEVEL);
			clearTimeout(this.jobsSent[i].timeoutId);
			this.jobsSent[i].timeoutId = null;
		}
	}
}

Worker.prototype.deleteJobSent = function(job) {
	for (var i in this.jobsSent) {
		if (this.jobsSent[i].job.id == job.id) {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Deleting job :"+JSON.stringify(job));
			this.jobsSent.splice(i, 1);
			break;
		}
	}
}

// Add a new worker on the list if another worker of the same type announce itself on the bus
Worker.prototype.newWorker = function(worker) {
	var oWorker = this.compressor.deserialize(worker);
	if (oWorker.type == this.type) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "New Worker add on the list of worker type "+this.type+" : "+JSON.stringify(oWorker));
		var size = this.sameTypeWorkers.push({worker: oWorker, isNext: false});
		this.updateSameTypeWorkers();
		if (this.sameTypeWorkers[0].worker.id == this.id && oWorker.id != this.id) {
			if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "First on the list, sending list to others");
			this.pub.publish('worker.list', this.compressor.serialize(this.sameTypeWorkers));
		}
	}
}

Worker.prototype.delWorker = function(worker) {
	var oWorker = this.compressor.deserialize(worker);
	if (oWorker.type == this.type) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Removing a worker on the list");
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
	var oWorkers_list = this.compressor.deserialize(workers_list);
	if (oWorkers_list[0].worker.type == this.type) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "Updating Workers List");
		this.sameTypeWorkers = oWorkers_list;
	}
}

Worker.prototype.setNextJobForMe = function(forMe) {
	this.nextJobForMe = forMe;
}

Worker.prototype.updateSameTypeWorkers = function(position) {
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "UpdateSameTypeWorkers : "+position);
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
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "--------------------------------------------------");
	if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, "this.nextJobForMe: "+this.nextJobForMe);
	for (var i in this.sameTypeWorkers) {
		if (config.Worker_log) logger.log("MicroService", "Worker - "+this.id, JSON.stringify(this.sameTypeWorkers[i]));
	}
}

module.exports = Worker;
