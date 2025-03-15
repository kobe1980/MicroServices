const sinon = require('sinon');
const assert = require('assert');

describe('Logger', function() {
  let logger, consoleLogStub;
  
  beforeEach(function() {
    // Save the original console.log
    consoleLogStub = sinon.stub(console, 'log');
    
    // Clear require cache
    delete require.cache[require.resolve('../logger.js')];
    
    // Require the logger
    logger = require('../logger.js');
  });
  
  afterEach(function() {
    // Restore original console.log
    consoleLogStub.restore();
  });
  
  it('should log messages with default INFO level', function() {
    const message = 'Test message';
    const moduleName = 'TestModule';
    const functionName = 'testFunction';
    
    logger.log(moduleName, functionName, message);
    
    assert(consoleLogStub.calledOnce);
    
    // Check that the log message contains our information
    const loggedMessage = consoleLogStub.getCall(0).args[0];
    assert(loggedMessage.includes(moduleName));
    assert(loggedMessage.includes(functionName));
    assert(loggedMessage.includes(message));
  });
  
  it('should log messages with ERROR level', function() {
    const message = 'Error message';
    const moduleName = 'TestModule';
    const functionName = 'testFunction';
    const level = 'ERROR';
    
    logger.log(moduleName, functionName, message, level);
    
    assert(consoleLogStub.calledOnce);
    
    // Check that the log message contains our information
    const loggedMessage = consoleLogStub.getCall(0).args[0];
    assert(loggedMessage.includes(moduleName));
    assert(loggedMessage.includes(functionName));
    assert(loggedMessage.includes(message));
  });
  
  it('should work without a function name', function() {
    const message = 'Test message no function';
    const moduleName = 'TestModule';
    
    logger.log(moduleName, null, message);
    
    assert(consoleLogStub.calledOnce);
    
    // Check that the log message contains our information
    const loggedMessage = consoleLogStub.getCall(0).args[0];
    assert(loggedMessage.includes(moduleName));
    assert(loggedMessage.includes(message));
  });
});