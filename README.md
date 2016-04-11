**MicroServices.js**

MicroServices.js is a minimum implementation of a micro service architecture, based on Node.js and RabbitMQ.
Every service is communicating throw the RabbitMQ broker.

**Architecture overview**

![Architecture](https://github.com/kobe1980/MicroServices/blob/master/doc/archi.png)

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
> {"id":"WB1460306476102","type":"WB"}

id is the ID of the worker. 
Currently, it is composed of the type of the worker and the timestamp of creation of the worker.

When a worker shut down, it send a message on the bus to delete the worker from the list. It is the same message, except that it is sent on the topic: worker.del.

As, the SystemManager can be launch after the workers, it can get the list of all workers, by sending a message on the worker.getAll topic. The workers, send the same message than when they arrive on the network.

**System configuration**

The only configuration mandatory is the RabbitMQ connection URL. It is stored in the config/config.json file.
> /**
>  * Config file for every worker 
>  * contains the information to connect to the broker
>  * broker_url: url of the broker system. Here RabbitMQ
>  * 
>  **/ 
> {
>         "broker_url": "amqp://localhost"
> }

**Create your own system**

To create your own system you have to inherit a dedicated worker from the *Worker* class
Here an example of a DB Worker

> // Child class of Worker dedicated to DB connection
> var Worker = require("./Worker.js");
> var logger = require("./logger.js");

> var DBW = new Worker("WB");
> DBW.treatError = function(error) {
>         logger. log("MicroService", "Worker B - DB connector", "Error received");
> }

> DBW.storeInDB = function(data) {
>         // DO Whatever
> }

> DBW.getFromDB = function() {
>         // DO Whatever
> }

*logger.js is a logger function to log on the console with colored syntax

**TODO**

Manage bus connection issues on both *workers* and *SystemManager*.

> Written with [StackEdit](https://stackedit.io/).