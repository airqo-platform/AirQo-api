# Beacon Service

> High-performance device management and performance analytics microservice for AirQo's air quality monitoring network.

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/release/python-3110/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.105.0-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-336791.svg)](https://www.postgresql.org/)

## Overview

The Beacon Service is a comprehensive API for managing AirQo's air quality monitoring device fleet. It provides real-time device tracking, performance analytics, firmware management, and data quality metrics across the monitoring infrastructure.

### Key Features

- 📡 **Device Management** - Full lifecycle management for air quality monitors
- 📊 **Performance Analytics** - Hourly/daily metrics with data completeness tracking
- 🗂️ **AirQloud Clusters** - Logical grouping and performance aggregation
- 🔧 **Firmware OTA** - Over-the-air firmware distribution with version control
- 📦 **Inventory Tracking** - Stock management with audit history
- ⏰ **Scheduled Jobs** - Automated daily performance data collection

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI 0.105 |
| Runtime | Python 3.11 |
| Database | PostgreSQL 13+ with SQLModel ORM |
| Migrations | Alembic |
| Caching | Redis 5.0+ |
| Scheduler | APScheduler |
| Cloud Storage | Google Cloud Storage |
| Container | Docker (multi-stage build) |

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 13+
- Redis (optional, for caching)
- Docker 20.10+ (for containerized deployment)

### Local Development

```bash
# Clone and navigate to the service
cd src/beacon-api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (see Configuration section)
cp .env.example .env

# Run the service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker Deployment

```bash
# Build for staging (with hot reload)
docker build --target staging -t beacon-service:staging .

# Build for production
docker build --target production -t beacon-service:latest .

# Run container
docker run -d -p 8000:8000 --env-file .env beacon-service:latest
```

## Configuration

Configure via environment variables or `.env` file:

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_SERVER` | Database host | `localhost` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_USER` | Database user | `airqo` |
| `POSTGRES_PASSWORD` | Database password | `airqo` |
| `POSTGRES_DB` | Database name | `beacon_db` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `SECRET_KEY` | Application secret key | Required |
| `ENVIRONMENT` | Deployment environment | `development` |
| `DEBUG` | Enable debug mode | `True` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Firmware & Storage Settings

| Variable | Description | Required |
|----------|-------------|----------|
| `ORG_TOKEN` | Organization token for firmware API | Yes (for firmware) |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket | Yes (for firmware) |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP service account JSON | Yes (for firmware) |

### Performance Thresholds

| Variable | Description | Default |
|----------|-------------|---------|
| `UPTIME_THRESHOLD_GOOD` | Good uptime percentage | `90.0` |
| `UPTIME_THRESHOLD_MODERATE` | Moderate uptime percentage | `70.0` |
| `DATA_COMPLETENESS_THRESHOLD_GOOD` | Good data completeness | `85.0` |
| `DATA_COMPLETENESS_THRESHOLD_MODERATE` | Moderate data completeness | `60.0` |

## API Reference

### Documentation

- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`
- **OpenAPI Schema**: `/openapi.json`

### Endpoints Overview

#### Devices (`/devices`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/devices/` | List devices with pagination, filtering, and search |
| `GET` | `/devices/stats` | Comprehensive device statistics |
| `GET` | `/devices/map-data` | Device locations with latest readings |
| `GET` | `/devices/{device_id}` | Get specific device details |

#### AirQlouds (`/airqlouds`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/airqlouds/` | List AirQloud clusters with device counts |
| `POST` | `/airqlouds/` | Create new AirQloud |
| `GET` | `/airqlouds/{id}` | Get AirQloud details |
| `POST` | `/airqlouds/{id}/devices` | Add devices to AirQloud |

#### Performance (`/performance`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/performance/devices` | Query device performance metrics |
| `POST` | `/performance/airqlouds` | Query AirQloud performance metrics |

#### Firmware (`/firmware`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/firmware/upload` | Upload new firmware (requires ORG_TOKEN) |
| `GET` | `/firmware/` | List available firmware versions |
| `GET` | `/firmware/{id}/download` | Download firmware binary |
| `DELETE` | `/firmware/{id}` | Delete firmware version |

#### Data Management (`/data`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/data/metadata` | Update device metadata |
| `POST` | `/data/configs` | Update device configurations |
| `GET` | `/data/field-values` | Get device field values |

#### Categories (`/categories`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories/` | List all device categories |
| `POST` | `/categories/` | Create new category |
| `GET` | `/categories/{name}` | Get category with associated devices |

#### Inventory (`/items-stock`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/items-stock/` | List inventory items with filtering |
| `POST` | `/items-stock/` | Create inventory item |
| `PATCH` | `/items-stock/{id}` | Update stock quantity |
| `GET` | `/items-stock/{id}/history` | Get stock movement history |

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /` | Service info and status |
| `GET /health` | Basic health check |
| `GET /ready` | Readiness probe with dependency checks |

## Project Structure

```
beacon-api/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── deps.py              # Dependency injection
│   ├── configs/
│   │   ├── settings.py      # Configuration management
│   │   └── database.py      # Database connection & migrations
│   ├── models/              # SQLModel data models
│   ├── crud/                # Database operations
│   ├── routes/              # API route handlers
│   └── utils/               # Helper functions & background tasks
├── cronjobs/
│   ├── performance_jobs/    # ThingSpeak data fetchers
│   └── field_data_jobs/     # Field data collection jobs
├── postgres/
│   ├── init/                # Initial database setup
│   └── migrations/          # SQL migration scripts
├── scheduler.py             # APScheduler job definitions
├── Dockerfile               # Multi-stage Docker build
├── requirements.txt         # Python dependencies
└── alembic.ini              # Alembic configuration
```

## Background Jobs

The service includes scheduled jobs for automated data collection:

```bash
# Run the scheduler (executes daily at 4:00 AM)
python scheduler.py
```

### Scheduled Tasks

| Job | Schedule | Description |
|-----|----------|-------------|
| `daily_airqloud_fetch` | 04:00 AM daily | Fetch 14-day performance data for all AirQlouds |

## Database Migrations

```bash
# Generate new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1
```

## Development

### Code Quality

```bash
# Format code
black app/

# Sort imports
isort app/

# Lint
flake8 app/

# Type checking
mypy app/
```

### Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app --cov-report=html
```

## Security Considerations

> ⚠️ **Production Deployment Notes**

- **Authentication**: Currently no authentication. Implement via API gateway with TLS termination for production.
- **Rate Limiting**: Not implemented. Add rate limiting at gateway level to prevent abuse.
- **CORS**: Configured to allow all origins (`*`). Restrict in production.

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify credentials
psql -h localhost -U airqo -d beacon_db
```

**Redis Connection Failed**
```bash
# Check Redis is running
redis-cli ping
```

**Migration Errors**
```bash
# Check current migration state
alembic current

# Force migration state
alembic stamp head
```

## Related Documentation

- [API Endpoints Reference](API_ENDPOINTS.md) - Detailed endpoint documentation

## License

Proprietary - AirQo Hardware

## Support

Internal service - Contact the hardware team for support.