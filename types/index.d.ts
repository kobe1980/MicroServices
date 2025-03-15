// Type definitions for MicroServices.js

declare module 'microservices' {
  /**
   * Options for worker configuration
   */
  export interface WorkerConfig {
    broker_url: string;
    keepalive?: number;
    SystemManager_log?: boolean;
    Worker_log?: boolean;
    data_transfer_protocol?: 'JSON' | 'BSON' | 'msgpack' | 'protobuf';
  }

  /**
   * Worker class for creating specialized microservice workers
   */
  export class Worker {
    /**
     * Create a new worker
     * @param type The type of the worker (e.g., "WA", "WB")
     */
    constructor(type: string);

    /**
     * The type of the worker
     */
    type: string;

    /**
     * The unique ID of the worker
     */
    id: string;

    /**
     * Get the worker configuration
     */
    getConfig(): { id: string; type: string };

    /**
     * Stop the worker and clean up resources
     */
    kill(): void;

    /**
     * Send data to the next worker in the chain
     * @param next_workers Array of worker IDs to send to
     * @param data The data to send
     * @param workers_list_id Optional index in the workers list
     * @param jobId Optional job ID
     * @param tries Optional number of retry attempts
     */
    sendToNextWorker(
      next_workers: string[],
      data: any,
      workers_list_id?: number,
      jobId?: string,
      tries?: number
    ): void;

    /**
     * Handle an error from the system
     * @param error The error object
     */
    treatError(error: any): void;

    /**
     * Process a job
     * @param data The job data
     */
    doJob(data: any): void;
  }

  /**
   * System manager class for coordinating workers
   */
  export class SystemManager {
    /**
     * Create a new system manager
     */
    constructor();

    /**
     * The unique ID of the system manager
     */
    id: string;

    /**
     * List of available workers
     */
    workers_list: Record<string, any>;

    /**
     * Stop the system manager and clean up resources
     */
    kill(): void;

    /**
     * Add a worker to the system
     * @param worker The worker to add
     */
    addWorker(worker: any): void;

    /**
     * Send keepalive message to workers
     */
    keepAlive(): void;

    /**
     * Print the list of available workers
     */
    printWorkersList(): void;

    /**
     * Remove a worker from the system
     * @param worker The worker to remove
     */
    delWorker(worker: any): void;
  }

  /**
   * Compressor class for serializing/deserializing messages
   */
  export class Compressor {
    /**
     * Create a new compressor
     */
    constructor();

    /**
     * Serialize data
     * @param data The data to serialize
     */
    serialize(data: any): Buffer | string;

    /**
     * Deserialize data
     * @param data The data to deserialize
     */
    deserialize(data: Buffer | string): any;
  }

  /**
   * RabbitAdapter for RabbitMQ messaging
   */
  export namespace RabbitAdapter {
    /**
     * Create a new messaging context
     * @param url The RabbitMQ URL
     */
    function createContext(url: string): Context;

    /**
     * Socket types
     */
    enum SOCKET_TYPES {
      PUB = 'PUB',
      SUB = 'SUB'
    }

    /**
     * Messaging context
     */
    interface Context {
      /**
       * The RabbitMQ URL
       */
      url: string;

      /**
       * Register an event handler
       * @param event The event name
       * @param callback The event handler
       */
      on(event: string, callback: Function): void;

      /**
       * Create a new socket
       * @param type The socket type
       * @param options Optional socket options
       */
      socket(type: string, options?: Record<string, any>): Socket;
    }

    /**
     * Messaging socket
     */
    interface Socket {
      /**
       * Connect to an exchange
       * @param exchange The exchange name
       * @param routingKey The routing key
       * @param callback Callback function called when connected
       */
      connect(exchange: string, routingKey: string, callback?: Function): Promise<void>;

      /**
       * Register an event handler
       * @param event The event name
       * @param callback The event handler
       */
      on(event: string, callback: Function): void;

      /**
       * Publish a message
       * @param routingKey The routing key
       * @param message The message content
       */
      publish(routingKey: string, message: string | Buffer): boolean;

      /**
       * Close the socket
       */
      close(): void;

      /**
       * End the socket (alias for close)
       */
      end(): void;
    }
  }

  /**
   * Logger utility
   */
  export namespace logger {
    /**
     * Log a message
     * @param module_name The name of the module
     * @param function_name The name of the function
     * @param msg The message to log
     * @param level Optional log level ('INFO' or 'ERROR')
     */
    function log(
      module_name: string,
      function_name: string | null,
      msg: string,
      level?: 'INFO' | 'ERROR'
    ): void;
  }
}