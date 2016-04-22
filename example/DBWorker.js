// Child class of Worker dedicated to DB connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var DBW = new Worker("WB");
DBW.treatError = function(error) {
	logger. log("MicroService", "Worker B - DB connector", "Error received: "+JSON.stringify(error));
}

DBW.doJob = function(data) {
	logger.log("MicroService", "Worker B - DB connector", "Job to do: "+JSON.stringify(data));
	if (data.data.method == "GET") {
		return this.sendToNextWorker(data.workers_list, {content: this.getFromDB(), resId: data.data.resId, time: data.data.time}, data.workers_list_id);
	}
	if (data.data.method == "POST") {
		return this.sendToNextWorker(data.workers_list, {content: this.storeInDB(), resId: data.data.resId, time: data.data.time}, data.workers_list_id);
	}
}

DBW.storeInDB = function(data) {
	// DO Whatever
	return "OK";
}

DBW.getFromDB = function() {
	// DO Whatever
	return {title: "This is a fake movie", description: "This fact movie is awesome"};
}
