## AirQo-api

[![BCH compliance](https://bettercodehub.com/edge/badge/airqo-platform/AirQo-api?branch=master)](https://bettercodehub.com/) [![Build Status](https://travis-ci.com/airqo-platform/AirQo-api.svg?branch=master)](https://travis-ci.com/airqo-platform/AirQo-api) [![codecov](https://codecov.io/gh/airqo-platform/AirQo-api/branch/master/graph/badge.svg)](https://codecov.io/gh/airqo-platform/AirQo-api)


## What is AirQo?
The AirQo project aims to measure and quantify the scale of air pollution in and around Kampala City through the design, development and deployment of a network of low-cost air quality sensing devices mounted on either static or mobile objects.

## System Architecture

**AirQo platform** is composed of many microservices written in different languages that talk to each other using Istio.

[![Architecture of
microservices](./docs/img/architecture-diagram.png)](./docs/img/architecture-diagram.png)

The [AirQo system architecture](https://github.com/airqo-platform/AirQo-api/wiki/System-Architecture) uses a mono repo for faster shipping. Each service has its own database. Consistency across these databases is maintained using an event driven approach. There is also an API gateway (Nginx) which clients use to access ther rest of the services. The state of the miscroservices is monitored using PM2. Deployment pattern is one service per container using Docker.

| Service                                                           | Language      | Description                                                                                                                       |
| ----------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [analytics-service](./src/analytics-service)                      | Flask/Python & MongoDB        | This is the one to be used for all analytics work                                                                            |
| [app-enable-service](./src/app-enable-service)                    | Node.js        | To enable any application that consumes the services of this platform.                                                            |
| [auth-service](./src/auth-service)                                | Node.js       | Authentication services for this endpoint                                                                                  |
| [data-mgt-service](./src/data-mgt-service)                        | Flask/Python & MongoDB | A fully-managed service for transforming/processing and enriching data in stream (real time) and batch (historical) modes with equal reliability and expressiveness                                                                            |
| [device-registry-service](./src/device-registry) .        | Node.js        | Carry out the management of the devices                                                                                           |
| [incetives-service](./src/incetives-service)                      | Node.js        | The payment service to incetivise various stakeholders                                                                      |
| [ml-service](./src/ml-service)                                    | Flask/Python & MongoDB        | The machine learning models for predictions and forecasts                                                                 |
| [monitoring-service](./src/monitoring-service)                    | Node.js        | Monitoring the health of all the microservices                                                                             |
| [noitification-service](./src/notification-service)               | Node.js        | Takes care of all the notification needs of the application.                                                                       |
                                           

## Features
- Multi-protocol connectivity (HTTP and MQTT)
- Device management
- Access control
- Incetives
- Message persistence (MongoDB and PostgresSQL)
- Container-based deployment using [Docker](https://www.docker.com/) and [Kubernetes](https://kubernetes.io/)
- Microservices architecture, high-quality code and test coverage

## Installation and Usage

1. **Running locally with “Docker for Desktop”** You will build and deploy microservices images to a single-node Kubernetes cluster running on your development machine.

2. **Running on Google Compute Engine (GCE)”** You will build, upload and deploy the container images to a Kubernetes cluster on Google Cloud Engine.


## Contributing
We invite you to help us build this platform. Please look up the [contributing guide](https://github.com/airqo-platform/AirQo-api/wiki/Coding-Guidelines) for details.

## Issues
Before reporting a problem, please check out the [issue guide](https://github.com/airqo-platform/AirQo-api/wiki/Coding-Guidelines).
