// Child class of Worker dedicated to DB connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var DBW = new Worker("WB");
DBW.treatError = function(error) {
	logger. log("MicroService", "Worker B - DB connector", "Error received");
}

DBW.doJob = function(data) {
	logger.log("MicroService", "Worker B - DB connector", "Job to do: "+JSON.stringify(data));
}

DBW.storeInDB = function(data) {
	// DO Whatever
}

DBW.getFromDB = function() {
	// DO Whatever
}

setTimeout(function() {DBW.sendToNextWorker(["WA", "WB"], {title: "toto"});}, 500);
