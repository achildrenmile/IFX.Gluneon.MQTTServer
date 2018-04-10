/**
 * Copyright (c) Mainflux
 *
 * Mainflux server is licensed under an Apache license, version 2.0 license.
 * All rights not explicitly granted in the Apache license, version 2.0 are reserved.
 * See the included LICENSE file for more details.
 */

'use strict';

var http = require('http');
var websocket = require('websocket-stream');
var net = require('net');
var aedes = require('aedes')();
var logging = require('aedes-logging');
var request = require('request');
const util = require('util')

var config = require('./mqtt.config');

var protobuf = require('protocol-buffers');
const fs = require('fs');

// pass a proto file as a buffer/string or pass a parsed protobuf-schema object
var message = protobuf(fs.readFileSync('message.proto'));

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
    server.listen(config.ws_port);
    return server;
}
/**
 * MQTT
 */
function startMqtt() {
    return net.createServer(aedes.handle).listen(config.mqtt_port);
}

/**
 * Hooks
 */
// AuthZ PUB TODO for Gluneon
 aedes.authorizePublish = function (client, packet, callback) {
    
     if(packet.topic!=="admin")//on Admin Channel everyone who is authorized can, any time
     {
         // Topics are in the form `gluneonio//<channel_id>/messages/senml-json`
         var project = packet.topic.split('/')[2];

         /**
          * Check if PUB is authorized
          */
         var options = {
             url: config.auth_url + ':' + config.auth_port + '/accessgrant/' + project,
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': client.password
             }
         };

         request(options, function (err, res) {
             var error = null;
             var msg = {};
             if (res && (res.statusCode === 200)) {
                 console.log('Publish authorized OK');

             var msg = message.RawMessage.encode({
                 Publisher: client.id,
                 Project: project,
                 Protocol: 'mqtt',
                 ContentType: packet.topic.split('/')[4],
                 Payload: packet.payload
                 });

                 console.log(msg);

                 console.log(util.inspect(packet, false, null))

             } else {
                 console.log('Publish not authorized');
                 error = 4; // Bad username or password
             }
             callback(error);
         });
     }
 };

//AuthZ SUB Todo for Gluneon
aedes.authorizeSubscribe = function (client, packet, callback) {
    // Topics are in the form `mainflux/channels/<channel_id>/messages/senml-json`
    var channel = packet.topic.split('/')[2];
    /**
    * Check if PUB is authorized
    */
    var options = {
        url: config.auth_url + ':' + config.auth_port + '/v1/accessgrant/',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': client.password
        }
    };

    request(options, function (err, res) {
        var error = null;
        if (res && (res.statusCode === 200)) {
            console.log('Subscribe authorized OK');
        } else {
            console.log('Subscribe not authorized');
            error = 4; // Bad username or password
        }
        callback(error, packet);
    });
};

// AuthX
aedes.authenticate = function (client, username, password, callback) {
    var c = client;
    var options = {
        url: config.auth_url + ':' + config.auth_port + '/api/v1/accessgrant/',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': password
        }
    };
    request(options, function (err, res) {
        var error = null;
        var success = null;
        if (res && (res.statusCode === 200)) {
            // Set MQTT client.id to correspond to Mainflux device UUID
            c.id = res.headers['x-client-id'];
            // Store password for future references
            c.password = password;
            success = true;
        } else {
            error = new Error('Auth error');
            error.returnCode = 4; // Bad username or password
            success = false;
        }
        // Respond with auth error and success
        callback(error, success);
    });
};
/**
 * Handlers
 */
aedes.on('clientDisconnect', function (client) {
    var c = client;
    console.log('client disconnect', client.id);
    // Remove client password
    c.password = null;
});

aedes.on('clientError', function (client, err) {
  console.log('client error', client.id, err.message, err.stack)
})

aedes.on('connectionError', function (client, err) {
  console.log('client error', client, err.message, err.stack)
})
