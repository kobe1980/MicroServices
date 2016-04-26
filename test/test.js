var should = require('should');
var Worker = require('../Worker.js');
var SystemManager = require('../SystemManager.js');
var Compressor = require('../Compressor.js');
var compressor = new Compressor();

process.setMaxListeners(0);

describe("Workers Methods", function() {
	var w;
	var type = "WA";
	this.timeout(5000);
	beforeEach(function(done) {
		w = new Worker(type);
		setTimeout(done, 1000);
	});
	afterEach(function(done) {
		w.kill();
		w = null;
		setTimeout(done, 2000);	
	});
	it ("Should have a configuration as set on creation", function(done) {
		w.getConfig().type.should.equal(type);
		w.getConfig().id.should.be.instanceOf(String);
		done();
	});
	
	it("Should save job list on jobsSend", function(done) {
		var data = "some data";
		var workers = ["WA:*", "WB:*"];
		w.sendToNextWorker(workers, data);
		w.jobsSent[0].job.workers_list.should.equal(workers);
		w.jobsSent[0].job.data.should.equal(data);
		w.jobsSent[0].job.sender.should.be.instanceOf(Object);
		JSON.stringify(w.jobsSent[0].job.sender).should.equal(JSON.stringify(w.getConfig()));
		done();
	});

	it ("Should update JobsSent list when receiving job update", function(done) {
		var content = "some data";
		var workers = ["WA:*", "WB:*"];
		w.sendToNextWorker(workers, content);
		var job_stored = w.jobsSent[0];
		job_stored.job.data = "new data";
		var func_return =  w.updateJobsSent(job_stored);
		w.jobsSent[0].should.be.instanceOf(Object);
		w.jobsSent[0].job.data.should.equal(job_stored.job.data);
		func_return.should.equal(true);
		done();
	});
	
	it ("Should update try number when ask to resend a job", function(done) {
		var data = "some data";
		var workers = ["WA:*", "WB:*"];
		w.sendToNextWorker(workers, data);
		w.resend(workers, w.jobsSent[0]);
		w.jobsSent[0].tries.should.equal(2);
		done();
	});

	it ("Should return false when receiving an unknown job", function(done) {
		var job = {job: {id: "123456"}, descr: {workers_list: ["WA:*", "WB:*"], sender: "123456"}};
		w.updateJobsSent(job).should.equal(false);
		done();
	});

/*	it ("Should clear the timeout when asked to", function(done) {
		var data = "some data";
		var workers = ["WA", "WB"];
		w.sendToNextWorker(workers, data);
		w.clearJobTimeout(w.jobsSent[0].id);
		w.jobsSent[0].timeoutId.should.be.null();
	});
*/
	it ("Should call treatError function when an error is received", function(done) {
		var data = "some data";
		var workers = ["WA:*", "WB:*"];
		w.treatError = function(error) {
			done();
		}
		w.sendToNextWorker(workers, data);
		w.pub.publish("error", compressor.serialize({target: w.getConfig(), error: "No worker available for this job", id: w.jobsSent[0].id, data: "fake data"}));
	});

	it ("Should call doJob when receiving a new job for it", function(done) {
		var data = "some data";
		var workers = ["WA:*", "WB:*"];
		w.doJob = function(data) {
			setTimeout(function() {
				w.jobsSent.length.should.equal(0);	
				done();
			}, 100);
		}
		w.sendToNextWorker(workers, data);
	});

	it ("Should add a worker on the list if a new worker of the same type is announced", function(done) {
		var worker = {id : "1234567", type: "WA"};
		w.pub.publish("worker.new.send", compressor.serialize(worker));
		setTimeout(function() {
			w.sameTypeWorkers.length.should.equal(2);
			JSON.stringify(w.sameTypeWorkers[1].worker).should.equal(JSON.stringify(worker));
			w.sameTypeWorkers[1].isNext.should.equal(true);
			done();
		}, 100);
	});

	it ("Should not add a worker on the list if a new worker of another type is announced", function(done) {
		var worker = {id : "1234567", type: "WB"};
		w.pub.publish("worker.new.send", compressor.serialize(worker));
		setTimeout(function() {
			w.sameTypeWorkers.length.should.equal(1);
			done();
		}, 100);
	});

	it ("Should remove a worker on the list if receive a del event", function(done) {
		var worker = {id : "1234567", type: "WA"};
		w.newWorker(compressor.serialize(worker));
		w.sameTypeWorkers.length.should.equal(2);
		JSON.stringify(w.sameTypeWorkers[1].worker).should.equal(JSON.stringify(worker));
		w.pub.publish("worker.del", compressor.serialize(worker));
		setTimeout(function() {
			w.sameTypeWorkers.length.should.equal(1);
			w.sameTypeWorkers[0].worker.id.should.equal(w.id);
			done();
		}, 100);
	});

	it ("Should set nextJobForMe when asked to", function(done) {
		w.setNextJobForMe(false);
		w.nextJobForMe.should.equal(false);
		w.setNextJobForMe(true);
		w.nextJobForMe.should.equal(true);
		done();
	});

	it ("Should update workers list when not alone on the bus", function(done) {
		var w2 = new Worker("WA");
		setTimeout(function() {
			JSON.stringify(w2.sameTypeWorkers[0].worker).should.equal(JSON.stringify(w.getConfig()));
			JSON.stringify(w2.sameTypeWorkers[1].worker).should.equal(JSON.stringify(w2.getConfig()));
			w2.kill();
			done();
		}, 500);			
	});

	it ("Should print sameTypeWorkers when asked to", function(done) {
		w.printSameTypeWorkers();
		done();
	});

	it ("Should resend workers when asked to by SystemManager", function(done) {
		var s = new SystemManager();
		setTimeout(function() {
			var j = 0;
			for (var i in s.workers_list) {
				j++;
			}
			j.should.equal(1);
			JSON.stringify(s.workers_list[w.id]).should.equal(JSON.stringify(w.getConfig()));
			s.kill();
			setTimeout(function() {
				done();
			}, 500);
		}, 500);
	});
});

