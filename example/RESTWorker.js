// Child class of Worker dedicated to REST connection
var Worker = require("./Worker.js");
var logger = require("./logger.js");

var RESTW = new Worker("WA");
RESTW.treatError = function(error) {
	logger. log("MicroService", "Worker A - REST connector", "Error received");
}

setTimeout(function() {RESTW.sendToNextWorker(["WA", "WB"], {title: "toto"});}, 500);
