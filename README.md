## AirQo-api
This repo contains API definitions for the AirQo platform


## What is AirQo?
The AirQo project aims to measure and quantify the scale of air pollution in and around Kampala City through the design, development and deployment of a network of low-cost air quality sensing devices mounted on either static or mobile objects.

## System Architecture

**AirQo platform** is composed of many microservices written in different languages that talk to each other using Istio.

[![Architecture of
microservices](./docs/img/architecture-diagram.png)](./docs/img/architecture-diagram.png)

The [AirQo system architectures](https://github.com/airqo-platform/AirQo-api/wiki/System-Architecture) uses a mono repo for faster shipping. Each service has its own database. Consistency across these databases is maintained using an event driven approach. There is also an API gateway (Nginx) which clients use to access ther rest of the services. The state of the miscroservices is monitored using PM2. Deployment pattern is one service per container using Docker.

## Features
- Multi-protocol connectivity (HTTP and MQTT)
- Device management
- Access control
- Incetives
- Message persistence (MongoDB and PostgresSQL)
- Container-based deployment using [Docker](https://www.docker.com/) and [Kubernetes](https://kubernetes.io/)
- Microservices architecture, high-quality code and test coverage

## Installation and Usage


## Supported Platforms


## Contributing
We invite you to help us build this platform. Please look up the [contributing guide](https://github.com/airqo-platform/AirQo-api/wiki/Coding-Guidelines) for details.

## Issues
Before reporting a problem, please check out the [issue guide](https://github.com/airqo-platform/AirQo-api/wiki/Coding-Guidelines).
