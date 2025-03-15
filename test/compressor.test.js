const Compressor = require('../Compressor.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

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
    return fn();
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
  afterEach(function() {
    sinon.restore();
  });
  
  // Test direct BSON serialization/deserialization methods
  it('BSONserialize and BSONdeserialize methods should work directly', function() {
    return withConfigProtocol('BSON', () => {
      const comp = new Compressor();
      const data = { test: 'direct bson test', num: 12345 };
      
      // We need to test these methods directly
      const serialized = comp.BSONserialize(data);
      assert(Buffer.isBuffer(serialized) || serialized instanceof Uint8Array);
      
      const deserialized = comp.BSONdeserialize(serialized);
      assert.deepStrictEqual(deserialized, data);
      
      // Also test non-Buffer input for deserialize
      const asArray = new Uint8Array(serialized);
      const deserializedFromArray = comp.BSONdeserialize(asArray);
      assert.deepStrictEqual(deserializedFromArray, data);
    });
  });
  
  // Test direct MessagePack serialization/deserialization methods  
  it('MSGPACKserialize and MSGPACKdeserialize methods should work directly', function() {
    return withConfigProtocol('msgpack', () => {
      const comp = new Compressor();
      const data = { test: 'direct msgpack test', num: 67890 };
      
      // Test these methods directly
      const serialized = comp.MSGPACKserialize(data);
      assert(Buffer.isBuffer(serialized));
      
      const deserialized = comp.MSGPACKdeserialize(serialized);
      assert.deepStrictEqual(deserialized, data);
    });
  });

  it('Default serialization should work with JSON', function() {
    // Default to JSON when no specific protocol is set
    withConfigProtocol('', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
      // Don't check the type of serialized data as it depends on the implementation
    });
  });
  
  it('BSON serialization should work', function() {
    return withConfigProtocol('BSON', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
      assert(Buffer.isBuffer(serialized) || serialized instanceof Uint8Array);
    });
  });
  
  it('BSON should handle Buffer vs non-Buffer data in deserialization', function() {
    return withConfigProtocol('BSON', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      
      // Test with Buffer data
      const serialized = comp.serialize(data);
      assert(Buffer.isBuffer(serialized) || serialized instanceof Uint8Array);
      const deserialized1 = comp.deserialize(serialized);
      assert.deepStrictEqual(deserialized1, data);
      
      // Test with non-Buffer data that gets converted to Buffer
      const nonBufferData = new Uint8Array(serialized);
      const deserialized2 = comp.deserialize(nonBufferData);
      assert.deepStrictEqual(deserialized2, data);
    });
  });
  
  it('MsgPack serialization should work', function() {
    return withConfigProtocol('msgpack', () => {
      const comp = new Compressor();
      const data = { test: 'data', num: 123 };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      assert.deepStrictEqual(deserialized, data);
      assert(Buffer.isBuffer(serialized));
    });
  });
  
  it('MsgPack encoder and decoder should be properly initialized and called', function() {
    return withConfigProtocol('msgpack', () => {
      const msgpackMock = {
        encode: sinon.spy(data => Buffer.from(JSON.stringify(data))),
        decode: sinon.spy(data => JSON.parse(data.toString()))
      };
      
      const msgpack5Stub = sinon.stub().returns(msgpackMock);
      
      const CompressorWithMock = proxyquire('../Compressor.js', {
        'msgpack5': msgpack5Stub
      });
      
      const comp = new CompressorWithMock();
      const data = { test: 'special', num: 456 };
      
      // Use the serialization methods
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      // Verify mocks were called correctly
      assert(msgpack5Stub.calledOnce);
      assert(msgpackMock.encode.calledOnce);
      assert(msgpackMock.encode.calledWith(data));
      assert(msgpackMock.decode.calledOnce);
      assert(msgpackMock.decode.calledWith(serialized));
      assert.deepStrictEqual(deserialized, data);
    });
  });
  
  it('Default JSON serialization methods should work directly', function() {
    const comp = new Compressor();
    
    // Save original methods
    const origSerialize = comp.serialize;
    const origDeserialize = comp.deserialize;
    
    // Override serialize/deserialize to test the JSON methods directly
    comp.serialize = Compressor.prototype.serialize;
    comp.deserialize = Compressor.prototype.deserialize;
    
    const data = { test: 'direct json', value: 789 };
    const serialized = comp.serialize(data);
    const deserialized = comp.deserialize(serialized);
    
    assert.strictEqual(typeof serialized, 'string');
    assert.strictEqual(serialized, JSON.stringify(data));
    assert.deepStrictEqual(deserialized, data);
    
    // Restore original methods
    comp.serialize = origSerialize;
    comp.deserialize = origDeserialize;
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
  
  it('Should handle the protobuf case in the constructor', function() {
    return withConfigProtocol('protobuf', () => {
      const comp = new Compressor();
      
      // The default methods should still be in place
      // since protobuf hasn't been implemented
      const data = { test: 'data' };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      // Just verify the roundtrip works, don't check the format
      // since we haven't mocked the default methods
      assert.deepStrictEqual(deserialized, data);
    });
  });
  
  it('Should handle the default case in the constructor', function() {
    return withConfigProtocol('invalid-protocol', () => {
      const comp = new Compressor();
      
      // The default methods should be used
      const data = { test: 'default case' };
      const serialized = comp.serialize(data);
      const deserialized = comp.deserialize(serialized);
      
      // Just verify the roundtrip works, don't check the format
      // since we haven't mocked the default methods
      assert.deepStrictEqual(deserialized, data);
    });
  });
  
  it('Should handle edge cases in serialization', function() {
    // Test all serializers with various edge cases
    const edgeCases = [
      // Empty objects/arrays
      {},
      [],
      // Special numeric values
      { num: 0 },
      { num: -0 },
      { num: Number.MAX_SAFE_INTEGER },
      { num: Number.MIN_SAFE_INTEGER },
      // String edge cases
      { str: '' },
      { str: 'üniçødé \u0000 null byte' },
      // Mixed edge case
      { null: null, undef: undefined, bool: false, emptyStr: '', emptyArr: [] }
    ];
    
    // Test each format with each edge case
    ['', 'BSON', 'msgpack'].forEach(protocol => {
      withConfigProtocol(protocol, () => {
        const comp = new Compressor();
        
        edgeCases.forEach(data => {
          const serialized = comp.serialize(data);
          const deserialized = comp.deserialize(serialized);
          
          // Handle undefined values which won't be preserved in JSON
          const expected = JSON.parse(JSON.stringify(data));
          assert.deepStrictEqual(deserialized, expected);
        });
      });
    });
  });
  
  // Test for all constructor switch cases to improve branch coverage
  it('Should initialize with different protocols', function() {
    // Direct test of different protocols
    const protocols = ['', 'JSON', 'BSON', 'msgpack', 'protobuf', 'unknown'];
    
    protocols.forEach(protocol => {
      withConfigProtocol(protocol, () => {
        // For protobuf, we'll mock its implementation to cover the branch
        if (protocol === 'protobuf') {
          // Stub the required protobuf module to cover that branch
          const mockProtobuf = {};
          const CompressorWithMock = proxyquire('../Compressor.js', {
            'protobufjs': mockProtobuf
          });
          
          // Create a new instance with the mock
          const comp = new CompressorWithMock();
          
          // Verify it works (using the default implementation since protobuf is stubbed)
          const data = { test: 'protobuf-mocked' };
          const serialized = comp.serialize(data);
          const deserialized = comp.deserialize(serialized);
          assert.deepStrictEqual(deserialized, data);
        } else {
          // For other protocols, just test normally
          const comp = new Compressor();
          
          // Perform a basic serialize/deserialize to ensure it works
          const data = { test: protocol || 'default' };
          const serialized = comp.serialize(data);
          const deserialized = comp.deserialize(serialized);
          assert.deepStrictEqual(deserialized, data);
        }
      });
    });
  });
});