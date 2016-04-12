// Child class of Worker dedicated to DB connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var DBW = new Worker("WB");
DBW.treatError = function(error) {
	logger. log("MicroService", "Worker B - DB connector", "Error received");
}

DBW.doJob = function(data) {
	logger.log("MicroService", "Worker B - DB connector", "Job to do: "+JSON.stringify(data));
	var nextWorkers = data.workers_list;
	nextWorkers.splice(0,1);
	if (data.data.method == "GET") {
		return this.sendToNextWorker(nextWorkers, {content: this.getFromDB(), resId: data.data.resId});
	}
	if (data.data.method == "POST") {
		return this.sendToNextWorker(nextWorkers, {content: this.storeInDB(), resId: data.data.resId});
	}
}

DBW.storeInDB = function(data) {
	// DO Whatever
	return "OK";
}

DBW.getFromDB = function() {
	// DO Whatever
	return {title: "This is a fact movie", description: "This fact movie is awesome"};
}
