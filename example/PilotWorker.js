// Child class of Worker dedicated to Core system logical code
var Worker = require("./Worker.js");
var logger = require("./logger.js");

var PilotW = new Worker("WD");
PilotW.treatError = function(error) {
	logger. log("MicroService", "Worker D - Pilot connector", "Error received");
}

setTimeout(function() {PilotW.sendToNextWorker(["WA", "WB"], {title: "toto"});}, 500);
