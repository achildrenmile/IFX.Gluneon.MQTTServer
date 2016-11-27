/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */
var toml = require('toml');
var fs = require('fs');


/** Read the config file */
var cfgFilePath = __dirname + "/config.toml"

/**
 * Check if config file is passed as an argument.
 * Example:
 * `node mainflux-mqtt.js /etc/mainflux/mqtt/config.toml`
 */
var f = process.argv[2]

if (f) {
	try {
		fs.accessSync(f, fs.F_OK);
    cfgFilePath = f
	} catch (e) {
    // It isn't accessible
	}
}

var str = fs.readFileSync(cfgFilePath, 'utf-8')

/** Parse the TOML string into the JS object */
var config = toml.parse(str);

module.exports = config;
