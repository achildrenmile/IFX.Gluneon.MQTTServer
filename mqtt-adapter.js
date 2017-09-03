/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */

'use strict'
var config = require('./config/config')
var nats = require('nats').connect('nats://' + config.nats.host + ':' + config.nats.port)
var http = require('http')
var websocket = require('websocket-stream')
var net = require('net')
var aedes = require('aedes')()
var logging = require('aedes-logging')
var request = require('request');

var servers = [
  startWs(),
  startMqtt(),
]

logging({
  instance: aedes,
  servers: servers
})

/**
 * WebSocket
 */
function startWs() {
  var server = http.createServer()
  websocket.createServer({
    server: server
  }, aedes.handle)
  server.listen(config.mqtt.wsPort)
  return server
}

/**
 * MQTT
 */
function startMqtt() {
  return net.createServer(aedes.handle).listen(config.mqtt.port)
}

/**
 * NATS
 */

// Sub on "core2mqtt"
nats.subscribe('msg.http', function(msg) {
	var m = JSON.parse(msg)
	var packet = {
		cmd: 'publish',
		qos: 2,
		topic: "mainflux/channels/" + m.channel + "/messages/" + m.content_type,
		payload: Buffer.from(m.payload, 'base64'),
		retain: false
	}

	aedes.publish(packet, null)
});

/**
 * Hooks
 */
aedes.authorizePublish = function (client, packet, callback) {
	var msg = {}

	msg.publisher = client.id
	/**
	 * Go encodes/decodes binary arrays ar base64 strings,
	 * while Aededs uses UTF-8 encoding.
	 * For NodeJS > 7.1 we can use function `buffer.transcode()` here,
	 * but for now just send buffer as Base64-encoded string
	 */
	msg.payload = packet.payload.toString('base64')
	// Topics are in the form `mainflux/channels/<channel_id>/messages/senml-json`
	msg.channel = packet.topic.split("/")[2]
	msg.content_type = packet.topic.split("/")[4]
	msg.protocol = "mqtt"

	// Pub on "mqtt2core"
	nats.publish('msg.mqtt', JSON.stringify(msg));

	console.log("publishing")

	callback(null)
}

/**
 * Auth
 */
aedes.authenticate = function (client, username, password, callback) {
	var json = {
    "client": username
	};

	var options = {
		url: 'http://localhost:8180/check',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
			'Authorization': password
    },
    json: json
  };

  request(options, function(err, res, body) {
		var error = null;
		var success = null;

    //if (res && (res.statusCode === 200 || res.statusCode === 201)) {
    if (true) {
			//console.log(body);

			// Set MQTT client.id to correspond to Mainflux device UUID
			client.id = username;
			success = true
    } else {
			error = new Error('Auth error');
			error.returnCode = 4; // Bad username or password
			success = false
		}
		// Repond with auth error and success
		callback(error, success);
  });
}

/**
 * Handlers
 */
aedes.on('client', function (client) {
  console.log('new client', client.id)
})

aedes.on('clientDisconnect', function(client) {
  console.log('client disconnect', client.id)
})

aedes.on('clientError', function (client, err) {
  console.log('client error', client.id, err.message, err.stack)
})

aedes.on('publish', function (packet, client) {
  if (client) {
    console.log('message from client', client.id)
  }
})

aedes.on('subscribe', function(topic, client) {
  console.log('client subscribe', topic, client.id)
})

aedes.on('unsubscribe', function(topic, client) {
  console.log('client usubscribe', topic, client.id)
})