describe("SystemManager Methods", function() {
	var s;
	this.timeout(5000);
	beforeEach(function(done) {
		s = new SystemManager();
		setTimeout(function() {
			done();
		}, 500);
	});

	afterEach(function(done) {
		s.kill();
		setTimeout(function() {
			s = null;
			done();
		}, 500);
	});

	it ("Should add worker when a new worker announce itself on the bus", function(done) {
		var w = new Worker("WA");
		setTimeout(function() {
			var j = 0;
			for (var i in s.workers_list) {
				j++;
			}
			j.should.equal(1);
			JSON.stringify(s.workers_list[w.id]).should.equal(JSON.stringify(w.getConfig()));
			w.kill();
			done();
		}, 500);
	});

	it ("Should add a second worker when a new worker announce itself on the bus", function(done) {
		var w = new Worker("WA");
		var w2 = new Worker("WB");
		setTimeout(function() {
			var j = 0;
			for (var i in s.workers_list) {
				j++;
			}
			j.should.equal(2);
			JSON.stringify(s.workers_list[w.id]).should.equal(JSON.stringify(w.getConfig()));
			JSON.stringify(s.workers_list[w2.id]).should.equal(JSON.stringify(w2.getConfig()));
			w.kill();
			w2.kill();
			done();
		}, 500);
	});

	it ("Should remove a worker when it is killed", function(done) {
		var w = new Worker("WA");
		var w2 = new Worker("WB");
		setTimeout(function() {
			var j = 0;
			for (var i in s.workers_list) {
				j++;
			}
			j.should.equal(2);
			JSON.stringify(s.workers_list[w.id]).should.equal(JSON.stringify(w.getConfig()));
			JSON.stringify(s.workers_list[w2.id]).should.equal(JSON.stringify(w2.getConfig()));
			w.kill();
			setTimeout(function() {
				var j = 0;
				for (var i in s.workers_list) {
					j++;
				}
				j.should.equal(1);
				w2.kill();
				done();
			}, 500);
		}, 500);
	});

	it ("Should return true when receving a job that can be done", function(done) {
		var w = new Worker("WA");
		var w2 = new Worker("WB");
		setTimeout(function() {
			s.listenForJobRequest({workers_list: ["WA:*"], workers_list_id: 0}).should.equal(true);
			w.kill();
			w2.kill();
			done();
		}, 500);
	});

	it ("Should return false when receving a job that can't be done", function(done) {
		var w = new Worker("WA");
		var w2 = new Worker("WB");
		setTimeout(function() {
			s.listenForJobRequest({workers_list: ["WC:*"], workers_list_id: 0}).should.equal(false);
			w.kill();
			w2.kill();
			done();
		}, 500);
	});

	it ("Should send an error back to the sender when a job that can't be done is sent", function(done) {
		var w = new Worker("WA");
		w.treatError = function(error) {
			w.kill();
			done();
		}
		setTimeout(function() {
			w.sendToNextWorker(["WC:*"], "stuff to do");
		}, 500);
	});

	it ("Should log out when asked to", function(done) {
		var config = require('../config/config.json');
		var context = require('rabbit.js').createContext(config.broker_url);
		var pub = context.socket('PUB', {routing: 'topic'});
		pub.connect('polling', function() {
			pub.publish('worker.list', "Give Me the list");
			setTimeout(function() {
				//this test does nothing, but increase coverity, because it test a logging function
				var w = new Worker("WA");
				setTimeout(function() {
					pub.publish('worker.list', "Give Me the list");
					setTimeout(function() {
						w.kill();
						done();
					}, 200);
				}, 500);
			}, 500);
		});
	});
});
