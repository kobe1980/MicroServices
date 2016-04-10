// Child class of Worker dedicated to Core system logical code
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var PilotW = new Worker("WD");
PilotW.treatError = function(error) {
	logger. log("MicroService", "Worker D - Pilot Worker", "Error received");
}

PilotW.doJob = function(data) {
	logger.log("MicroService", "Worker D - Pilot Worker", "Job to do: "+JSON.stringify(data));
}

setTimeout(function() {PilotW.sendToNextWorker(["WA", "WB"], {title: "toto"});}, 500);
