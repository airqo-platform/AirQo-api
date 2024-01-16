#!/bin/bash

export DOCKER_BUILDKIT=1
# For Windows, uncomment the line below and comment the line above
# set DOCKER_BUILDKIT=1
docker-compose -f docker-compose.yaml up --build db db-setup webserver scheduler