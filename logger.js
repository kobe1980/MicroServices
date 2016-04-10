var clc = require('cli-color');
var LEVELS = {"INFO": clc.green, "ERROR": clc.red, undefined: clc.green}; 

function log(module_name, function_name, msg, level) {
	console.log(new Date() + " - "+LEVELS[level](module_name+(function_name?".":"")+function_name)+" => "+msg);
}

module.exports.log=log;
