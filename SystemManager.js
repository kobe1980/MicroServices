var logger = require('./logger.js');
var config = require('./config/config.json');
var Compressor = require('./Compressor.js');

function SystemManager() {
	this.id = "SM"+new Date().getTime();
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Starting server");
	this.workers_list = Array();
	this.context = require('rabbit.js').createContext(config.broker_url);
	this.notification_newworker_sub;
	this.notification_delworker_sub;
	this.notification_nextjob_sub;
	this.polling_sub;
	this.pub;
	this.timeoutId;
	this.compressor = new Compressor();
	var self=this;
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Starting SystemManager");
	this.context.on('ready', function() {
        	self.notification_newworker_sub = self.context.socket('SUB', {routing: 'topic'});
	        self.notification_newworker_sub.connect('notifications', 'worker.new.*',  function() {
        	        if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Connected to Channel notifications, New worker topic");
                	self.notification_newworker_sub.on('data', function(data){
                        	self.addWorker(data);
	                });
			self.pub = self.context.socket('PUB', {routing: 'topic'});
			self.pub.connect('notifications', function() {
				if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Connected to notifications, ready to send messages");
				self.keepAlive();
			});
        	});
		self.notification_nextjob_sub = self.context.socket('SUB', {routing: 'topic'});
       		self.notification_nextjob_sub.connect('notifications', 'worker.next', function() {
			if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Connected to channel notifications, Next Job Topic");
			self.notification_nextjob_sub.on('data', function(data) {
				var nJobData = self.compressor.deserialize(data);
				if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "A new task is waiting for a worker: "+JSON.stringify(nJobData));
				if (self.listenForJobRequest(nJobData)) {
					if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Next Job can be done by at least one worker");
				} else {
					if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "No worker of the good type");
					self.pub.publish('error', self.compressor.serialize({target: nJobData.sender, error: "No worker available for this job", id: nJobData.id, data: nJobData.data}));
				}
			});	
		});
		self.notification_delworker_sub = self.context.socket('SUB', {routing: 'topic'});
		self.notification_delworker_sub.connect('notifications', 'worker.del', function() {
			if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Connected to channel notifications, Delete Worker Topic");
			self.notification_delworker_sub.on('data', function(data) {
				self.delWorker(data);
			});
		});	
		self.polling_sub = self.context.socket('SUB', {routing: 'topic'});
		self.polling_sub.connect('polling', 'worker.list', function() {
			if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+self.id, "Connected to Channel polling, Workers list topic");
			self.polling_sub.on('data', function() {
				self.printWorkersList();
			});
		});
		
	});
	if (config.keepalive) {
		this.timeoutId = setInterval(function() {self.keepAlive();}, config.keepalive);
	}
	process.on('SIGINT', function() {
		self.kill();
		setTimeout(process.exit, 200); // Mandatory. If no timeout, the end of the process occurs before the message to be sent.
	});
}

SystemManager.prototype.kill = function() {
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Stopping SystemManager");
	clearInterval(this.timeoutId);
	this.notification_newworker_sub.close();
	this.notification_delworker_sub.close();
	this.notification_nextjob_sub.close();
	this.polling_sub.close();
	this.pub.end();
}

SystemManager.prototype.addWorker = function(worker) {
	var rWorker = this.compressor.deserialize(worker);
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "New Worker in the list:" + JSON.stringify(rWorker));
	this.workers_list[rWorker.id] = rWorker;
}

SystemManager.prototype.keepAlive = function() {
	this.pub.publish('worker.getAll', "Hi workers, tell me who's online");
}
	
SystemManager.prototype.printWorkersList = function() {
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Request received for Workers list" + this.workers_list);
	for (var i in this.workers_list) {
		if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Worker: "+JSON.stringify(this.workers_list[i]));
	}
	if (i == undefined) 
		if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "Empty set.");		
}

SystemManager.prototype.delWorker = function(worker) {
	var o = this.compressor.deserialize(worker);
	if (config.SystemManager_log) logger.log("MicroService", "SystemManager - "+this.id, "removing worker " + JSON.stringify(o) + " from workers list");
	delete this.workers_list[o.id];
}

SystemManager.prototype.listenForJobRequest = function(request) {
	var nextId = request.workers_list[request.workers_list_id];
	if (nextId.match(/.+:[0-9]{13}/)) {
		for (var i in this.workers_list) {
			if (this.workers_list[i].id == nextId) return true;
		}
	} else {
		var m = nextId.match(/(.+):\*/)
		if (m && m.length>1) {
			for (var i in this.workers_list) {
				if (this.workers_list[i].type == m[1]) return true;
			}
		}

	}
	return false;
}

module.exports = SystemManager; //export for test purpose
