// Child class of Worker dedicated to REST connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var requests = Array();

var RESTW = new Worker("WA");
RESTW.treatError = function(error) {
	logger. log("MicroService", "Worker A - REST connector", "Error received");
	var oError = JSON.parse(error);
	var response = requests[oError.data.resId].res;
	response.writeHead(500);
	response.end();
}

RESTW.doJob = function(data) {
	logger.log("MicroService", "Worker A - REST connector", "Job to do: "+JSON.stringify(data));
	var response = requests[data.data.resId].res;
	response.writeHead(200);
	response.end("time: "+(new Date().getTime()-data.data.time/1)+" "+JSON.stringify(data.data.content));
	requests.splice(data.resId, 1);
}

var server = http.createServer(function(req, res) {
	switch(req.method) {
	case 'GET':
	case 'POST':
		var path = url.parse(req.url).pathname;
		if (path == '/movies/') {
			var resId = requests.push({req: req, res: res});
			resId--;
			RESTW.sendToNextWorker(["WD"], {method: req.method, params: querystring.parse(url.parse(req.url).query), resId: resId, time: new Date().getTime()});
		} else send404(res);
		break;
	default: 
		send404(res);
	}

});

function send404(res) {
	logger.log("MicroService", "Worker A - REST connector", "Sending 404");
	res.writeHead(404);
	res.end();
}

server.listen(8080);
