// Child class of Worker dedicated to DB connection
var Worker = require("./Worker.js");
var logger = require("./logger.js");

var DBW = new Worker("WB");
DBW.treatError = function(error) {
	logger. log("MicroService", "Worker B - DB connector", "Error received");
}

DBW.prototype.storeInDB(data) {
	// DO Whatever
}

DBW.prototype.getFromDB() {
	// DO Whatever
}

setTimeout(function() {bddW.sendToNextWorker(["WA", "WB"], {title: "toto"});}, 500);
