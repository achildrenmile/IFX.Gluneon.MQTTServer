/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */

'use strict';

var nats = require('nats').connect(process.env.MQTT_ADAPTER_NATS_URL);
var http = require('http');
var websocket = require('websocket-stream');
var net = require('net');
var aedes = require('aedes')();
var logging = require('aedes-logging');
var request = require('request');

var servers = [
  startWs(),
  startMqtt()
];

logging({
  instance: aedes,
  servers: servers
});

/**
 * WebSocket
 */
function startWs() {
  var server = http.createServer();
  websocket.createServer({
    server: server
}, aedes.handle);
  server.listen(8880);
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
nats.subscribe('adapter.http', function(msg) {
	var m = JSON.parse(msg)
	var packet = {
		cmd: 'publish',
		qos: 2,
		topic: "mainflux/channels/" + m.channel + "/messages/" + m.content_type,
		payload: Buffer.from(m.payload, 'base64'),
		retain: false
	}

	aedes.publish(packet, resetPubBridge)
});

/**
 * Hooks
 */
// AuthZ PUB
aedes.authorizePublish = function (client, packet, callback) {

  // Topics are in the form `mainflux/channels/<channel_id>/messages/senml-json`
  var channel = packet.topic.split("/")[2]

  /**
   * Check if PUB is authorized
   */
  var options = {
		url: 'http://localhost:8180/channels/' + channel + '/messages',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
			'Authorization': client.password
    },
  };

  request(options, function(err, res, body) {
		var error = null;

    if (res && (res.statusCode === 202)) {
		  console.log("Publish authorized OK")
      /**
       * We must publish on NATS here, because on_publish() is also called
       * when we receive message from NATS from other adapters (in nats.subscribe()),
       * so we must avoid re-publishing on NATS what came from other adapters
       */
      var msg = {}
      msg.publisher = client.id
      msg.channel = channel
      msg.protocol = "mqtt"
      msg.content_type = packet.topic.split("/")[4]

      /**
       * Go encodes/decodes binary arrays ar base64 strings,
       * while Aedes uses UTF-8 encoding.
       * For NodeJS > 7.1 we can use function `buffer.transcode()` here,
       * but for now just send buffer as Base64-encoded string
       */
      msg.payload = packet.payload.toString('base64')

      // Pub on NATS
      nats.publish('adapter.mqtt', JSON.stringify(msg));
    } else {
      console.log("Publish not authorized")
      error = 4 // Bad username or password
		}
	  callback(error)
  });
}

// AuthZ SUB
aedes.authorizeSubscribe = function (client, packet, callback) {

  // Topics are in the form `mainflux/channels/<channel_id>/messages/senml-json`
  var channel = packet.topic.split("/")[2]

  /**
   * Check if PUB is authorized
   */
  var options = {
		url: 'http://localhost:8180/channels/' + channel + '/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
			'Authorization': client.password
    },
  };

  request(options, function(err, res, body) {
		var error = null;

    if (res && (res.statusCode === 202)) {
		  console.log("Subscribe authorized OK")
    } else {
      console.log("Subscribe not authorized")
      error = 4 // Bad username or password
		}
	  callback(error, packet)
  });
}

// AuthX
aedes.authenticate = function (client, username, password, callback) {
	var options = {
		url: 'http://localhost:8180/identity',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
			'Authorization': password
    },
  };

  request(options, function(err, res, body) {
		var error = null;
		var success = null;

    if (res && (res.statusCode === 200)) {
			// Set MQTT client.id to correspond to Mainflux device UUID
			client.id = res.headers['x-client-id'];

      // Store password for future references
      client.password = password
			success = true
    } else {
			error = new Error('Auth error');
			error.returnCode = 4; // Bad username or password
			success = false
		}

		// Respond with auth error and success
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
  // Remove client password
  client.password = null
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
