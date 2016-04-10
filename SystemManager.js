var logger = require('./logger.js');
var config = require('./config/config.json');
logger.log("MicroService", "SystemManager", "Starting server");

function SystemManager() {
	this.workers_list = Array();
	this.context = require('rabbit.js').createContext(config.broker_url);
	this.notification_newworker_sub;
	this.notification_delworker_sub;
	this.notification_nextjob_sub;
	this.polling_sub;
	this.pub;
	var self=this;
	this.context.on('ready', function() {
        	self.notification_newworker_sub = self.context.socket('SUB', {routing: 'topic'});
	        self.notification_newworker_sub.connect('notifications', 'worker.new',  function() {
        	        logger.log("MicroService", "SystemManager", "Connected to Channel notifications, New worker topic");
                	self.notification_newworker_sub.on('data', function(data){
                        	self.addWorker(data);
	                });
			self.pub = self.context.socket('PUB', {routing: 'topic'});
			self.pub.connect('notifications', function() {
				logger.log("MicroService", "SystemManager", "Connected to notifications, ready to send messages");
				self.pub.publish('worker.getAll', "Hi workers, tell me who's online");
			});
        	});
		self.notification_nextjob_sub = self.context.socket('SUB', {routing: 'topic'});
       		self.notification_nextjob_sub.connect('notifications', 'worker.next', function() {
			logger.log("MicroService", "SystemManager", "Connected to channel notifications, Next Job Topic");
			self.notification_nextjob_sub.on('data', function(data) {
				logger.log("MicroService", "SystemManager", "A new task is waiting for a worker: "+data);
				var nJobData = JSON.parse(data);
				if (s.listenForJobRequest(nJobData)) {
					logger.log("MicroService", "SystemManager", "Next Job can be done by at least one worker");
				} else {
					logger.log("MicroService", "SystemManager", "No worker of the good type");
					self.pub.publish('error', JSON.stringify({target: nJobData.sender, error: "No worker available for this job"}));
				}
			});	
		});
		self.notification_delworker_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notification_delworker_sub.connect('notifications', 'worker.del', function() {
			logger.log("MicroService", "SystemManager", "Connected to channel notifications, Delete Worker Topic");
			self.notification_delworker_sub.on('data', function(data) {
				self.delWorker(data);
			});
		});	
		self.polling_sub = self.context.socket('SUB', {routing: 'topic'});
		self.polling_sub.connect('polling', 'worker.list', function() {
			logger.log("MicroService", "SystemManager", "Connected to Channel polling, Workers list topic");
			self.polling_sub.on('data', function() {
				self.printWorkersList();
			});
		});
		
	});

}

SystemManager.prototype.addWorker = function(worker) {
	var rWorker = JSON.parse(worker);
	logger.log("MicroService", "SystemManager", "New Worker in the list:" + worker);
	this.workers_list[rWorker.id] = rWorker;
}
	
SystemManager.prototype.printWorkersList = function() {
	logger.log("MicroService", "SystemManager", "Request received for Workers list" + this.workers_list);
	for (var i in this.workers_list) {
		logger.log("MicroService", "SystemManager", "Worker: "+JSON.stringify(this.workers_list[i]));
	}
	if (i == undefined) 
		logger.log("MicroService", "SystemManager", "Empty set.");		
}

SystemManager.prototype.delWorker = function(worker) {
	logger.log("MicroService", "SystemManager", "removing worker " + worker + " from workers list");
	var o = JSON.parse(worker);
	delete this.workers_list[o.id];
}

SystemManager.prototype.listenForJobRequest = function(request) {
	var requestType = request.workers_list[0];
	for (var i in this.workers_list) {
		if (this.workers_list[i].type == requestType) return true;
	}
	return false;
}

var s = new SystemManager();