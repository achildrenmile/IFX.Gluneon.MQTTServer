###
# Mainflux Dockerfile
###
# Set the base image to Node, onbuild variant: https://registry.hub.docker.com/_/node/

FROM node:6.9.5-alpine
MAINTAINER Mainflux

ENV MAINFLUX_MQTT_PORT 1883
ENV MAINFLUX_MQTT_WS_PORT 8883

ENV MAINFLUX_INSTALL_DIR opt/mainflux-mqtt

ENV NATS_HOST nats
ENV NATS_PORT 4222

RUN apk update && apk add wget && rm -rf /var/cache/apk/*

###
# Installations
###
# Add Gulp globally

RUN npm install -g gulp
RUN npm install -g nodemon

# Add config
RUN mkdir -p /etc/mainflux/mqtt
COPY config/config-docker.toml /etc/mainflux/mqtt/config.toml

# Finally, install all project Node modules
RUN mkdir -p $MAINFLUX_INSTALL_DIR
COPY . $MAINFLUX_INSTALL_DIR
WORKDIR $MAINFLUX_INSTALL_DIR
RUN npm install

EXPOSE $MAINFLUX_MQTT_PORT
EXPOSE $MAINFLUX_MQTT_WS_PORT

# Dockerize
ENV DOCKERIZE_VERSION v0.2.0
RUN wget --no-check-certificate https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
	&& tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

###
# Run main command with dockerize
###
CMD dockerize -wait tcp://$NATS_HOST:$NATS_PORT \
				-timeout 10s node mainflux-mqtt.js /etc/mainflux/mqtt/config.toml
