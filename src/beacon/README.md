# AirQo Device Service

FastAPI backend for AirQo air quality device management and analytics.

## Quick Start

```bash
# Setup
git clone <repo>
cd airqo-device-service
cp .env.example .env

# Run
docker-compose up -d

# Test
curl http://localhost:8000/health
```

## API

**Documentation**: http://localhost:8000/docs

**Key Endpoints**:
- `GET /devices` - List devices
- `GET /device-detail/{device_id}` - Device info + history
- `GET /device-counts` - Dashboard stats
- `POST /login` - Authentication

## Auth

```bash
# Login
curl -X POST http://localhost:8000/login \
  -d "username=admin@airqo.net&password=admin123"

# Use token
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/users/me
```

## Config

Edit `.env`:
```
DATABASE_URL=postgresql://airflow:airflow@postgres:5432/airflow
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,*
```

Done! Visit http://localhost:8000/docs for full API documentation.d role-based access control
- **Data Analytics**: Site performance, network analysis, and data transmission metrics
- **RESTful API**: Comprehensive REST API with OpenAPI documentation
- **Microservice Ready**: Designed to integrate with existing AirQo infrastructure

## 🏗️ Architecture

This is a standalone FastAPI backend microservice designed to:
- **Integrate**: Work seamlessly with existing AirQo Airflow data pipeline
- **Scale**: Horizontal scaling support with load balancing
- **Monitor**: Built-in health checks and monitoring endpoints
- **Secure**: JWT authentication, rate limiting, and security headers
- **Cache**: Redis integration for performance optimization

## 📋 Prerequisites

- Python 3.10+
- PostgreSQL 13+ (shared with Airflow)
- Docker & Docker Compose
- Redis (for caching)

## 🛠️ Installation & Setup

### Option 1: Standalone Microservice (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd airqo-device-service
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the microservice**
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**
   ```bash
   curl http://localhost:8000/health
   ```

### Option 2: Integration with Existing AirQo Pipeline

If you already have the AirQo Airflow pipeline running:

1. **Use existing PostgreSQL**
   ```bash
   # Update docker-compose.yml to use external PostgreSQL
   # Set external: true for postgres service
   ```

2. **Start only the FastAPI service**
   ```bash
   docker-compose up airqo-device-service redis
   ```

### Option 3: Production Deployment

1. **Production compose**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://airflow:airflow@postgres:5432/airflow` |
| `SECRET_KEY` | JWT secret key | Required |
| `ENVIRONMENT` | Environment (dev/staging/prod) | `development` |
| `CORS_ORIGINS` | Allowed CORS origins | Frontend URLs |
| `AIRQO_API_TOKEN` | AirQo API integration token | Required |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |

### Database Integration

The service is designed to work with the existing AirQo database schema:
- **Compatible**: Uses same tables as Airflow pipeline
- **Non-intrusive**: Only reads from existing tables
- **Extensible**: Adds minimal user management tables

## 📚 API Documentation

Once running, access the interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### Key API Endpoints

#### Device Management
```bash
GET  /devices                    # List all devices
GET  /devices/{device_id}        # Get device details
GET  /device-detail/{device_id}  # Comprehensive device info
GET  /valid-device-locations     # Devices with coordinates
```

#### Analytics
```bash
GET  /device-counts             # Device statistics
GET  /device-status            # Status distribution
GET  /maintenance-metrics      # Maintenance stats
GET  /analytics/*              # Performance analytics
```

#### User Management
```bash
POST /login                    # Authentication
GET  /users/me                 # Current user profile
POST /users/                   # Create user (admin only)
```

## 🔒 Authentication

JWT-based authentication compatible with frontend applications:

1. **Login** with email/password
2. **Receive** JWT token
3. **Include** in Authorization header: `Bearer <token>`

## 🔗 Integration Points

### With AirQo Airflow Pipeline
- **Database**: Shares PostgreSQL with Airflow
- **Data**: Reads device and sensor data populated by ETL
- **Network**: Same Docker network for communication

