// Child class of Worker dedicated to DB connection
var Worker = require("../Worker.js");
var logger = require("../logger.js");

var DBW = new Worker("WB");
DBW.treatError = function(error) {
	logger. log("MicroService", "Worker B - DB connector", "Error received: "+JSON.stringify(error));
}

DBW.doJob = function(data) {
	logger.log("MicroService", "Worker B - DB connector", "Job to do: "+JSON.stringify(data));
	
	// Start tracking processing duration with a timer specific to the database operation
	const dbOperationTimer = this.metrics.startJobTimer('db_operation');
	
	let result;
	try {
		if (data.data.method == "GET") {
			result = this.getFromDB();
			// Record successful database read metric
			this.metrics.recordMessageSent('db_read_success');
		}
		else if (data.data.method == "POST") {
			result = this.storeInDB();
			// Record successful database write metric
			this.metrics.recordMessageSent('db_write_success');
		}
	} catch (error) {
		// Record database error metric
		this.metrics.recordError('db_operation_error');
		// Stop the database operation timer
		dbOperationTimer();
		// Stop the job processing timer
		if (data.metricTimer) data.metricTimer();
		throw error;
	}
	
	// Stop the database operation timer
	dbOperationTimer();
	
	// Stop the job processing timer that was started in activateJob
	if (data.metricTimer) data.metricTimer();
	
	// Send the result to the next worker
	return this.sendToNextWorker(
		data.workers_list, 
		{content: result, resId: data.data.resId, time: data.data.time}, 
		data.workers_list_id
	);
}

DBW.storeInDB = function(data) {
	// DO Whatever
	return "OK";
}

DBW.getFromDB = function() {
	// DO Whatever
	return {title: "This is a fake movie", description: "This fact movie is awesome"};
}
