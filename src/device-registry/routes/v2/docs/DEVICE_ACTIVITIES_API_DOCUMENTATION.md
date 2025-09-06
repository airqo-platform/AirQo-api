# Device Registry Activities API Documentation

## Overview

This API provides endpoints for managing device activities including deployment, maintenance, and recall operations. The API supports both static (site-based) and mobile (grid-based) device deployments.

## Base URL

```
/api/v2/activities
```

## Endpoints

### 1. Recall Device Activity

**Endpoint:** `POST /recall`

**Description:** Records a device recall activity

**Request Body:**

```json
{
  "recallType": "maintenance",
  "date": "2024-01-15T10:30:00.000Z",
  "user_id": "60f1b2e4d4a5c123456789ab",
  "firstName": "John",
  "lastName": "Doe",
  "userName": "johndoe",
  "email": "john.doe@example.com"
}
```

**Query Parameters:**

- `tenant` (optional): Network tenant (defaults to "airqo")
- `deviceName` (required): Name of the device to recall

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully recalled the device",
  "createdActivity": {
    "_id": "60f1b2e4d4a5c123456789ac",
    "device": "aq_device_001",
    "date": "2024-01-15T10:30:00.000Z",
    "description": "device recalled",
    "activityType": "recallment",
    "recallType": "maintenance"
  },
  "updatedDevice": {
    "_id": "60f1b2e4d4a5c123456789ad",
    "name": "aq_device_001",
    "isActive": false,
    "status": "recalled",
    "recall_date": "2024-01-15T10:30:00.000Z"
  },
  "user_id": "60f1b2e4d4a5c123456789ab"
}
```

### 2. Deploy Device (Enhanced)

**Endpoint:** `POST /deploy`

**Description:** Deploys a device to either a static site or mobile grid with enhanced validation

**Request Body (Static Deployment):**

```json
{
  "site_id": "60f1b2e4d4a5c123456789ae",
  "deployment_type": "static",
  "height": 5.5,
  "powerType": "solar",
  "mountType": "pole",
  "isPrimaryInLocation": true,
  "date": "2024-01-15T10:30:00.000Z",
  "network": "airqo",
  "user_id": "60f1b2e4d4a5c123456789ab",
  "host_id": "60f1b2e4d4a5c123456789af"
}
```

**Request Body (Mobile Deployment):**

```json
{
  "grid_id": "60f1b2e4d4a5c123456789ag",
  "deployment_type": "mobile",
  "height": 3.0,
  "powerType": "alternator",
  "mountType": "vehicle",
  "isPrimaryInLocation": false,
  "date": "2024-01-15T10:30:00.000Z",
  "network": "airqo",
  "user_id": "60f1b2e4d4a5c123456789ab",
  "mobility_metadata": {
    "route_id": "route_001",
    "coverage_area": "downtown",
    "operational_hours": "9am-5pm",
    "movement_pattern": "circular"
  }
}
```

**Query Parameters:**

- `tenant` (optional): Network tenant
- `deviceName` (required): Name of the device to deploy

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully deployed the device",
  "createdActivity": {
    "_id": "60f1b2e4d4a5c123456789ah",
    "device": "aq_device_001",
    "date": "2024-01-15T10:30:00.000Z",
    "description": "device deployed",
    "activityType": "deployment",
    "deployment_type": "static",
    "site_id": "60f1b2e4d4a5c123456789ae",
    "nextMaintenance": "2024-04-15T10:30:00.000Z"
  },
  "updatedDevice": {
    "_id": "60f1b2e4d4a5c123456789ad",
    "name": "aq_device_001",
    "isActive": true,
    "status": "deployed",
    "deployment_type": "static",
    "site_id": "60f1b2e4d4a5c123456789ae",
    "latitude": -1.2921,
    "longitude": 36.8219
  },
  "user_id": "60f1b2e4d4a5c123456789ab",
  "deployment_type": "static"
}
```

### 3. Deploy Owned Device

**Endpoint:** `POST /deploy-owned`

**Description:** Deploys a device owned by a specific user with ownership validation

**Request Body:**

```json
{
  "site_id": "60f1b2e4d4a5c123456789ae",
  "deployment_type": "static",
  "user_id": "60f1b2e4d4a5c123456789ab",
  "height": 5.5,
  "powerType": "solar",
  "mountType": "pole",
  "isPrimaryInLocation": true,
  "date": "2024-01-15T10:30:00.000Z",
  "network": "airqo"
}
```

**Response:** Same as regular deployment endpoint