### With Frontend Applications
- **CORS**: Configured for multiple frontend origins
- **API**: RESTful endpoints with consistent responses
- **Auth**: JWT tokens for stateless authentication

### With External Systems
- **AirQo API**: Integration for additional data sources
- **Monitoring**: Health checks for orchestration platforms

## 🏥 Health Checks & Monitoring

```bash
# Basic health
curl http://localhost:8000/health

# Database connectivity
curl http://localhost:8000/health/db

# Detailed system status
curl http://localhost:8000/health/detailed
```

### Cloud Integration
- **AWS ECS**: Service discovery integration
- **Google Cloud Run**: Serverless deployment
- **Azure Container Instances**: Managed containers

## 🔧 Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 Performance & Scaling

### Caching Strategy
- **Redis**: Frequently accessed device data
- **Database**: Connection pooling and query optimization
- **API**: Response caching for analytics endpoints

### Scaling Considerations
- **Stateless**: Can run multiple instances
- **Database**: Read replicas for analytics queries
- **Load Balancing**: Nginx configuration included

## 🤝 Integration with Existing Infrastructure

This microservice is designed to complement your existing AirQo infrastructure:

- **Data Pipeline**: Uses data from Airflow ETL processes
- **Database**: Shares PostgreSQL instance with minimal overhead
- **Monitoring**: Compatible with existing monitoring stack
- **Deployment**: Can be deployed alongside existing services

## 🆘 Support

For support and integration questions:
- Create an issue in the repository
- Contact: devops@airqo.net
- Integration docs: See API documentation

## 📈 Roadmap

- [ ] GraphQL API support
- [ ] Real-time WebSocket connections
- [ ] Advanced caching strategies
- [ ] Metrics export for Prometheus
- [ ] Service mesh integration
- [ ] Multi-tenant support/health
   ```

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set environment variables**
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/airqo"
   export SECRET_KEY="your-secret-key"
   ```

3. **Run the application**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Option 3: Docker Container

1. **Build the image**
   ```bash
   docker build -t airqo-device-service .
   ```

2. **Run the container**
   ```bash
   docker run -p 8000:8000 \
     -e DATABASE_URL="postgresql://user:password@host:5432/airqo" \
     -e SECRET_KEY="your-secret-key" \
     airqo-device-service
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `SECRET_KEY` | JWT secret key | Required |
| `ENVIRONMENT` | Environment (dev/staging/prod) | `development` |
| `DEBUG` | Enable debug mode | `false` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `RATE_LIMIT_PER_MINUTE` | API rate limit | `100` |

### Database Configuration

The service uses PostgreSQL with the following tables:
- `dim_device` - Device information
- `dim_location` - Device locations
- `dim_site` - Site information
- `fact_device_readings` - Sensor readings
- `fact_device_status` - Device status history
- `fact_health_tips` - Health recommendations
- `users` - User accounts

## 📚 API Documentation

Once running, access the interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Key Endpoints

#### Device Management
- `GET /devices` - List all devices
- `GET /devices/{device_id}` - Get device details
- `GET /device-detail/{device_id}` - Get comprehensive device info
- `GET /valid-device-locations` - Get devices with valid coordinates

#### Analytics
- `GET /device-counts` - Device count statistics
- `GET /device-status` - Device status distribution
- `GET /maintenance-metrics` - Maintenance statistics
- `GET /device-monitoring-metrics` - Regional monitoring metrics

#### Health & Recommendations
- `GET /health-tips/device/{device_id}` - Get health tips for device
- `GET /health` - Service health check

#### User Management
- `POST /login` - User authentication
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update user profile
- `POST /users/` - Create new user (admin only)

## 🔒 Authentication

The service uses JWT (JSON Web Tokens) for authentication:

1. **Login** with email/password to get a token
2. **Include token** in Authorization header: `Bearer <token>`
3. **Token expires** after 30 minutes (configurable)

## 🏥 Health Checks

The service provides multiple health check endpoints:

- `GET /health` - Basic health status
- `GET /health/db` - Database connectivity check
- `GET /health/detailed` - Comprehensive health information

