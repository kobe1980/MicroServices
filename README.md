**MicroServices.js**

MicroServices.js is a minimum implementation of a micro service architecture, based on Node.js and RabbitMQ.
Every service is communicating throw the RabbitMQ broker.

**Dependencies**

 -  [Rabbit.js](http://www.squaremobius.net/rabbit.js/). RabbitMQ is not include. You need to install it.
 - cli-color used for logger color.

**Architecture overview**

![Architecture](https://raw.githubusercontent.com/kobe1980/MicroServices/master/doc/archi.png)

**Components**

 1. SystemManager
 2. RabbitMQ Bus
 3. Workers

**Global behavior**

I advice to launch the bus and then the *SystemManager*, and after that the *workers*.
Globally speaking, workers are communicating with each other via the bus and specific messages. 
The first thing they do is to declare themselves to the *SystemManager* and the other workers of the same type.
Then, they share messages via the bus. The principal messages is to ask for another worker to do a job.
In my example, the REST worker receive the external message, send it to the Pilot worker who will know what to do with it. He can ask for the DB *worker* to store an information and the say ok to the client via the REST worker.

**Roles**

 - *SystemManager*'s aim is to controls what happens on the bus. He stores the list of workers available. He can answer to a worker asking for a job by sending an error if there's no worker of the good type available. He can provide the list of the workers on the bus.
 - *Worker*'s aim is to perform a dedicated work. DB worker can connect to a DB, REST worker can answer REST requests. You can extend worker to do whatever you want.

**Communications**

*Workers* present them selves on the network by send a message on the channel "notifications", on the topic "worker.new". It allows the *SystemManager* and the other worker to discover it.
By now, this message looks like this:
`{"id":"WB:1460306476102","type":"WB"}`

id is the ID of the worker. 
Currently, it is composed of the type of the worker and the timestamp of creation of the worker.

When a worker shut down, it send a message on the bus to delete the worker from the list. It is the same message, except that it is sent on the topic: worker.del.

As, the SystemManager can be launch after the workers, it can get the list of all workers, by sending a message on the worker.getAll topic. The workers, send the same message than when they arrive on the network.

**System configuration**

The only configuration mandatory is the RabbitMQ connection URL. It is stored in the config/config.json file.
You can add a keepalive key that allow the *SystemManager* to regularly ask for *Workers* list. If 0 or no entry, the keepalive is not done.
For performance purpose, you can activate binary exchanges on the bus. See data_transfer_protocol.

    /**
	* Config file for every worker 
	* contains the information to connect to the broker
	* broker_url: url of the broker system. Here RabbitMQ
	* keepalive: frequency of keepalive made by SystemManager
	* SystemManager_log: activate SystemManager logging
	* Worker_log: activate Worker logging
	* data_transfer_protocol: data compression type on the bus. 
	*         Supported: JSON/BSON/MessagePack
	* 
	**/ 
	{
	"broker_url": "amqp://localhost",
	"keepalive": 1000,
	"SystemManager_log": true,
        "Worker_log": true,
        "data_transfer_protocol": "msgpack"
	}



**Ack and retry**

When a job is sent, the *worker* that take it have to send an ack. If no worker does, the job is resend every 2s until it is taken or the *SystemManager* says that there's no worker of the good type.
If an ack is receive by the sender for a job he sent, he remove it from the list of pending jobs. 

**Create your own system**

To create your own system you have to inherit a dedicated com from the *Worker* class
Here an example of a DB Worker

    // Child class of Worker dedicated to DB connection
    var Worker = require("./Worker.js");
    var logger = require("./logger.js");
    
    var DBW = new Worker("WB");
    DBW.treatError = function(error) {
            logger. log("MicroService", "Worker B - DB connector", "Error received");
    }
    
    DBW.storeInDB = function(data) {
            // DO Whatever
    }
    
    DBW.getFromDB = function() {
            // DO Whatever
    }
    
    
   logger.js is a logger function to log on the console with colored syntax

**TODO**

Manage bus connection issues on both *workers* and *SystemManager*.

**Example**

In the example, you can find a REST Worker, accepting connexion on port 8080.
If http method is not post or get, or if path is different from /movies/, it will responde 404.
Else, it will send a message to the Pilot Worker to treat the customer request.
The Pilot will ask the DB Worker to store or retrieve the data and send it back to the REST Worker.
Finally, the REST Worker responde the client.
If an error occurs, the REST Worker will answer with HTTP 500 code.

**Tests**

Tests are build with Mocha, Should and Istanbul for test coverage.
By now, test coverage is:

 - Workers: 93,9%
 - SystemManager: 94,9%

Tested with the 3 workers in example directory and a bus on AWS EC2 micro instances. Response time < 90ms.

**Release note:**

 - 0.0.5: Update Worker id, so that you can now etheir send a job a any worker of the good type, or to a specific worker. 
	 - To send a job to any worker, send to Worker_type:*
	 - To send a job to a specific worker send to worker id

Here is a sample of code:

    // "Stuff to do" will be sent to any worker of type WD
    Worker.sendToNextWorker(["WD:*"], {data: "Stuff to do"});
    // "Stuff to do" will be sent to worker of type WD with id WA:1461679731775
    Worker.sendToNextWorker(["WD:1461679731775"], {data: "Stuff to do"});
      

> Written with [StackEdit](https://stackedit.io/).
