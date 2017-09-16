###
# Mainflux Dockerfile
###
# Set the base image to Node, onbuild variant: https://registry.hub.docker.com/_/node/

FROM node:6.9.5-alpine
MAINTAINER Mainflux

ENV MAINFLUX_MQTT_PORT 1883
ENV MAINFLUX_MQTT_WS_PORT 8883

ENV MAINFLUX_INSTALL_DIR opt/mainflux-mqtt

###
# Installations
###
# Add Gulp globally

RUN npm install -g gulp
RUN npm install -g nodemon

# Add config
RUN mkdir -p /etc/mainflux/mqtt

# Finally, install all project Node modules
RUN mkdir -p $MAINFLUX_INSTALL_DIR
COPY . $MAINFLUX_INSTALL_DIR
WORKDIR $MAINFLUX_INSTALL_DIR
RUN npm install

EXPOSE $MAINFLUX_MQTT_PORT
EXPOSE $MAINFLUX_MQTT_WS_PORT

###
# Run main command with dockerize
###
CMD node mqtt_adapter.js

