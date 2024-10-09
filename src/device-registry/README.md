# Device Registry Microservice

![Coverage Status](https://coveralls.io/repos/github/airqo-platform/AirQo-api/src/device-registry/badge.svg)

The Device Registry microservice is responsible for managing the creation of devices, sites, and events, along with handling the associated activities that occur within a site.

## Features

- **Device Management**: Create, edit, and delete devices.
- **Site Management**: Manage sites associated with devices.
- **Event Management**: Log and manage events (measurements) related to devices and sites.
- **Activity Monitoring**: Track activities occurring within the site.
- **Cohort Management**: Manage Cohorts associated with devices.
- **Grid Management**: Manage Grids associated with sites.
- **Health Tips Management**: Manage Health Tips associated with Measurements.
- **Know Your Air (KYA) Management**: Manage Know Your Air (KYA) lessons and quizzes.

## Technical Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB
- **Authentication**: AirQo Tokens
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Getting Started

### Prerequisites

Ensure you have the following installed:

- Node.js (version 14 or higher)
- Docker (if using Docker for deployment)

### Running Locally

1. **Clone the repository**

   ```bash
   git clone https://github.com/airqo-platform/AirQo-api.git
   ```

2. **Navigate to the microservice directory**

   ```bash
   cd AirQo-api/src/device-registry
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Run the service**

   - On macOS:

     ```bash
     npm run dev-mac
     ```

   - On Windows:

     ```bash
     npm run dev-pc
     ```

### Running with Docker

1. **Build the Docker image**

   ```bash
   docker build --target={TARGET_STAGE} -t {IMAGE_NAME} .
   ```

2. **Run the Docker container**

   ```bash
   docker run -d --name {CONTAINER_NAME} -p host-port:container-port {IMAGE_NAME}
   ```

After successfully running the container, you can test the respective endpoints.

## Deployment

This project utilizes Kubernetes for container orchestration.

1. **Build the image within the microservice's directory**

   ```bash
   docker build --target={TARGET_STAGE} -t {IMAGE_NAME} .
   ```

2. **Push the image to a Docker registry**

3. **Use the images in your Kubernetes deployment files accordingly**

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
