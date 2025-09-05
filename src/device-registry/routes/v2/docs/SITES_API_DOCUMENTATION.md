# Sites Management API Documentation

## Overview

This API provides endpoints for managing sites including creation, updates, metadata generation, and location-based operations. Sites are geographical locations where air quality monitoring devices can be deployed.

## Base URL

```
/api/v2/sites
```

## Endpoints

### 1. List Sites

**Endpoint:** `GET /`

**Description:** Retrieves a list of sites with optional filtering

**Query Parameters:**

- `tenant` (optional): Network tenant (defaults to "airqo")
- `id` (optional): Site ID filter
- `site_id` (optional): Alternative site ID filter
- `name` (optional): Site name filter
- `online_status` (optional): Filter by online status ("online" or "offline")
- `category` (optional): Site category filter
- `last_active_before` (optional): Filter sites last active before this date (ISO8601)
- `last_active_after` (optional): Filter sites last active after this date (ISO8601)
- `last_active` (optional): Filter by exact last active date (ISO8601)
- `limit` (optional): Number of results (default: 1000)
- `skip` (optional): Number of results to skip (default: 0)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved the site details",
  "sites": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "Kampala Central",
      "generated_name": "site_001",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "approximate_latitude": -1.2925,
      "approximate_longitude": 36.8223,
      "country": "Uganda",
      "district": "Kampala",
      "region": "Central",
      "visibility": true,
      "network": "airqo",
      "groups": ["urban"],
      "site_tags": ["commercial", "urban"],
      "devices": [
        {
          "_id": "60f1b2e4d4a5c123456789ac",
          "name": "aq_device_001",
          "status": "deployed"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 2. Get Site Summary

**Endpoint:** `GET /summary`

**Description:** Retrieves a summarized list of sites with reduced data fields

**Query Parameters:** Same as list sites endpoint

**Response:** Same format as list sites but with condensed site information

### 3. Create Site

**Endpoint:** `POST /`

**Description:** Creates a new site with automatic metadata generation

**Request Body:**

```json
{
  "name": "Kampala Central",
  "latitude": -1.2921,
  "longitude": 36.8219,
  "approximate_distance_in_km": 0.5,
  "network": "airqo",
  "site_tags": ["commercial", "urban"],
  "groups": ["urban"],
  "airqlouds": ["60f1b2e4d4a5c123456789ad"],
  "site_category": {
    "category": "commercial",
    "search_radius": 1.5,
    "tags": ["business", "traffic"],
    "latitude": -1.2921,
    "longitude": 36.8219
  }
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "site created",
  "site": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "Kampala Central",
    "generated_name": "site_001",
    "lat_long": "-1.2921_36.8219",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "approximate_latitude": -1.2925,
    "approximate_longitude": 36.8223,
    "approximate_distance_in_km": 0.5,
    "bearing_in_radians": 0.785,
    "country": "Uganda",
    "district": "Kampala",
    "region": "Central",
    "altitude": 1200,
    "network": "airqo",
    "groups": ["urban"],
    "site_tags": ["commercial", "urban"],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Generate Site Metadata

**Endpoint:** `POST /metadata`

**Description:** Generates location metadata for given coordinates

**Request Body:**

```json
{
  "latitude": -1.2921,
  "longitude": 36.8219
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully generated the metadata",
  "metadata": {
    "latitude": -1.2921,
    "longitude": 36.8219,
    "altitude": 1200,
    "country": "Uganda",
    "district": "Kampala",
    "region": "Central",
    "street": "Kampala Road",
    "formatted_name": "Kampala Road, Kampala, Uganda",
    "site_tags": ["political", "locality"],
    "geometry": {
      "location": {
        "lat": -1.2921,
        "lng": 36.8219
      }
    }
  }
}
```

### 5. Update Site

**Endpoint:** `PUT /`

**Description:** Updates an existing site

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Site ID to update
- OR `lat_long`: Latitude_longitude identifier
- OR `generated_name`: Generated name identifier

**Request Body:**

```json
{
  "name": "Updated Site Name",
  "visibility": true,
  "status": "active",
  "site_tags": ["updated", "commercial"],
  "site_category": {
    "category": "residential",
    "search_radius": 2.0,
    "tags": ["residential", "quiet"]
  }
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully modified the site",
  "site": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "Updated Site Name",
    "visibility": true,
    "status": "active",
    "site_tags": ["updated", "commercial"],
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 6. Bulk Update Sites

**Endpoint:** `PUT /bulk`

**Description:** Updates multiple sites simultaneously

**Request Body:**

```json
{
  "siteIds": ["60f1b2e4d4a5c123456789ab", "60f1b2e4d4a5c123456789ac"],
  "updateData": {
    "groups": ["urban", "monitoring"],
    "site_category": {
      "category": "monitoring",
      "search_radius": 1.0,
      "tags": ["automated", "monitoring"]
    }
  }
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully modified 2 sites",
  "bulk_update_notes": {
    "modifiedCount": 2,
    "matchedCount": 2
  },
  "metadata": {
    "totalSitesUpdated": 2,
    "requestedSiteIds": [
      "60f1b2e4d4a5c123456789ab",
      "60f1b2e4d4a5c123456789ac"
    ],
    "existingSiteIds": ["60f1b2e4d4a5c123456789ab", "60f1b2e4d4a5c123456789ac"]
  }
}
```

### 7. Refresh Site

**Endpoint:** `PUT /refresh`

**Description:** Refreshes site metadata by regenerating location-based information

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Site ID to refresh

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Site details successfully refreshed",
  "site": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "Kampala Central",
    "altitude": 1205,
    "country": "Uganda",
    "district": "Kampala",
    "updatedAt": "2024-01-15T11:30:00.000Z"
  }
}
```

### 8. Get Site Details by ID

**Endpoint:** `GET /:id`

**Description:** Retrieves detailed information for a specific site including associated devices

**Path Parameters:**

- `id` (required): Site ID

**Query Parameters:**

- `tenant` (optional): Network tenant

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "site details fetched successfully",
  "data": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "Kampala Central",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "country": "Uganda",
    "district": "Kampala",
    "network": "airqo",
    "devices": [
      {
        "_id": "60f1b2e4d4a5c123456789ac",
        "name": "aq_device_001",
        "status": "deployed",
        "isActive": true,
        "latitude": -1.2925,
        "longitude": 36.8223
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 9. Delete Site

**Endpoint:** `DELETE /`

**Description:** Deletes a site (Currently disabled)

**Response (503 - Service Unavailable):**

```json
{
  "success": false,
  "message": "feature temporarity disabled --coming soon",
  "errors": {
    "message": "Service Unavailable"
  }
}
```

### 10. Find Nearest Sites

**Endpoint:** `GET /nearest`

**Description:** Finds sites within a specified radius of given coordinates

**Query Parameters:**

- `tenant` (optional): Network tenant
- `latitude` (required): Latitude coordinate (minimum 5 decimal places)
- `longitude` (required): Longitude coordinate (minimum 5 decimal places)
- `radius` (required): Search radius in kilometers
- `limit` (optional): Number of results
- `skip` (optional): Number of results to skip

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved the nearest sites",
  "sites": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "Kampala Central",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "distance": 0.8,
      "country": "Uganda",
      "district": "Kampala"
    },
    {
      "_id": "60f1b2e4d4a5c123456789ac",
      "name": "Kampala North",
      "latitude": -1.285,
      "longitude": 36.8195,
      "distance": 1.2,
      "country": "Uganda",
      "district": "Kampala"
    }
  ]
}
```

### 11. Create Approximate Coordinates

**Endpoint:** `POST /approximate`

**Description:** Creates approximate coordinates based on bearing and distance

**Request Body:**

```json
{
  "latitude": -1.2921,
  "longitude": 36.8219,
  "approximate_distance_in_km": 0.5,
  "bearing": 45
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully approximated the GPS coordinates",
  "approximate_coordinates": {
    "approximate_latitude": -1.2885,
    "approximate_longitude": 36.8255,
    "bearing_in_radians": 0.785,
    "approximate_distance_in_km": 0.5
  }
}
```

### 12. Get Approximate Coordinates

**Endpoint:** `GET /approximate`

**Description:** Calculates approximate coordinates via query parameters

**Query Parameters:**

- `latitude` (required): Original latitude (minimum 2 decimal places)
- `longitude` (required): Original longitude (minimum 2 decimal places)
- `approximate_distance_in_km` (optional): Distance in kilometers
- `bearing` (optional): Bearing in degrees

**Response:** Same format as POST /approximate

### 13. Find AirQlouds for Site

**Endpoint:** `GET /airqlouds/`

**Description:** Finds AirQlouds that contain the specified site

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Site ID
- OR other site identifiers (lat_long, generated_name)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully searched for the associated AirQlouds",
  "airqlouds": ["60f1b2e4d4a5c123456789ad", "60f1b2e4d4a5c123456789ae"]
}
```

### 14. List Weather Stations

**Endpoint:** `GET /weather`

**Description:** Retrieves all available weather stations

**Query Parameters:**

- `tenant` (optional): Network tenant
- `limit` (optional): Number of results
- `skip` (optional): Number of results to skip

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved all the stations",
  "stations": [
    {
      "id": 12345,
      "code": "UGA001",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "elevation": 1200,
      "timezone": "Africa/Kampala",
      "name": "Kampala Station",
      "type": "automatic"
    }
  ]
}
```

