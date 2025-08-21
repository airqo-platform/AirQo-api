# AirQo Analytics API Documentation

This document provides comprehensive information about the AirQo Analytics API (versions 2 and 3), including endpoint descriptions, request formats, response structures, and usage examples.

## Table of Contents

- [API Overview](#api-overview)
- [API Versioning](#api-versioning)
- [Authentication](#authentication)
- [API v2 Endpoints](#api-v2-endpoints)
  - [Raw Data Endpoint](#raw-data-endpoint)
  - [Data Download Endpoint](#data-download-endpoint)
  - [Data Export Endpoint](#data-export-endpoint)
- [API v3 Endpoints](#api-v3-endpoints)
  - [Enhanced Raw Data Endpoint](#enhanced-raw-data-endpoint)
  - [Enhanced Data Download Endpoint](#enhanced-data-download-endpoint)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Response Format](#response-format)
- [Best Practices](#best-practices)

## API Overview

The AirQo Analytics API provides access to air quality data collected from AirQo's network of sensors. It allows users to:

- Query raw measurements
- Download processed data at different frequencies (hourly, daily, etc.)
- Export large datasets asynchronously
- Access metadata about devices, sites, and networks

## API Versioning

The API is versioned to ensure backward compatibility while adding new features:

- **v2**: Base URL `/api/v2/analytics/` - Standard functionality
- **v3**: Base URL `/api/v3/public/analytics/` - Enhanced with additional features like pagination and metadata inclusion

## Authentication

API access requires authentication using an API key provided in the request header:

```
Authorization: Bearer YOUR_API_KEY
```

Contact AirQo to obtain an API key for your application.

## API v2 Endpoints

### Raw Data Endpoint

`POST /api/v2/analytics/raw-data`

Retrieves raw sensor measurements within a specified time range.

Note: This endpoint currently returns JSON only (CSV export is not supported on raw-data).

#### Request Body

```json
{
  "network": "airqo",
  "startDateTime": "2023-01-01T00:00:00Z",
  "endDateTime": "2023-01-02T00:00:00Z",
  "device_category": "lowcost",
  "device_names": ["device1", "device2"], // OR "sites": ["site1", "site2"]
  "pollutants": ["pm2_5", "pm10"],
  "metaDataFields": ["latitude", "longitude"],
  "weatherFields": ["temperature", "humidity"],
  "frequency": "raw"
}
```

#### Response


### Data Download Endpoint

`POST /api/v2/analytics/data-download`

Retrieves processed data at specified frequency (hourly, daily) with calibrated values.

#### Request Body

```json
{
  "startDateTime": "2023-01-01T00:00:00Z",
  "endDateTime": "2023-01-02T00:00:00Z",
  "device_category": "lowcost",
  "sites": ["site1", "site2"], // "device_names": ["device1", "device2"]
  "pollutants": ["pm2_5", "pm10"],
  "frequency": "hourly",
  "datatype": "calibrated",
  "downloadType": "csv",
  "outputFormat": "airqo-standard",
  "minimum": true
}
```

#### Response

For JSON:

```json
{
  "success": true,
  "data": [
    {
      "datetime": "2023-01-01T12:00:00Z",
      "device_id": "device1",
      "site_name": "Site A",
      "pm2_5": 15.5,
      "pm10": 25.7
    }
    // ...more data points
  ]
}
```

For CSV: Response with `Content-Type: text/csv` and file download headers.

### Data Export Endpoint

`POST /api/v2/analytics/data-export`

Creates an asynchronous job to export large datasets for later download.

#### Request Body

```json
{
  "startDateTime": "2023-01-01T00:00:00Z",
  "endDateTime": "2023-03-31T00:00:00Z",
  "sites": ["site1", "site2"],
  "pollutants": ["pm2_5", "pm10"],
  "frequency": "daily",
  "exportFormat": "csv",
  "meta_data": ["latitude", "longitude"]
}
```

#### Response

```json
{
  "message": "request successfully received",
  "success": true,
  "data": {
    "requestId": "e7c3a8f6-5b1d-4e5a-9b3c-8d7e6a5f4e3d",
    "status": "SCHEDULED",
    "requestDate": "2023-08-15T10:30:00Z",
    "userId": "user123"
    // ...other request details
  }
}
```

## API v3 Endpoints

### Enhanced Raw Data Endpoint

`POST /api/v3/public/analytics/raw-data`

Extended version of the raw data endpoint with pagination and enhanced metadata.

#### Request Body

```json
{
  "network": "airqo",
  "startDateTime": "2023-01-01T00:00:00Z",
  "endDateTime": "2023-01-02T00:00:00Z",
  "device_category": "lowcost",
  "device_names": ["device1", "device2"],
  "pollutants": ["pm2_5", "pm10", "no2"],
  "metaDataFields": ["latitude", "longitude"],
  "weatherFields": ["temperature", "humidity"],
  "frequency": "raw",
  "cursor": "cursor_token_value" // Optional, for pagination
}
```

#### Response

```json
{
  "status": "success",
  "message": "Data downloaded successfully",
  "data": [
    {
      "dateTime": "2023-01-01T12:00:00Z",
      "device_id": "device1",
      "pm2_5": 15.5,
      "pm10": 25.7,
      "no2": 30.2,
      "temperature": 24.5,
      "humidity": 65.3
    }
    // ...more data points
  ],
  "metadata": {
    "totalCount": 2000,
    "hasMore": true,
    "next": "next_cursor_token_value"
  }
}
```

### Enhanced Data Download Endpoint

`POST /api/v3/public/analytics/data-download`

Enhanced version with additional formatting options and improved metadata.

#### Request Body

```json
{
  "startDateTime": "2023-01-01T00:00:00Z",
  "endDateTime": "2023-01-02T00:00:00Z",
  "device_category": "lowcost",
  "device_names": ["device1", "device2"],
  "pollutants": ["pm2_5", "pm10", "no2"],
  "frequency": "hourly",
  "datatype": "calibrated",
  "outputFormat": "airqo-standard",
  "downloadType": "json",
  "metaDataFields": ["latitude", "longitude"],
  "weatherFields": ["temperature", "humidity"],
  "minimum": true,
  "cursor": "cursor_token_value" // Optional, for pagination
}
```

#### Response

Similar to v3 raw data but with processed/calibrated values.

## Error Handling

The API uses HTTP status codes to indicate the result of requests:

- **200 OK**: Request succeeded
- **400 Bad Request**: Invalid parameters or validation error
- **401 Unauthorized**: Authentication failure
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded; retry after the indicated period
- **500 Internal Server Error**: Server-side error
Error responses include:

```json
{
  "status": "error",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

## Pagination

V3 endpoints support cursor-based pagination for large result sets:

1. Make initial request without a cursor token
2. If response includes `metadata.hasMore: true`, use the `metadata.next` value in the next request
3. Continue until `metadata.hasMore` is `false`

Example flow:

```javascript
let allData = [];
let cursorToken = null;

do {
  const response = await fetchData({
    // ...other parameters
    cursor: cursorToken, //aka metadata.next
  });

  allData = allData.concat(response.data);
  cursorToken = response.metadata?.next;
} while (response.metadata?.hasMore);
```

### Python Example:

```python
import requests

def fetch_all_data(base_params):
    """Fetch all data using pagination with cursor tokens."""
    all_data = []
    cursor_token = None

    while True:
        # Add cursor token to parameters if available
        if cursor_token:
            base_params['cursor'] = cursor_token

        # Make API request
        response = requests.post(
            'https://{{BASE_URL}}/api/v3/public/analytics/raw-data',
            json=base_params,
            headers={'Authorization': 'Bearer YOUR_API_KEY'}
        ).json()

        # Add data from current page
        all_data.extend(response['data'])

        # Check if more data is available
        if not response['metadata']['hasMore']:
            break

        # Update cursor for next page
        cursor_token = response['metadata']['next']

    return all_data

# Example usage
params = {
    "network": "airqo",
    "startDateTime": "2023-01-01T00:00:00Z",
    "endDateTime": "2023-01-02T00:00:00Z",
    "device_category": "lowcost",
    "device_names": ["device1", "device2"],
    "pollutants": ["pm2_5", "pm10"],
    "frequency": "raw"
}

all_measurements = fetch_all_data(params)
print(f"Retrieved {len(all_measurements)} measurements in total")
```

## Response Format

All API responses follow a consistent structure:

- For successful requests:

  - `status`: "success"
  - `message`: Description of the result
  - `data`: The requested data

- For v3 endpoints with pagination, responses include:

* - `metadata`: { totalCount, hasMore, next }

## Best Practices

1. **Time Ranges**: Limit time ranges to reasonable periods (7-30 days) to avoid timeout issues
2. **Filter Appropriately**: Use devices or sites filters to narrow results
3. **Use Pagination**: For large datasets, implement pagination logic
4. **Specify Fields**: Request only needed pollutants and metadata fields
5. **Async for Large Exports**: Use data-export endpoint for large historical datasets
6. **Cache Results**: Implement client-side caching for frequent queries

---

For further assistance, contact the AirQo API support team at support@airqo.net
