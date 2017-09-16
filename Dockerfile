###
# Mainflux Dockerfile
###
# Set the base image to Node, onbuild variant: https://registry.hub.docker.com/_/node/

FROM node:6.9.5-alpine
MAINTAINER Mainflux

###
# Installations
###
# Add Gulp globally

RUN npm install -g gulp
RUN npm install -g nodemon

# Finally, install all project Node modules
COPY . /
RUN npm install

EXPOSE 1883

###
# Run main command with dockerize
###
CMD node mqtt_adapter.js