### 4. Batch Deployment

**Endpoint:** `POST /deploy/batch`

**Description:** Deploys multiple devices simultaneously supporting mixed deployment types

**Request Body:**

```json
[
  {
    "deviceName": "aq_device_001",
    "deployment_type": "static",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "site_name": "Kampala Central",
    "height": 5.5,
    "powerType": "solar",
    "mountType": "pole",
    "isPrimaryInLocation": true,
    "network": "airqo",
    "date": "2024-01-15T10:30:00.000Z"
  },
  {
    "deviceName": "aq_device_002",
    "deployment_type": "mobile",
    "grid_id": "60f1b2e4d4a5c123456789ag",
    "height": 3.0,
    "powerType": "alternator",
    "mountType": "vehicle",
    "isPrimaryInLocation": false,
    "network": "airqo",
    "date": "2024-01-15T10:30:00.000Z"
  }
]
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Batch deployment processed",
  "successful_deployments": [
    {
      "deviceName": "aq_device_001",
      "deployment_type": "static",
      "createdActivity": {
        /* activity object */
      },
      "updatedDevice": {
        /* device object */
      }
    }
  ],
  "failed_deployments": [
    {
      "deviceName": "aq_device_002",
      "deployment_type": "mobile",
      "error": { "message": "Grid not found" }
    }
  ],
  "deployment_summary": {
    "total_requested": 2,
    "total_successful": 1,
    "total_failed": 1,
    "static_deployments": 1,
    "mobile_deployments": 1,
    "successful_static": 1,
    "successful_mobile": 0
  }
}
```

### 5. Deploy Mobile Device

**Endpoint:** `POST /deploy/mobile`

**Description:** Specifically deploys a mobile device to a grid

**Request Body:**

```json
{
  "grid_id": "60f1b2e4d4a5c123456789ag",
  "height": 3.0,
  "powerType": "alternator",
  "mountType": "vehicle",
  "isPrimaryInLocation": false,
  "date": "2024-01-15T10:30:00.000Z",
  "network": "airqo",
  "mobility_metadata": {
    "route_id": "route_001",
    "coverage_area": "downtown"
  }
}
```

**Response:** Same format as regular deployment

### 6. Deploy Static Device

**Endpoint:** `POST /deploy/static`

**Description:** Specifically deploys a static device to a site

**Request Body:**

```json
{
  "site_id": "60f1b2e4d4a5c123456789ae",
  "height": 5.5,
  "powerType": "solar",
  "mountType": "pole",
  "isPrimaryInLocation": true,
  "date": "2024-01-15T10:30:00.000Z",
  "network": "airqo"
}
```

**Response:** Same format as regular deployment

### 7. Get Deployment Statistics

**Endpoint:** `GET /deploy/stats`

**Description:** Retrieves deployment statistics

**Query Parameters:**

- `tenant` (optional): Network tenant

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Deployment statistics retrieved successfully",
  "data": {
    "deployments": {
      "total": 150,
      "static": 120,
      "mobile": 30,
      "static_percentage": "80.00",
      "mobile_percentage": "20.00"
    },
    "active_devices": {
      "total": 135,
      "static": 110,
      "mobile": 25,
      "static_percentage": "81.48",
      "mobile_percentage": "18.52"
    },
    "all_devices": {
      "total": 200,
      "active_rate": "67.50"
    },
    "generated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 8. Get Devices by Deployment Type

**Endpoint:** `GET /devices/by-type/:deploymentType`

**Description:** Retrieves devices filtered by deployment type

**Path Parameters:**

- `deploymentType` (required): Either "static" or "mobile"

**Query Parameters:**

- `tenant` (optional): Network tenant
- `limit` (optional): Number of results (default: 100)
- `skip` (optional): Number of results to skip (default: 0)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "static devices retrieved successfully",
  "data": [
    {
      "_id": "60f1b2e4d4a5c123456789ad",
      "name": "aq_device_001",
      "deployment_type": "static",
      "site_id": "60f1b2e4d4a5c123456789ae",
      "site": {
        "_id": "60f1b2e4d4a5c123456789ae",
        "name": "Kampala Central",
        "admin_level": "city"
      },
      "latitude": -1.2921,
      "longitude": 36.8219,
      "isActive": true,
      "deployment_date": "2024-01-15T10:30:00.000Z"
    }
  ],
  "deployment_type": "static",
  "total_count": 1
}
```

### 9. Maintain Device

**Endpoint:** `POST /maintain`

**Description:** Records a device maintenance activity

**Request Body:**

```json
{
  "date": "2024-01-15T10:30:00.000Z",
  "description": "Routine sensor calibration",
  "maintenanceType": "preventive",
  "tags": ["calibration", "sensors"],
  "site_id": "60f1b2e4d4a5c123456789ae",
  "network": "airqo",
  "user_id": "60f1b2e4d4a5c123456789ab"
}
```

**Query Parameters:**

- `tenant` (optional): Network tenant
- `deviceName` (required): Name of the device

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully maintained the device",
  "createdActivity": {
    "_id": "60f1b2e4d4a5c123456789ai",
    "device": "aq_device_001",
    "date": "2024-01-15T10:30:00.000Z",
    "description": "Routine sensor calibration",
    "activityType": "maintenance",
    "maintenanceType": "preventive",
    "tags": ["calibration", "sensors"],
    "nextMaintenance": "2024-04-15T10:30:00.000Z"
  },
  "updatedDevice": {
    "_id": "60f1b2e4d4a5c123456789ad",
    "name": "aq_device_001",
    "maintenance_date": "2024-01-15T10:30:00.000Z",
    "nextMaintenance": "2024-04-15T10:30:00.000Z"
  },
  "user_id": "60f1b2e4d4a5c123456789ab"
}
```

