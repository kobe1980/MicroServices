// Child class of Worker dedicated to Core system logical code
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var PilotW = new Worker("WD");
PilotW.treatError = function(error) {
	logger. log("MicroService", "Worker D - Pilot Worker", "Error received: "+JSON.stringify(error));
}

PilotW.doJob = function(data) {
	logger.log("MicroService", "Worker D - Pilot Worker", "Job to do: "+JSON.stringify(data));
	switch (data.data.method) {
	case "GET": 
	case "POST":
		PilotW.sendToNextWorker(["WB", "WA"], data.data); // send to DBWorker to retrieve or push the data and send it back to the REST Worker
		break;
	default:
		logger.log("MicroService", "Worker D - Pilot Worker", "This should not happen");
	}
}
