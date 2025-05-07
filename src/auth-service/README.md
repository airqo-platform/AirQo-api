# Authentication Service

This authentication microservice is a crucial component of our application's security infrastructure. It handles user authentication & authorization, ensuring that only authenticated users can access protected resources.

## Features

- **User Authentication**: Registration, login, and password management
- **Token-based Authentication**: JWT for stateless authentication
- **Role-based Authorization**: Granular permissions with RBAC
- **User Profile Management**: Update personal details and preferences
- **Redundant Message Broker System**: Fault-tolerant messaging with automatic failover between multiple brokers
- **Security Measures**: Password hashing, encryption, and API protection

## Folder Structure

```
.
├── bin
│   ├── index.js           # Application entry point
│   ├── server.js          # Express server setup
│   ├── start-consumer.js  # Message consumer initialization
│   └── jobs               # Background processing jobs
├── config
│   ├── constants.js       # Application constants including broker config
│   ├── environments
│   ├── global
│   └── images
├── controllers
├── middleware
├── models
├── routes
│   ├── v1
│   └── v2
│       ├── index.js       # Routes aggregator
│       └── ...            # Route files
├── utils
│   ├── common
│   ├── messaging          # Message broker implementation
│   ├── scripts
│   └── shared
└── validators
```

For detailed information on the project's code structure and naming conventions, please refer to the [CODEBASE_STRUCTURE](CODEBASE_STRUCTURE.md).

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm (or yarn)
- MongoDB (local or remote; configure `DB_URL` if remote)
- At least one message broker (Kafka, Redis, RabbitMQ, or NATS)

### Message Broker Setup

The application uses a redundant message broker system that automatically fails over between multiple broker technologies. For quick setup:

```bash
# Create and start all brokers using Docker
mkdir -p ~/message-brokers && cd ~/message-brokers
curl -O https://raw.githubusercontent.com/airqo-platform/AirQo-api/main/src/auth-service/docker-compose.yml
docker compose up -d
```

For detailed message broker setup, configuration, and management instructions, see [MESSAGE_BROKERS.md](MESSAGE_BROKERS.md).

### Installation

1. Clone the repository: `git clone https://github.com/airqo-platform/AirQo-api.git`
2. Navigate to the project directory: `cd auth-service`
3. Install dependencies: `npm install`
4. Create a `.env` file in the project root (see `.env.example` for required variables)

### Running Locally

1. Start at least one message broker (or none - the app will still function)
2. Start the development server: `npm run dev`

### Running in Production (Docker)

1. Build the Docker image: `docker build -t auth-service .`
2. Run the Docker container: `docker run -d -p 3000:3000 --env-file .env auth-service`

## Message Broker Architecture

The service implements a robust message broker abstraction layer that provides automatic failover between different broker technologies. Key features:

- **Automatic Failover**: If the active broker fails, the system switches to an alternative
- **Graceful Degradation**: The application continues to function even when all brokers are unavailable
- **Health Monitoring**: Periodic checks detect broker failures and trigger reconnection

For details on the architecture, broker implementation, and customization, see [MESSAGE_BROKERS.md](MESSAGE_BROKERS.md).

## Testing

Run tests using: `npm test`

For testing the broker failover mechanism, see the testing section in [MESSAGE_BROKERS.md](MESSAGE_BROKERS.md).

## Troubleshooting

For common issues and troubleshooting steps related to message brokers, see the troubleshooting section in [MESSAGE_BROKERS.md](MESSAGE_BROKERS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
