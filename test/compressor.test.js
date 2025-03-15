const Compressor = require('../Compressor.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Helper to temporarily modify config file
function withConfigProtocol(protocol, fn) {
  const configPath = path.join(__dirname, '../config/config.json');
  const config = require(configPath);
  const originalProtocol = config.data_transfer_protocol;
  
  // Update config
  config.data_transfer_protocol = protocol;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  try {
    // Clear require cache to reload config
    delete require.cache[require.resolve('../config/config.json')];
    delete require.cache[require.resolve('../Compressor.js')];
    
    // Run the test
    fn();
  } finally {
    // Restore original config
    config.data_transfer_protocol = originalProtocol;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Clear require cache again
    delete require.cache[require.resolve('../config/config.json')];
    delete require.cache[require.resolve('../Compressor.js')];
  }
}

describe('Compressor Basic Tests', function() {
  it('Default serialization should work', function() {
    const comp = new Compressor();
    const data = { test: 'data', num: 123 };
    const serialized = comp.serialize(data);
    const deserialized = comp.deserialize(serialized);
    
    assert.deepStrictEqual(deserialized, data);
  });
  
  it('BSON serialization should work', function() {
    withConfigProtocol('BSON', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
    });
  });
  
  it('MsgPack serialization should work', function() {
    withConfigProtocol('msgpack', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
    });
  });
  
  it('Should handle complex nested data', function() {
    const comp = new Compressor();
    const complexData = {
      string: 'hello',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3, 'four', false],
      nested: {
        a: 1,
        b: {
          c: 'deep',
          d: [{ e: 'nested array' }]
        }
      },
      date: new Date('2025-01-01').toISOString()
    };
    
    const serialized = comp.serialize(complexData);
    const deserialized = comp.deserialize(serialized);
    
    assert.deepStrictEqual(deserialized, complexData);
  });
  
  it('should handle the protobuf case in the constructor', function() {
    // Temporarily modify config to test protobuf case
    const config = require('../config/config.json');
    const originalProtocol = config.data_transfer_protocol;
    
    try {
      // Load a fresh instance of config
      delete require.cache[require.resolve('../config/config.json')];
      const modifiedConfig = require('../config/config.json');
      
      // Modify in memory for this test only
      modifiedConfig.data_transfer_protocol = 'protobuf';
      
      // Create a new compressor which should hit the protobuf case
      const compressorModule = require('../Compressor');
      const comp = new compressorModule();
      
      // Test basic serialization works (should use default JSON)
      const data = { test: 'data' };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
      
    } finally {
      // Cleanup - restore original value
      delete require.cache[require.resolve('../config/config.json')];
      delete require.cache[require.resolve('../Compressor.js')];
    }
  });
});