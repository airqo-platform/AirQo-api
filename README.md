# AirQo-api

[![deploy-apis-to-production](https://github.com/airqo-platform/AirQo-api/actions/workflows/deploy-apis-to-production.yml/badge.svg)](https://github.com/airqo-platform/AirQo-api/actions/workflows/deploy-apis-to-production.yml) [![deploy-apis-to-staging](https://github.com/airqo-platform/AirQo-api/actions/workflows/deploy-apis-to-staging.yml/badge.svg)](https://github.com/airqo-platform/AirQo-api/actions/workflows/deploy-apis-to-staging.yml) [![run-tests](https://github.com/airqo-platform/AirQo-api/actions/workflows/test-changes.yml/badge.svg)](https://github.com/airqo-platform/AirQo-api/actions/workflows/test-changes.yml)

## What is AirQo??

The AirQo project aims to measure and quantify the scale of air pollution in and around Kampala City through the design, development and deployment of a network of low-cost air quality sensing devices mounted on either static or mobile objects.

## System Architecture.

**AirQo platform** is composed of many microservices written in different languages that talk to each other using Istio.

[![Architecture of
microservices](./docs/img/architecture-diagram.png)](./docs/img/architecture-diagram.png)

The [AirQo system architecture](https://github.com/airqo-platform/AirQo-api/wiki/System-Architecture) uses a mono repo for faster shipping. Each service has its own database. Consistency across these databases is maintained using an event driven approach. There is also an API gateway (Nginx) which clients use to access ther rest of the services. The state of the miscroservices is monitored using PM2. Deployment pattern is one service per container using Docker.

| Service                                        | Language               | Description                                                                                                                                                         |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [analytics](./src/analytics-service)           | Flask/Python & MongoDB | This is the one to be used for all analytics work                                                                                                                   |
                                                                          |
| [auth-service](./src/auth-service)             | Node.js                | Authentication services for this endpoint                                                                                                                           |
| [data-mgt](./src/data-mgt)                     | Node.js & MongoDB      | A fully-managed service for transforming/processing and enriching data in stream (real time) and batch (historical) modes with equal reliability and expressiveness |
| [device-registry](./src/device-registry) .     | Node.js                | Carry out the management of the devices.                                                                                                                            |
| [incetives](./src/incetives-service)           | Node.js                | The payment service to incetivise various stakeholders                                                                                                              |
| [predict](./src/predict)                       | Flask/Python & MongoDB | microservice to handle predictions or forecasts of air quality                                                                                                      |
                                                                                                        |
| [device-monitoring](./src/device-monitoring)   | Flask/Python & MongoDB | Monitoring the status of all devices on the network.                                                                                                                |
| [locate](./src/locate)                         | Flask/Python & MongoDB | microservice that consumes the model which recommend locations for placing devices                                                                                  |
| [calibrate](./src/locate)                      | Flask/Python & MongoDB | microservice that consumes the model which recommend locations for placing devices                                                                                  |
| [location-registry](./src/location-registry)   | Flask/Python & MongoDB | microservice that handles the registration of locations in the network                                                                                              |

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

## Deployment

To deploy on the AirQo platform
cd AirQo-api/src/microservice-name

**Build the image**
docker build -t eu.gcr.io/gcp-project-name/microservice-name .

**Run the container based on newly created image**
docker run -d -n best -p host-port:container-port eu.gcr.io/gcp-project-name/microservice-name

**The flags for running the container**

- p (publish)
  Asks Docker to forward traffic incoming on the host’s port host-port to the container’s port container-port. Containers have their own private set of ports, so if you want to reach one from the network, you have to forward traffic to it in this way. Otherwise, firewall rules will prevent all network traffic from reaching your container, as a default security posture.
- d (detach)
  asks Docker to run this container in the background.
- n (name)
  name you can use to specify the newly created container in subsequent commands. Above examples has the name as best.

**Visit the application in REST client or Web browser**
localhost:host-port. You should the application up and running. Now would be the time to run unit tests, for example:

**delete container after successful unit tests**
docker rm --force best.

**Share images on DockerHub or Google Container Registry**
docker push <host-name>/<GCP project>/<microservice-name>

- Example: docker push eu.gcr.io/airqo-api/airqo-device-registry-api

## Contributing

We invite you to help us build this platform. Please look up the [contributing guide](https://github.com/airqo-platform/AirQo-api/wiki) for details.

## Issues

Before reporting a problem, please check out the [issue guide](https://github.com/airqo-platform/AirQo-api/wiki#reporting-issues).
