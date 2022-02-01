#!/bin/bash

export DOCKER_BUILDKIT=1
docker-compose -f docker-compose-dev.yaml up --build