### 15. Find Nearest Weather Station

**Endpoint:** `GET /weather/nearest`

**Description:** Finds the nearest weather station to a specified site

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Site ID to find nearest weather station for

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "nearest site retrieved",
  "nearest_weather_station": {
    "id": 12345,
    "code": "UGA001",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "elevation": 1200,
    "timezone": "Africa/Kampala"
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

**Error Response (400/404/500):**

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "message": "Detailed error message",
    "field_name": "Field-specific error message"
  }
}
```

## Common Error Codes

- `400` - Bad Request (validation errors, missing required fields)
- `404` - Not Found (site not found)
- `409` - Conflict (duplicate site names, coordinates)
- `502` - Bad Gateway (external service errors)
- `503` - Service Unavailable (temporarily disabled features)
- `500` - Internal Server Error

## Validation Rules

### Coordinates

- **Latitude**: Must be between -90 and 90 degrees with minimum 5 decimal places (2 decimal places for metadata generation)
- **Longitude**: Must be between -180 and 180 degrees with minimum 5 decimal places (2 decimal places for metadata generation)

### Site Names

- Must be 5-50 characters in length
- Can contain letters, numbers, spaces, hyphens, and underscores
- Cannot be empty or only whitespace

### Site Category

- Must include required fields: `category`, `search_radius`, `tags`
- `search_radius` must be a positive number
- `tags` must be an array of non-empty strings

### Bulk Operations

- Maximum 30 sites can be updated in a single bulk request
- All site IDs must be valid MongoDB ObjectIds
- Only specific fields can be updated in bulk operations: `groups`, `site_category`

## Notes

1. **Automatic Metadata Generation**: When creating sites, metadata including altitude, administrative boundaries, and address information is automatically generated using external services
2. **Coordinate Approximation**: Sites support approximate coordinates for privacy protection while maintaining location accuracy for monitoring purposes
3. **Weather Integration**: Integration with TAHMO weather stations for environmental context
4. **AirQloud Association**: Sites can be automatically associated with AirQlouds based on geographical boundaries
5. **Device Association**: Sites can have multiple devices deployed to them, with full relationship tracking
6. **Generated Names**: Unique generated names are automatically created for each site to ensure system-wide uniqueness
