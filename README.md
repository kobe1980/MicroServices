**MicroServices.js**

MicroServices.js is a minimum implementation of a micro service architecture, based on Node.js and RabbitMQ.
Every service is communicating throw the RabbitMQ broker.

**Dependencies**

 - [amqplib](https://github.com/amqp-node/amqplib) - Modern RabbitMQ client library. RabbitMQ is not included; you need to install it separately.
 - Custom RabbitAdapter - Adapter that provides a rabbit.js-compatible API using amqplib
 - [cli-color](https://github.com/medikoo/cli-color) - Used for colorized logging output
 - [msgpack5](https://github.com/mcollina/msgpack5)/[bson](https://github.com/mongodb/js-bson) - Used for efficient binary message serialization
 - [simply-uuid](https://www.npmjs.com/package/simply-uuid) - Used for generating unique IDs
 - [prom-client](https://github.com/siimon/prom-client) - Prometheus client for metrics collection and monitoring

**Architecture overview**

![Architecture](https://raw.githubusercontent.com/kobe1980/MicroServices/master/doc/archi.png)

**Components**

 1. SystemManager - Central coordinator that tracks available workers
 2. RabbitMQ Bus - Message broker for communication between components
 3. Workers - Specialized service components that perform specific tasks
 4. Metrics - Monitoring system for collecting and exposing performance data

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

## Metrics

MicroServices.js includes a built-in metrics system for monitoring your microservices architecture in real-time. The metrics module is based on Prometheus, a popular open-source monitoring solution.

Key features:
- Automatic collection of system metrics (CPU, memory, etc.)
- Custom application metrics for message passing and processing
- Worker-specific metrics
- Job processing time measurements
- Error tracking
- Prometheus-compatible HTTP endpoint
- Designed for integration with Grafana dashboards

### Metrics Exposed

The metrics system exposes the following metrics:

**Counter Metrics:**
- `microservices_messages_received_total` - Total number of messages received by service (labeled by service and type)
- `microservices_messages_sent_total` - Total number of messages sent by service (labeled by service and type)
- `microservices_job_errors_total` - Total number of job processing errors (labeled by service and error_type)

**Gauge Metrics:**
- `microservices_workers_total` - Number of workers by type
- `microservices_connected_workers` - Number of workers connected to the bus

**Histogram Metrics:**
- `microservices_job_processing_seconds` - Time spent processing jobs (labeled by service and job_type)

### Usage

Metrics are automatically collected in both SystemManager and Worker components. The metrics are exposed on a Prometheus-compatible HTTP endpoint (default port 9091).

Custom metrics can be added to your applications by using the metrics API:

```javascript
// Record a received message
metrics.recordMessageReceived('message_type');

// Record a sent message
metrics.recordMessageSent('message_type');

// Time a job execution
const timer = metrics.startJobTimer('job_type');
// ... perform job ...
timer(); // Stop the timer

// Record worker counts
metrics.setWorkerCount('worker_type', count);

// Record errors
metrics.recordError('error_type');
```

### Monitoring Setup

To use the metrics with Prometheus and Grafana:

1. Configure Prometheus to scrape the metrics endpoint
2. Set up Grafana to query Prometheus
3. Import the provided dashboards

Sample Prometheus configuration in `monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'microservices'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9091']
```

### Dashboard Overview

The metrics dashboard provides:
- Worker health and connectivity
- Message throughput by service and type
- Job processing times and latency distribution
- Error rates and types
- System resource utilization

**TODO**

- Add enhanced logging options and log rotation
- Expand metrics collection for additional service types
- Add more detailed Grafana dashboards

**Example**

In the example, you can find a REST Worker, accepting connexion on port 8080.
If http method is not post or get, or if path is different from /movies/, it will responde 404.
Else, it will send a message to the Pilot Worker to treat the customer request.
The Pilot will ask the DB Worker to store or retrieve the data and send it back to the REST Worker.
Finally, the REST Worker responde the client.
If an error occurs, the REST Worker will answer with HTTP 500 code.

**Tests**

Tests are built with Mocha, Should, Sinon, and nyc (formerly Istanbul) for test coverage.
Current test coverage is excellent:

 - Overall coverage: 98.2% 
 - RabbitAdapter: 98.41%
 - Compressor: 96.42%
 - Logger: 100%
 - Metrics: 100%

Specific test suites:
 - Unit tests for all core modules
 - Comprehensive tests for error handling
 - Tests for all serialization formats (JSON, BSON, MessagePack)
 - Mocked RabbitMQ connection for reliable testing
 - Integration tests for metrics collection
 - Worker and SystemManager metrics instrumentation tests

Run the tests with:
```bash
# Run all tests
npm test

# Run only metrics tests
npm run test:metrics

# Run tests with coverage
npm run coverage

# Run only metrics tests with coverage
npm run coverage:metrics
```

Tested with the 3 workers in example directory and a bus on AWS EC2 micro instances. Response time < 90ms.

**Release notes:**

 - 0.0.9: Added monitoring capabilities and improved worker instrumentation
   - Added Prometheus metrics collection and monitoring
   - Implemented metrics tracking in SystemManager and Worker classes
   - Added metrics test suite with 100% coverage
   - Created Grafana dashboards for visualization
   - Documented metrics collection API and usage

- 0.0.8: Modernized libraries and improved test coverage
   - Replaced legacy rabbit.js with modern amqplib 
   - Added custom RabbitAdapter for seamless backward compatibility
   - Updated all dependencies to latest secure versions
   - Added comprehensive test suite with nearly 100% coverage
   - Fixed potential security vulnerabilities

 - 0.0.7: Added support for multiple serialization formats
   - JSON (default) - Standard text-based serialization
   - BSON - Binary serialization for complex data types
   - MessagePack - Efficient binary serialization

 - 0.0.5: Update Worker id, so that you can now either send a job to any worker of the good type, or to a specific worker. 
   - To send a job to any worker, send to Worker_type:*
   - To send a job to a specific worker send to worker id

Here is a sample of code:

    // "Stuff to do" will be sent to any worker of type WD
    Worker.sendToNextWorker(["WD:*"], {data: "Stuff to do"});
    // "Stuff to do" will be sent to worker of type WD with id WA:1461679731775
    Worker.sendToNextWorker(["WD:1461679731775"], {data: "Stuff to do"});
      

## RabbitAdapter

The custom RabbitAdapter provides a compatibility layer between the modern amqplib library and the original rabbit.js API. This ensures that existing code continues to work without modifications while benefiting from the updated security and performance of the newer library.

Key features:
- Same interface as rabbit.js for drop-in compatibility
- Uses modern Promise-based asynchronous code
- Improved error handling and logging
- Comprehensive test coverage

> Written with [StackEdit](https://stackedit.io/).
