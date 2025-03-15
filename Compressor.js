var config = require('./config/config.json');

function Compressor() {
	this.BSON;
	this.msgpack;
	switch (config.data_transfer_protocol) {
		case "BSON":
			const bson = require('bson');
			this.BSON = bson;
			this.serialize = this.BSONserialize;
			this.deserialize = this.BSONdeserialize;
			break;
		case "msgpack":
			this.msgpack = require('msgpack5')();
			this.serialize = this.MSGPACKserialize;
			this.deserialize = this.MSGPACKdeserialize;
			break;
		case "protobuf":
			break;
		default:
			break;
	}
}

Compressor.prototype.BSONserialize = function(data) {
	return this.BSON.serialize(data);
}

Compressor.prototype.BSONdeserialize = function(data) {
	return this.BSON.deserialize(Buffer.isBuffer(data) ? data : Buffer.from(data));
}

Compressor.prototype.MSGPACKserialize = function(data) {
	return this.msgpack.encode(data);
}

Compressor.prototype.MSGPACKdeserialize = function(data) {
	return this.msgpack.decode(data);
}

Compressor.prototype.serialize = function(data) {
	return JSON.stringify(data);
}

Compressor.prototype.deserialize = function(data) {
	return JSON.parse(data);
}

module.exports = Compressor;
