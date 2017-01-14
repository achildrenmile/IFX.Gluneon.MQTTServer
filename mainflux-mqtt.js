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
nats.subscribe('mainflux/core/mqtt', function(msg) {
  console.log('Received a message: ' + msg);

	var m = JSON.parse(msg)

	var packet = {
		cmd: 'publish',
		qos: 2,
		topic: m.topic,
		payload: Buffer.from(atob(m.payload)),
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
	msg.payload = packet.payload.toJSON().data
	msg.topic = packet.topic

	// Pub on "mqtt2core"
	nats.publish('mainflux/mqtt/core', JSON.stringify(msg));

	console.log("publishing")

	callback(null)
}

/**
 * Handlers
 */
aedes.on('clientError', function (client, err) {
  console.log('client error', client.id, err.message, err.stack)
})

aedes.on('publish', function (packet, client) {
  if (client) {
    console.log('message from client', client.id)
  }
})

aedes.on('client', function (client) {
  console.log('new client', client.id)
})

aedes.on('clientDisconnect', function(client) {
  console.log('client disconnect', client.id)
})

aedes.on('subscribe', function(topic, client) {
  console.log('client subscribe', topic, client.id)
})

aedes.on('unsubscribe', function(topic, client) {
  console.log('client usubscribe', topic, client.id)
})