### 10. List Activities

**Endpoint:** `GET /`

**Description:** Retrieves a list of activities with optional filtering

**Query Parameters:**

- `tenant` (optional): Network tenant
- `device` (optional): Device name filter
- `activity_type` (optional): Type of activity (deployment, maintenance, recallment)
- `site_id` (optional): Site ID filter
- `network` (optional): Network filter
- `limit` (optional): Number of results (default: 1000)
- `skip` (optional): Number of results to skip (default: 0)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved the activities",
  "site_activities": [
    {
      "_id": "60f1b2e4d4a5c123456789ai",
      "device": "aq_device_001",
      "date": "2024-01-15T10:30:00.000Z",
      "description": "device deployed",
      "activityType": "deployment",
      "deployment_type": "static",
      "site_id": "60f1b2e4d4a5c123456789ae",
      "site": [
        {
          "_id": "60f1b2e4d4a5c123456789ae",
          "name": "Kampala Central"
        }
      ],
      "network": "airqo",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 11. Update Activity

**Endpoint:** `PUT /`

**Description:** Updates an existing activity

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Activity ID to update

**Request Body:**

```json
{
  "description": "Updated description",
  "tags": ["updated", "maintenance"]
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully modified the activity",
  "updated_activity": {
    "_id": "60f1b2e4d4a5c123456789ai",
    "description": "Updated description",
    "tags": ["updated", "maintenance"],
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 12. Bulk Update Activities

**Endpoint:** `PUT /bulk/`

**Description:** Updates multiple activities in bulk (Not yet implemented)

**Response (501 - Not Implemented):**

```json
{
  "success": false,
  "message": "NOT YET IMPLEMENTED",
  "errors": {
    "message": "NOT YET IMPLEMENTED"
  }
}
```

### 13. Bulk Add Activities

**Endpoint:** `POST /bulk/`

**Description:** Adds multiple activities in bulk (Not yet implemented)

**Response (501 - Not Implemented):**

```json
{
  "success": false,
  "message": "NOT YET IMPLEMENTED",
  "errors": {
    "message": "NOT YET IMPLEMENTED"
  }
}
```

### 14. Delete Activity

**Endpoint:** `DELETE /`

**Description:** Deletes an activity

**Query Parameters:**

- `tenant` (optional): Network tenant
- `id` (required): Activity ID to delete

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully removed the activity",
  "deleted_activity": {
    "_id": "60f1b2e4d4a5c123456789ai",
    "device": "aq_device_001",
    "activityType": "deployment"
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
- `404` - Not Found (device, site, or activity not found)
- `409` - Conflict (device already deployed, duplicate names)
- `500` - Internal Server Error

## Notes

1. **Deployment Types**: The API supports both "static" (site-based) and "mobile" (grid-based) deployments
2. **Business Rules**: Mobile devices must use "vehicle" mount type and "alternator" power type
3. **Static vs Mobile**: Static deployments require `site_id`, mobile deployments require `grid_id`
4. **Batch Operations**: Batch deployment supports mixed deployment types in a single request
5. **Date Validation**: Dates cannot be in the future or more than one month in the past
6. **Ownership**: Owned device deployment validates device ownership before allowing deployment
