/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */
var config = require('./config/config')
var aedes = require('aedes')()
var server = require('net').createServer(aedes.handle)
var httpServer = require('http').createServer()
var ws = require('websocket-stream')
var nats = require('nats').connect('nats://' + config.nats.host + ':' + config.nats.port);

/**
 * Aedes
 */
server.listen(config.mqtt.port, function () {
  console.log('server listening on port', config.mqtt.port)
})

/**
 * WebSocket
 */
ws.createServer({
  server: httpServer
}, aedes.handle)

httpServer.listen(config.mqtt.wsPort, function () {
  console.log('websocket server listening on port', config.mqtt.wsPort)
})

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
