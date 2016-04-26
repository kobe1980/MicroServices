// Child class of Worker dedicated to REST connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");
var http = require('http');
var url = require('url');
var uuid = require('simply-uuid');
var querystring = require('querystring');
var requests = Array();

var RESTW = new Worker("WA");
RESTW.treatError = function(error) {
	logger. log("MicroService", "Worker A - REST connector", "Error received: "+JSON.stringify(error));
	var response = requests[error.data.resId].res;
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
		var path = url.parse(req.url).pathname;
		if (path == '/movies/') {
			var uniqueId = uuid.generate();
			requests[uniqueId] = {req: req, res: res};
			RESTW.sendToNextWorker(["WD:*"], {method: req.method, params: querystring.parse(url.parse(req.url).query), resId: uniqueId, time: new Date().getTime()});
		} else send404(res);
		break;
	case 'POST':
		var path = url.parse(req.url).pathname;
		if (path == '/movies/') {
			var uniqueId = uuid.generate();
			requests[uniqueId] = {req: req, res: res};
			var body="";
			req.on('data', function (data) {
				body +=data;
			});
			req.on('end',function(){
				RESTW.sendToNextWorker(["WD"], {method: req.method, params: body, resId: uniqueId, time: new Date().getTime()});
           	 	});
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
