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

// TODO: this one is depricated
// Sub on "core2mqtt"
nats.subscribe('mainflux/core/out', function(msg) {
	var m = JSON.parse(msg)

	// Ignore loopback:
	// if protocol is `mqtt` than this is the message
	// that already went through the MQTT borker, to the NATS and
	// has been re-published by the NATS
	if (m.protocol == "mqtt")
		return

	var packet = {
		cmd: 'publish',
		qos: 2,
		topic: "mainflux/channels/" + m.channel,
		payload: Buffer.from(m.payload, 'base64'),
		retain: false
	} 

	aedes.publish(packet, null)
});

// Sub on "core2mqtt"
nats.subscribe('msg.http', function(msg) {
	var m = JSON.parse(msg)
	var packet = {
		cmd: 'publish',
		qos: 2,
		topic: "msg/" + m.channel,
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
	// Topics are in the form `mainflux/channels/<channel_id>`
	msg.channel = packet.topic.split("/")[2] // TODO: For version with `msg/<channel_id>` there should be just [1]
	msg.protocol = "mqtt"

	// TODO: this one is depricated
	// Pub on "mqtt2core"
	nats.publish('mainflux/core/in', JSON.stringify(msg));

	// Pub on "mqtt2core"
	nats.publish('msg.mqtt', JSON.stringify(msg));

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
