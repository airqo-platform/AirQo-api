# Device Registry Microservice

[![Code Coverage](https://github.com/airqo-platform/AirQo-api/actions/workflows/codecov.yml/badge.svg)](https://github.com/airqo-platform/AirQo-api/actions/workflows/codecov.yml)
[![codecov](https://codecov.io/gh/airqo-platform/AirQo-api/branch/staging/graph/badge.svg)](https://codecov.io/gh/airqo-platform/AirQo-api)

Device Registry manages devices, sites, events, grids, cohorts, and the activities that occur within a monitoring network. It is the central registry for all physical and logical entities in the AirQo platform.

It follows the Model-View-Controller (MVC) architectural pattern and exposes a REST API on `/api/v2/devices`.

## Folder Structure

```text
.
├── bin
│   └── jobs          # 36 scheduled background jobs (cron)
├── config
│   ├── environments  # per-environment constants
│   └── global        # shared config (log4js, cloudinary, database, redis)
├── controllers       # request handlers (one per resource)
├── models            # Mongoose schemas
├── routes
│   ├── v1            # legacy routes (read-only, no new development)
│   └── v2            # active routes (31 route files)
├── utils
│   ├── common        # shared helpers (date, distance, generate-filter, etc.)
│   ├── messaging     # Kafka / notification utilities
│   ├── readings      # readings-specific transform helpers
│   ├── scripts       # one-off migration scripts
│   └── shared        # cross-cutting utilities (logging wrapper, etc.)
└── validators
    ├── common        # reusable validation chains
    └── shared        # shared validator helpers
```

For detailed naming conventions see [CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md).

## Features

- **Device Management** — create, edit, delete, and bulk-update devices; track deployment type, online status, and primary-device designation.
- **Site Management** — manage monitoring sites with admin-level tagging, duplicate-field detection, and metadata backfill.
- **Event / Measurement Management** — ingest, store, and query air-quality measurements; feed ThingSpeak and downstream consumers via Kafka.
- **Grid Management** — geospatial grid creation and flag maintenance; representative-site computation.
- **Cohort Management** — logical groupings of devices; cohort snapshots and private-cohort alerting.
- **Network Management** — network creation requests, coverage tracking, status monitoring, and uptime reporting.
- **Activity Monitoring** — log site and device activities; daily activity summaries.
- **Health Tips** — manage air-quality health tips tied to AQI ranges; periodic coverage checks.
- **Know Your Air (KYA)** — lessons, quizzes, questions, tasks, and per-user progress tracking.
- **Learn** — structured courses, units, lessons, and guest-session management.
- **Collocation** — batch collocation analysis between devices.
- **Forecasts** — store and serve device-level air-quality forecasts.
- **Signals** — near-real-time device signal queries with map and ranking endpoints.
- **Readings** — pre-aggregated best air-quality, worst-site, hourly, and nearest-site queries.
- **SDG Metrics** — annual PM2.5 population-weighted exposure metrics aligned to SDG 11.6.2.
- **Uptime Monitoring** — per-device and per-network uptime calculation and reporting.
- **Feeds** — ThingSpeak channel feed proxying and aggregation.
- **Lookups** — enriched device/site lookup for cross-service consumers.
- **Honeypot** — catches and logs unrecognised API probes for security visibility.

## Technical Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 with Express.js |
| Database | MongoDB (CQRS: separate command / query URIs) |
| Cache | Redis |
| Messaging | Apache Kafka |
| Image storage | Cloudinary |
| Background jobs | node-cron (36 scheduled jobs) |
| Authentication | AirQo JWT tokens (`Authorization: JWT <token>`) |
| Coverage | nyc + lcov → Codecov |
| Containerisation | Docker |
| Orchestration | Kubernetes |

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm
- MongoDB (local or remote — set `MONGO_URI` / `COMMAND_MONGO_URI` / `QUERY_MONGO_URI`)
- Redis (set `REDIS_SERVER` and `REDIS_PORT`)
- Kafka broker (optional — required for measurement ingestion)
- Cloudinary account (optional — required for photo upload)

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

4. **Set up your local environment**

   ```bash
   cp .env.development.template.json .env.development.json
   ```

   Open `.env.development.json` and fill in the required values before starting the service.

5. **Run the service**

   ```bash
   npm run dev
   ```

   The service starts on port `3000` by default and mounts all routes under `/api/v2/devices`.

### Running Tests

```bash
npm test
```

This runs the unit-test suite under `nyc` and writes an lcov coverage report to `coverage/lcov.info`. Coverage is uploaded to Codecov automatically in CI.

### Running with Docker

1. **Build the Docker image**

   ```bash
   docker build --target=<TARGET_STAGE> -t <IMAGE_NAME> .
   ```

2. **Run the Docker container**

   ```bash
   docker run -d --name <CONTAINER_NAME> -p <host-port>:<container-port> <IMAGE_NAME>
   ```

## Deployment

This project uses Kubernetes for container orchestration.

1. **Build the image**

   ```bash
   docker build --target=<TARGET_STAGE> -t <IMAGE_NAME> .
   ```

2. **Push to a container registry**

3. **Reference the image in your Kubernetes manifests**

## API Overview

All active endpoints are served under `/api/v2/devices`. Key resource groups:

| Path | Description |
|---|---|
| `/activities` | Device and site activity logs |
| `/sites` | Monitoring site management |
| `/events` | Raw measurement ingestion and query |
| `/readings` | Pre-aggregated air-quality queries |
| `/signals` | Near-real-time device signals |
| `/grids` | Geospatial grid management |
| `/cohorts` | Device cohort management |
| `/networks` | Network management and status |
| `/tips` | Health tips |
| `/kya` | Know Your Air content |
| `/learn` | Structured learning courses |
| `/collocations` | Device collocation batches |
| `/forecasts` | Device-level forecasts |
| `/uptime` | Device and network uptime |
| `/sdg/pm-annual` | SDG 11.6.2 PM2.5 metrics |
| `/photos` | Device and site photo management |
| `/locations` | Location registry |
| `/metadata` | Cross-resource metadata lookups |

## Contributing

We welcome contributions. Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
