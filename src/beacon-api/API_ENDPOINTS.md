# API Endpoints Documentation

Base URL: `/api/v1`

## Device Endpoints (`/api/v1/devices`)

### Statistics & Monitoring
- `GET /api/v1/devices/stats` - Comprehensive device statistics with network, category, and maintenance breakdowns
- `GET /api/v1/devices/count` - Get total device count with optional filters
- `GET /api/v1/devices/statistics` - Device statistics summary (deprecated - use /stats)
- `GET /api/v1/devices/offline/list` - List all offline devices with configurable threshold

### Device Management
- `GET /api/v1/devices/` - List all devices with pagination and filters
- `GET /api/v1/devices/{device_id}` - Get specific device details by ID
- `POST /api/v1/devices/` - Create a new device
- `PATCH /api/v1/devices/{device_id}` - Update device information
- `DELETE /api/v1/devices/{device_id}` - Delete a device

### Device Analytics
- `GET /api/v1/devices/{device_id}/performance` - Device performance metrics over specified days
- `GET /api/v1/devices/{device_id}/readings` - Get device sensor readings with date range

## Site Endpoints (`/api/v1/sites`)

### Site Statistics
- `GET /api/v1/sites/count` - Total site count with regional filters
- `GET /api/v1/sites/statistics` - Comprehensive site statistics with device distribution

### Site Management
- `GET /api/v1/sites/` - List all sites with pagination
- `GET /api/v1/sites/{site_id}` - Get specific site details
- `POST /api/v1/sites/` - Create a new site
- `PATCH /api/v1/sites/{site_id}` - Update site information
- `DELETE /api/v1/sites/{site_id}` - Delete a site (only if no devices assigned)

### Site Analytics
- `GET /api/v1/sites/{site_id}/devices` - List all devices at a specific site
- `GET /api/v1/sites/{site_id}/performance` - Aggregated performance for site devices

### Geographic Data
- `GET /api/v1/sites/regions/list` - List all unique regions
- `GET /api/v1/sites/districts/list` - List districts with optional region filter

## Analytics Endpoints (`/api/v1/analytics`)

### Dashboard & Summary
- `GET /api/v1/analytics/dashboard` - Main dashboard with device, site, and data metrics
- `GET /api/v1/analytics/summary` - Quick system summary statistics

### Data Transmission
- `GET /api/v1/analytics/data-transmission/summary` - Transmission statistics over specified days
- `GET /api/v1/analytics/data-transmission/hourly` - Hourly breakdown of data transmission

### Performance Analysis
- `GET /api/v1/analytics/network-performance` - Performance metrics grouped by network
- `GET /api/v1/analytics/regional-analysis` - Analysis grouped by geographical region
- `GET /api/v1/analytics/system-health` - Overall system health score and issues

## Health Check Endpoints (Root)

- `GET /` - Service information and status
- `GET /health` - Basic health check
- `GET /ready` - Readiness probe with dependency checks

## Query Parameters

### Common Filters
- `skip` - Pagination offset (default: 0)
- `limit` - Results per page (default: 100)
- `network` - Filter by network name
- `status` - Filter by status (active, inactive, deployed, etc.)
- `region` - Filter by geographical region
- `district` - Filter by district

### Time Ranges
- `days` - Number of days for analysis (1-90)
- `start_date` - Beginning of date range
- `end_date` - End of date range
- `hours` - Hours threshold for offline detection (1-168)

### Optional Includes
- `include_networks` - Include network breakdown in stats
- `include_categories` - Include category breakdown in stats
- `include_maintenance` - Include maintenance information

## Response Formats

All endpoints return JSON responses with appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Authentication

**⚠️ SECURITY WARNING**: Currently no authentication required. For production deployment, implement authentication/authorization via API gateway with TLS termination.

## Rate Limiting

**⚠️ WARNING**: No rate limiting currently implemented. Strongly recommended for production to prevent abuse.