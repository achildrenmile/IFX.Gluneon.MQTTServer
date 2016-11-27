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
var str = fs.readFileSync(__dirname + "/config.toml", 'utf-8')

/** Parse the TOML string into the JS object */
var config = toml.parse(str);

module.exports = config;
