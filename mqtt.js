/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */

'use strict'
var nats = require('nats').connect(process.env.MQTT_ADAPTER_NATS_URL)
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
 * PUB_BRIDGE flag, set to 1 when message is published over NATS bridge
 * and not an MQTT client connected to the broker directly
 */
var PUB_BRIDGE = false

/**
 * WebSocket
 */
function startWs() {
  var server = http.createServer()
  websocket.createServer({
    server: server
  }, aedes.handle)
  server.listen(8880)
  return server
}

/**
 * MQTT
 */
function startMqtt() {
  return net.createServer(aedes.handle).listen(1883)
}

/**
 * NATS
 */

var resetPubBridge = function() {
  PUB_BRIDGE = false
}

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

  PUB_BRIDGE = true
	aedes.publish(packet, resetPubBridge)
});

/**
 * Hooks
 */
aedes.authorizePublish = function (client, packet, callback) {
	console.log("publishing")
	callback(null)
}

/**
 * Auth
 */
//aedes.authenticate = function (client, username, password, callback) {
var dummy = function (client, username, password, callback) {
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
  if (client && !PUB_BRIDGE) {
	  var msg = {}

	  msg.publisher = client.id
	  // Topics are in the form `mainflux/channels/<channel_id>/messages/senml-json`
	  msg.channel = packet.topic.split("/")[2]
	  msg.protocol = "mqtt"
	  msg.content_type = packet.topic.split("/")[4]

	  /**
	   * Go encodes/decodes binary arrays ar base64 strings,
	   * while Aedes uses UTF-8 encoding.
	   * For NodeJS > 7.1 we can use function `buffer.transcode()` here,
	   * but for now just send buffer as Base64-encoded string
	   */
	  msg.payload = packet.payload.toString('base64')

	  // Pub on "mqtt2core"
	  nats.publish('adapter.mqtt', JSON.stringify(msg));

    console.log('message from client', client.id)
  }
})

aedes.on('subscribe', function(topic, client) {
  console.log('client subscribe', topic, client.id)
})

aedes.on('unsubscribe', function(topic, client) {
  console.log('client usubscribe', topic, client.id)
})
