#!/bin/bash

export DOCKER_BUILDKIT=1
docker-compose -f docker-compose.yaml up --build db db-setup webserver scheduler

#WINDOW
set DOCKER_BUILDKIT=1
docker-compose -f docker-compose.yaml up --build db db-setup webserver scheduler