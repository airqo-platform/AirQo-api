# Beacon Service.

Air quality monitoring device management and analytics microservice.

## Overview

High-performance FastAPI microservice providing real-time device monitoring, performance analytics, and comprehensive data quality metrics for air quality monitoring infrastructure.

## Architecture

- **Framework**: FastAPI (Python 3.11)
- **Database**: PostgreSQL with SQLModel ORM
- **Caching**: Redis
- **Container**: Docker
- **API Specification**: OpenAPI 3.0

## Installation

### Prerequisites

- Docker 20.10+
- PostgreSQL 13+
- Python 3.11+ (for local development)

### Deployment

```bash
docker build -t beacon-backend .
docker run -d -p 8000:8000 --env-file .env beacon-backend
```

### Local Development

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Configuration

Configuration via environment variables. See `.env.example` for required variables.

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_SERVER` | Database host | Yes |
| `POSTGRES_USER` | Database user | Yes |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `SECRET_KEY` | JWT signing key | Yes |
| `REDIS_URL` | Redis connection URL | No |
| `ORG_TOKEN` | Organization token for firmware API | Yes (for firmware) |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket name | Yes (for firmware) |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP service account JSON | Yes (for firmware) |
| `ENVIRONMENT` | Deployment environment | No |

## API Documentation

Interactive API documentation available at:
- `/api/v1/docs` - Swagger UI

## Endpoints

### Core Services

- **Devices** - `/api/v1/devices/*`
  - Device management and monitoring
  - Performance metrics and analytics
  - Real-time status tracking

- **Sites** - `/api/v1/sites/*`
  - Site management
  - Regional analytics
  - Location-based services

- **Analytics** - `/api/v1/analytics/*`
  - Data transmission metrics
  - System health monitoring
  - Performance analytics

- **Firmware** - `/firmware/*`
  - Firmware upload and management
  - Version control and distribution
  - OTA (Over-The-Air) update support
  - Multiple format support (.bin, .hex)
  - See [Firmware Documentation](FIRMWARE_API.md) for details

## Health Checks

- `GET /health` - Service health status
- `GET /ready` - Readiness probe

## Performance

- Connection pooling with configurable limits
- Redis caching for frequently accessed data
- Optimized database queries with proper indexing
- Horizontal scaling support

## Security

- JWT-based authentication
- CORS configuration
- SQL injection prevention via SQLModel
- Environment-based configuration

## Monitoring

Structured logging with configurable levels for production monitoring and debugging.

## License

Proprietary - AirQo Platform

## Support

Internal service - Contact platform team for support.