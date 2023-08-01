# Data Management Microservice

![Node.js](https://img.shields.io/badge/node-%3E%3D%2012.0.0-brightgreen.svg)
![Docker](https://img.shields.io/docker/v/<your_docker_username>/iot-measurements-microservice)

## Overview

This data management microservice is a Node.js-based application deployed using Docker. It retrieves measurements from another system related to devices and performs various transformations to enhance the data with more descriptive field names. Additionally, the microservice monitors faults in the device data and appropriately flags them.

## Features

- Fetches device measurements from external system
- Transforms measurements into a new format with descriptive field names
- Performs additional data transformations as needed
- Monitors faults in device data and flags them for further analysis

## Installation

1. Clone the repository.
2. Install dependencies using `npm install`.

## Usage

1. Ensure Docker is installed on your system.
2. Build the Docker image: `docker build -t data-mgt .`
3. Run the Docker container: `docker run -p 3000:3000 data-mgt`

## API Endpoints

### GET /measurements

Retrieves device measurements in the new format.

## Configuration

Environment variables:

- `PORT` (default: 3000) - The port on which the microservice will run.

## Contributing

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature`.
3. Commit your changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

