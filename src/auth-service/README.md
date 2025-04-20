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

Let me correct the folder structure section to reflect the correct organization where health.routes.js is located under the v2 folder:

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
│   └── health.controller.js # Health check endpoints
├── middleware
├── models
├── routes
│   ├── v1
│   └── v2
│       ├── index.js       # Routes aggregator
│       ├── health.routes.js # Health monitoring routes
│       └── ...            # Other route files
├── utils
│   ├── common
│   ├── messaging          # Message broker implementation
│   │   ├── broker-factory.js        # Creates broker instances
│   │   ├── messaging-service.js     # High-level messaging API
│   │   ├── redundancy-manager.js    # Handles failover between brokers
│   │   └── brokers                  # Individual broker implementations
│   │       ├── base-broker.js       # Abstract broker interface
│   │       ├── kafka-broker.js      # Kafka implementation
│   │       ├── rabbitmq-broker.js   # RabbitMQ implementation
│   │       ├── redis-broker.js      # Redis implementation
│   │       └── nats-broker.js       # NATS implementation
│   ├── scripts
│   └── shared
└── validators
    └── health.validators.js # Validation for health endpoints
```

For detailed information on the project's code structure and naming conventions, please refer to the [CODEBASE_STRUCTURE](CODEBASE_STRUCTURE.md).

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm (or yarn)
- MongoDB (local or remote; configure `DB_URL` if remote)
- At least one message broker:
  - Kafka
  - Redis
  - RabbitMQ
  - NATS

### Message Broker Setup

The application is designed to work with multiple message brokers for redundancy. You can set up any or all of the following brokers:

#### Option 1: All-in-One Docker Setup

The easiest way to run all message brokers locally is using Docker:

```bash
# Create a directory for the Docker Compose file
mkdir -p ~/message-brokers
cd ~/message-brokers

# Create the docker-compose.yml file
cat > docker-compose.yml << 'EOL'
version: '3'
services:
  # Kafka & Zookeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:7.3.2
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.3.2
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  # Redis
  redis:
    image: redis:7.0-alpine
    container_name: redis
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3.12-management
    container_name: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest

  # NATS
  nats:
    image: nats:2.9
    container_name: nats
    ports:
      - "4222:4222"
      - "8222:8222"
    command: "-m 8222"
EOL

# Start all message brokers
docker compose up -d
```

#### Option 2: Individual Broker Setup

See the [MESSAGE_BROKERS.md](MESSAGE_BROKERS.md) for detailed setup instructions for each individual broker.

### Installation

1. Clone the repository: `git clone https://github.com/airqo-platform/AirQo-api.git`
2. Navigate to the project directory: `cd auth-service`
3. Install dependencies: `npm install`

### Configuration

Create a `.env` file in the project root with the following message broker configurations:

```
# Message Broker Configuration
MESSAGE_BROKER_PRIORITIES=kafka,redis,rabbitmq,nats
MESSAGE_BROKER_ALLOW_NO_CONNECTION=true
MESSAGE_BROKER_CONNECTION_TIMEOUT_MS=5000
MESSAGE_BROKER_INITIAL_DELAY_MS=1000
ENABLE_MESSAGE_CONSUMER=true

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CLIENT_ID=airqo-auth-service
UNIQUE_PRODUCER_GROUP=auth-service-producer
UNIQUE_CONSUMER_GROUP=auth-service-consumer
DEPLOY_TOPIC=deploy-topic
RECALL_TOPIC=recall-topic
SITES_TOPIC=sites-topic
IP_ADDRESS_TOPIC=ip-address

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# NATS Configuration
NATS_SERVERS=nats://localhost:4222

# Health Check Configuration
INTERNAL_API_KEY=your-secure-api-key-here
HEALTH_CHECK_RATE_LIMIT_MAX=10
HEALTH_CHECK_RATE_LIMIT_WINDOW_MS=60000
```

### Running Locally

1. Start at least one message broker (see setup instructions above)
2. Start the development server: `npm run dev`

The application will start even if no message brokers are available, thanks to the resilient design.

### Running in Production (Docker)

1. Build the Docker image: `docker build -t auth-service .`
2. Run the Docker container: `docker run -d -p 3000:3000 --env-file .env auth-service`

## Message Broker Architecture

The service implements a robust message broker abstraction layer that provides automatic failover between different broker technologies.

### Key Components

- **Broker Factory**: Creates instances of specific broker implementations
- **Redundancy Manager**: Handles failover between brokers and health monitoring
- **Messaging Service**: Provides a high-level API for publishing and subscribing to messages
- **Broker Implementations**: Adapters for specific message broker technologies

### Resilient Design Features

- **Non-blocking Initialization**: The application starts and operates even if all message brokers are unavailable
- **Automatic Failover**: If the active broker fails, the system automatically switches to the next available broker
- **Priority-based Selection**: Brokers are tried in the order specified in `MESSAGE_BROKER_PRIORITIES`
- **Health Monitoring**: Periodic health checks detect broker failures and trigger reconnection attempts
- **Graceful Degradation**: The application continues to function with reduced capabilities when brokers are unavailable

### Health Endpoints

The service provides several health check endpoints:

- **Basic Health**: `GET /api/health` - Public endpoint showing basic API status
- **Message Broker Health**: `GET /api/v2/health/message-broker` - Authenticated endpoint showing broker status
- **Detailed Broker Health**: `GET /api/v2/health/internal/message-broker` - Internal API key protected endpoint with detailed broker information

## Modifying the Message Broker System

If you need to modify the message broker implementation:

1. **Adding a New Broker Type**:

   - Create a new implementation in `utils/messaging/brokers/`
   - Add it to the broker factory in `utils/messaging/broker-factory.js`
   - Update the `MESSAGE_BROKER_PRIORITIES` environment variable to include the new broker

2. **Changing Broker Behavior**:

   - Modify the specific broker implementation in `utils/messaging/brokers/`
   - Ensure it continues to implement all methods required by the `BaseBroker` class

3. **Adding a New Topic Handler**:
   - Add a new handler function in `bin/jobs/message-consumer.js`
   - Add it to the `topicHandlers` mapping with the appropriate topic name

## Testing

Run tests using: `npm test`

To test the broker failover mechanism:

1. Start the application with multiple brokers configured
2. Use the health endpoint to check which broker is active: `GET /api/v2/health/message-broker`
3. Stop the active broker (e.g., `docker stop kafka`)
4. Observe in the logs that the system fails over to the next broker
5. Verify through the health endpoint that a different broker is now active

## Troubleshooting

### Common Issues

- **Connection Failures**: Check that the broker is running and the connection details are correct in your `.env` file
- **Message Not Delivered**: Verify that topics exist and permissions are correctly set
- **Consumer Not Starting**: Ensure `ENABLE_MESSAGE_CONSUMER` is set to `true`
- **Slow Startup**: Adjust `MESSAGE_BROKER_CONNECTION_TIMEOUT_MS` if broker connections are timing out too quickly

### Logs to Check

- Application logs will include broker connection attempts and failovers
- Check for messages like "Successfully connected to [broker] broker" or "Failed to connect to [broker] broker"
- The health endpoint will show the currently active broker

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
