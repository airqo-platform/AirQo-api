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

## Firmware Management

The Beacon Service includes a comprehensive firmware management system for IoT device updates. Key features:

- 📦 **Multi-format Support**: Upload .bin or .hex files (auto-converts hex to bin)
- 🔐 **Secure Storage**: Google Cloud Storage backend with token authentication
- 📊 **Version Control**: Track multiple firmware versions with type classification
- 📥 **Efficient Distribution**: HTTP range request support for resumable downloads
- ✅ **Data Integrity**: Automatic CRC32 checksum calculation and validation
- 📝 **Change Tracking**: Built-in change log system (10 entries per version)

### Quick Start

```bash
# Upload firmware
curl -X POST "http://localhost:8000/firmware/upload" \
  -F "org_token=YOUR_TOKEN" \
  -F "firmware_version=1.0.0" \
  -F "firmware_type=stable" \
  -F "firmware_file=@firmware.hex"

# Download firmware
curl -O "http://localhost:8000/firmware/download?org_token=YOUR_TOKEN&file_type=bin&firmware_version=1.0.0"
```

### Documentation

- 📘 [Full API Documentation](FIRMWARE_API.md)
- 🔧 [Setup Guide](FIRMWARE_SETUP.md)
- 📋 [Implementation Details](FIRMWARE_IMPLEMENTATION.md)
- ⚡ [Quick Reference](FIRMWARE_QUICK_REF.md)

### Required Configuration

```env
ORG_TOKEN=your-secret-token
GCS_BUCKET_NAME=your-gcs-bucket
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

See [Firmware Setup Guide](FIRMWARE_SETUP.md) for detailed configuration instructions.

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