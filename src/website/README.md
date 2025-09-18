# AirQo Website API Backend

[![Django](https://img.shields.io/badge/Django-5.1.4-green.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/Django%20REST%20Framework-3.15.2-red.svg)](https://www.django-rest-framework.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, scalable REST API backend for the AirQo website, providing access to air quality data, research publications, events, team information, and more. Built with Django REST Framework with a focus on performance, security, and developer experience.

## 🚀 Key Features

### API Versions

- **Legacy Endpoints** (`/website/[app-name]/`) - Backward compatibility
- **V2 Enhanced API** (`/website/api/v2/[resource]/`) - Modern, optimized endpoints with advanced features

### Performance Optimizations

- ⚡ **Database Query Optimization** - select_related() and prefetch_related() for N+1 prevention
- 🚀 **Intelligent Caching** - Multi-level caching strategy for faster responses
- 📄 **Smart Pagination** - Both cursor and page-based pagination options
- 🔍 **Dynamic Field Selection** - `?fields=` and `?omit=` query parameters
- 📊 **Advanced Filtering** - Complex filtering with django-filter integration

### Enhanced File Upload Support

- 📁 **Large File Support** - Up to 30MB file uploads with optimized handling
- ☁️ **Cloudinary Integration** - Robust cloud storage with automatic optimization
- 🔒 **Secure Upload** - Enhanced validation and error handling
- ⚡ **Performance Optimized** - Async processing for large files

### Security & Authorization

- 🔓 **Open API Design** - Authorization handled at nginx level for better performance
- 🛡️ **Cloudinary Security** - Secure file storage with automatic cleanup
- 🚫 **No Django Auth** - Simplified architecture for public API endpoints

### Enhanced Documentation

- 📖 **Interactive API Documentation** - Swagger UI and ReDoc interfaces
- 🔄 **OpenAPI 3.0 Schema** - Machine-readable API specifications
- 🧪 **Live Testing** - Test endpoints directly from documentation

### 🔗 Universal Slug System

- 🔐 **Privacy-Friendly URLs** - Slug-based identifiers instead of numeric IDs
- 🔍 **Universal Lookup** - Works across all models that support slugs
- 🎯 **Bulk Operations** - Process multiple identifiers efficiently
- ⚡ **Automatic Generation** - Management command for bulk slug creation

### ✅ Production-Ready Quality

- 🛡️ **Type Safety** - Full type annotations for better code quality
- 🔧 **Error-Free Codebase** - All critical errors resolved
- 🧪 **Tested Endpoints** - Comprehensive API endpoint validation
- 📊 **Performance Monitoring** - Query optimization and response time tracking

## 🏗️ Architecture

### Apps Structure

```
apps/
├── api/                    # Centralized API management
│   └── v2/                # Enhanced API endpoints (v2)
│       ├── viewsets/      # API view logic per app
│       ├── serializers/   # Data serialization
│       ├── filters/       # Advanced filtering
│       └── pagination.py  # Pagination classes
│
├── africancities/         # African cities data
├── board/                 # Board members
├── career/                # Career opportunities
├── cleanair/              # Clean air resources & forum
├── event/                 # Events management
├── externalteams/         # External partners
├── faqs/                  # FAQ management
├── highlights/            # Website highlights
├── impact/                # Impact metrics
├── partners/              # Organization partners
├── press/                 # Press releases
├── publications/          # Research publications
└── team/                  # Team members
```

### Technology Stack

- **Backend Framework**: Django 5.1.4
- **API Framework**: Django REST Framework 3.15.2
- **Database**: PostgreSQL with connection pooling
- **Caching**: Django's LocMem cache (configurable to Redis)
- **Media Storage**: Cloudinary CDN integration
- **Documentation**: drf-spectacular (OpenAPI 3.0) + drf-yasg (Swagger)
- **Rich Text**: Django Quill Editor
- **CORS**: django-cors-headers
- **Static Files**: WhiteNoise compression

## 🔧 Installation & Setup

### Prerequisites

- Python 3.9+
- PostgreSQL (recommended) or SQLite for development
- Cloudinary account for media storage

### Quick Start

1. **Clone and Setup Environment**

   ```bash
   git clone <repository-url>
   cd src/website
   python -m venv .venv

   # Windows
   .venv\Scripts\activate

   # Linux/macOS
   source .venv/bin/activate
   ```

2. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**

   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

5. **Run Development Server**
   ```bash
   python manage.py runserver
   ```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Core Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://user:password@localhost/airqo_website

# Cloudinary (Media Storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000

# Optional: Language and Timezone
LANGUAGE_CODE=en-us
TIME_ZONE=UTC
```

## 📚 API Usage

### Base URLs

- **Legacy API**: `http://127.0.0.1:8000/website/[app-name]/`
- **V2 API**: `http://127.0.0.1:8000/website/api/v2/[resource]/`
- **Documentation**: `http://127.0.0.1:8000/website/api/docs/`
- **Admin Panel**: `http://127.0.0.1:8000/website/admin/`

### V2 API Features

#### Dynamic Field Selection

```bash
# Get only specific fields
GET /website/api/v2/events/?fields=id,title,start_date

# Omit certain fields
GET /website/api/v2/events/?omit=description,background_image
```

#### Advanced Filtering

```bash
# Filter events by date range
GET /website/api/v2/events/?start_date__gte=2024-01-01&start_date__lte=2024-12-31

# Search across multiple fields
GET /website/api/v2/events/?search=air%20quality

# Order results
GET /website/api/v2/events/?ordering=-start_date,title
```

#### Pagination Options

```bash
# Page-based pagination
GET /website/api/v2/events/?page=2&page_size=20

# Cursor-based pagination (for large datasets)
GET /website/api/v2/events/?cursor=cD0yMDI0LTEyLTA0
```

#### 🔗 Universal Slug System

The V2 API includes a sophisticated slug-based lookup system for privacy-friendly URLs:

```bash
# Retrieve by slug instead of ID
GET /website/api/v2/events/annual-air-quality-summit-2024/
GET /website/api/v2/publications/air-quality-monitoring-report/
GET /website/api/v2/team-members/john-doe/

# Bulk identifier operations
POST /website/api/v2/events/bulk-identifiers/
{
  "identifiers": ["slug1", "slug2", "id3"]
}

# Direct slug lookups
GET /website/api/v2/events/by-slug/my-event-slug/
```

**Benefits:**

- ✅ Privacy-friendly (no exposure of sequential IDs)
- ✅ SEO-optimized URLs
- ✅ Human-readable identifiers
- ✅ Automatic fallback to ID when slug not available

## 🛠️ Management Commands

### Universal Slug Generation

Generate slugs for all models that support them:

```bash
# Generate slugs for all models (dry run)
python manage.py generate_all_slugs --dry-run --verbose

# Generate slugs for specific apps
python manage.py generate_all_slugs --apps event publications team

# Generate slugs for specific models
python manage.py generate_all_slugs --models Event Publication Press

# Force regeneration (even if slugs exist)
python manage.py generate_all_slugs --force --batch-size 50

# Full options
python manage.py generate_all_slugs \
    --apps event publications \
    --batch-size 100 \
    --force \
    --verbose
```

**Options:**

- `--dry-run`: Preview changes without saving
- `--apps`: Target specific Django apps
- `--models`: Target specific model names
- `--batch-size`: Process in batches (default: 100)
- `--force`: Regenerate existing slugs
- `--verbose`: Show detailed progress

### Example API Calls

#### Get Events

```python
import requests

# Get upcoming events with basic info
response = requests.get(
    'http://127.0.0.1:8000/website/api/v2/events/',
    params={
        'fields': 'id,title,start_date,location_name',
        'start_date__gte': '2024-01-01',
        'ordering': 'start_date'
    }
)
```

#### Get Team Members

```python
# Get team members with their roles
response = requests.get(
    'http://127.0.0.1:8000/website/api/v2/team-members/',
    params={
        'fields': 'name,role,bio_image_url',
        'ordering': 'name'
    }
)
```

## 🔐 Admin Interface

### Clean Air Content Organization

The admin interface provides enhanced organization for Clean Air content:

- **Clean Air Resources** - Standalone air quality resources and publications
- **Clean Air Forum** - Forum events, sessions, partners, and related content

### Enhanced Features

- 📊 **Status Badges** - Visual indicators for content status
- 🖼️ **Media Previews** - Inline image and file previews
- 📅 **Date Hierarchies** - Easy browsing by date ranges
- 🔍 **Advanced Search** - Search across multiple fields
- ⚡ **Bulk Actions** - Perform actions on multiple items

## ⚡ Performance Features

### Database Optimizations

- **Query Optimization**: Automatic select_related() and prefetch_related()
- **Connection Pooling**: Efficient database connection management
- **Index Optimization**: Strategic database indexes for common queries

### Caching Strategy

- **List Views**: 5 minutes cache TTL
- **Detail Views**: 10 minutes cache TTL
- **Static Content**: 1 hour cache TTL
- **Dynamic Content**: 1 minute cache TTL

### API Rate Limiting

- **Anonymous Users**: 1000 requests/day
- **Authenticated Users**: 5000 requests/day
- **Customizable**: Configurable per endpoint

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
python manage.py test

# Run tests for specific app
python manage.py test apps.event

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

## 📈 Monitoring & Logging

### Logging Configuration

- **Development**: Console logging with DEBUG level
- **Production**: File-based logging with structured format
- **Error Tracking**: Dedicated error log files
- **App-specific Logs**: Individual logging for each app

### Health Check

Monitor API health:

```bash
GET /website/healthcheck/
```

## 🚀 Deployment

### Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Configure proper `ALLOWED_HOSTS`
- [ ] Set up PostgreSQL database
- [ ] Configure Cloudinary for media
- [ ] Set up Redis for caching (recommended)
- [ ] Configure SSL certificates
- [ ] Set up monitoring and logging

### Docker Deployment

```bash
# Build and run with Docker (single-image)
# Build the image and run a container (useful for quick local tests)
docker build -t airqo-website-api .
docker run -p 8000:8000 --env-file .env --name airqo-website-api -v $(pwd)/staticfiles:/app/staticfiles airqo-website-api
```

### Docker Compose (recommended)

This repo includes a `docker-compose.yml` with a single `web` service (not `web-prod`). If you see errors like "no such service: web-prod" it means the service name used is incorrect — use `web` or run the full compose stack.

Key notes:

- Service name: `web` (see `docker-compose.yml`)
- Uses `.env` via `env_file:` for environment variables
- Ports: `8000:8000` is mapped by default
- Container name (local): `airqo-website-local`

Examples:

```bash
# Build and run only the web service (rebuild image)
docker compose up --build web

# Run the web service in detached mode
docker compose up -d --build web

# Build and run all services defined in the compose file
docker compose up --build

# Stop services
docker compose down

# View logs for the web service
docker compose logs -f web

# List services defined in the compose file
docker compose config --services
```

Troubleshooting:

- Error: "no such service: web-prod"

  - Cause: you likely used the wrong service name. The compose file defines `web`. Run `docker compose config --services` to confirm.

- If ports are already in-use, stop the conflicting service or change the host port mapping in `docker-compose.yml`.

- To ensure environment variables are available, create a `.env` in the project root or pass them via `--env-file`/`-e`.

Production notes:

- This compose file targets a simple local production-like run (multi-stage Dockerfile `production` target). For real production, use an orchestration platform (Swarm/Kubernetes) or a dedicated process manager and set `DEBUG=False`, configure SSL, and use a managed database.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow PEP 8 guidelines
- Use type hints for public APIs
- Write docstrings for all functions and classes
- Include tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [API Documentation](http://127.0.0.1:8000/website/api/docs/)
- **Issues**: [GitHub Issues](https://github.com/airqo-platform/AirQo-api/issues)
- **Email**: support@airqo.net
- **Website**: [https://www.airqo.net](https://www.airqo.net)

---

**AirQo** - Empowering communities with air quality data for better health and environmental decisions.
