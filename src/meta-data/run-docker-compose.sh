#!/bin/bash

export DOCKER_BUILDKIT=1
docker-compose -f docker-compose.yml up --build