# Devices Management API Documentation

## Overview

This API provides comprehensive endpoints for managing air quality monitoring devices including device registration, claiming, organization assignment, shipping preparation, metadata management, and QR code generation. The system supports both static and mobile device deployments with multi-tenant architecture.

## Base URL

```
/api/v2/devices
```

## Authentication

All endpoints require proper tenant validation through query parameters or headers.

## Common Query Parameters

- `tenant` (optional): Network tenant identifier (defaults to "airqo")
- `limit` (optional): Number of results to return (default: 1000, max: 2000)
- `skip` (optional): Number of results to skip for pagination (default: 0)

## Endpoints

### 1. List Devices

**Endpoint:** `GET /`

**Description:** Retrieves a paginated list of devices with optional filtering

**Query Parameters:**

- `tenant` (optional): Network tenant
- `device_number` (optional): Filter by device number (integer)
- `id` (optional): Filter by device ID (MongoDB ObjectId)
- `site_id` (optional): Filter by site ID (MongoDB ObjectId)
- `name` (optional): Filter by device name
- `online_status` (optional): Filter by status ("online" or "offline")
- `category` (optional): Device category ("bam", "lowcost", "gas")
- `device_category` (optional): Alternative category filter
- `last_active_before` (optional): Devices last active before date (ISO8601)
- `last_active_after` (optional): Devices last active after date (ISO8601)
- `last_active` (optional): Exact last active date (ISO8601)
- `limit` (optional): Results limit (default: 1000)
- `skip` (optional): Results to skip (default: 0)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved the device details",
  "devices": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "aq_device_001",
      "long_name": "AirQo Device 001",
      "device_number": 12345,
      "serial_number": "AQ001-2024",
      "network": "airqo",
      "category": "lowcost",
      "deployment_type": "static",
      "mobility": false,
      "isActive": true,
      "status": "deployed",
      "claim_status": "claimed",
      "owner_id": "60f1b2e4d4a5c123456789ac",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "mountType": "pole",
      "powerType": "solar",
      "height": 5.5,
      "elevation": 1200.5,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "lastActive": "2024-01-15T08:45:00.000Z",
      "isOnline": true,
      "activities": [
        {
          "_id": "60f1b2e4d4a5c123456789ae",
          "activityType": "deployment",
          "date": "2024-01-20T09:00:00.000Z",
          "description": "Device deployed at Kampala Central",
          "createdAt": "2024-01-20T09:15:00.000Z",
          "tags": ["deployment", "kampala"]
        },
        {
          "_id": "60f1b2e4d4a5c123456789af",
          "activityType": "maintenance",
          "date": "2024-01-10T14:30:00.000Z",
          "description": "Routine maintenance performed",
          "maintenanceType": "routine",
          "nextMaintenance": "2024-04-10T14:30:00.000Z",
          "createdAt": "2024-01-10T15:00:00.000Z",
          "tags": ["maintenance", "routine"]
        }
      ],
      "latest_deployment": {
        "_id": "60f1b2e4d4a5c123456789ae",
        "activityType": "deployment",
        "date": "2024-01-20T09:00:00.000Z",
        "description": "Device deployed at Kampala Central",
        "createdAt": "2024-01-20T09:15:00.000Z"
      },
      "latest_maintenance": {
        "_id": "60f1b2e4d4a5c123456789af",
        "activityType": "maintenance",
        "date": "2024-01-10T14:30:00.000Z",
        "description": "Routine maintenance performed",
        "maintenanceType": "routine",
        "nextMaintenance": "2024-04-10T14:30:00.000Z",
        "createdAt": "2024-01-10T15:00:00.000Z"
      },
      "total_activities": 2,
      "site": [
        {
          "_id": "60f1b2e4d4a5c123456789ad",
          "name": "Kampala Central Site",
          "createdAt": "2024-01-10T08:00:00.000Z"
        }
      ]
    }
  ]
}
```

### 2. Get Device Summary

**Endpoint:** `GET /summary`

**Description:** Retrieves a condensed summary list of devices

**Query Parameters:** Same as list devices endpoint

**Response:** Same format as list devices but with reduced data fields

### 3. Create Device

**Endpoint:** `POST /`

**Description:** Creates a new device in the registry

**Request Body:**

```json
{
  "name": "aq_device_new",
  "long_name": "AirQo Device New 001",
  "category": "lowcost",
  "network": "airqo",
  "generation_version": 4,
  "generation_count": 15,
  "groups": ["urban", "monitoring"],
  "deployment_type": "static",
  "mobility": false,
  "mountType": "pole",
  "powerType": "solar",
  "latitude": -1.2921,
  "longitude": 36.8219,
  "height": 5.5,
  "elevation": 1200.5,
  "description": "New air quality monitoring device",
  "isActive": true,
  "isPrimaryInLocation": false,
  "isUsedForCollocation": false,
  "phoneNumber": "+256700123456"
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Successfully created the device",
  "created_device": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "aq_device_new",
    "long_name": "AirQo Device New 001",
    "device_number": 12346,
    "category": "lowcost",
    "network": "airqo",
    "deployment_type": "static",
    "mobility": false,
    "status": "not deployed",
    "claim_status": "unclaimed",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Get Device by ID

**Endpoint:** `GET /:id`

**Description:** Retrieves detailed information for a specific device

**Path Parameters:**

- `id` (required): Device ID (MongoDB ObjectId)

**Query Parameters:**

- `tenant` (optional): Network tenant

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device details fetched successfully",
  "data": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "aq_device_001",
    "long_name": "AirQo Device 001",
    "device_number": 12345,
    "serial_number": "AQ001-2024",
    "network": "airqo",
    "category": "lowcost",
    "deployment_type": "static",
    "mobility": false,
    "isActive": true,
    "status": "deployed",
    "claim_status": "claimed",
    "owner_id": "60f1b2e4d4a5c123456789ac",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "mountType": "pole",
    "powerType": "solar",
    "height": 5.5,
    "elevation": 1200.5,
    "groups": ["urban", "monitoring"],
    "description": "Air quality monitoring device",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastActive": "2024-01-15T08:45:00.000Z",
    "isOnline": true
  }
}
```

### 5. Update Device

**Endpoint:** `PUT /`

**Description:** Updates an existing device

**Query Parameters:**

- `tenant` (optional): Network tenant
- One of the following identifiers is required:
  - `device_number` (optional): Device number
  - `id` (optional): Device ID
  - `name` (optional): Device name

**Request Body:**

```json
{
  "long_name": "Updated Device Name",
  "mountType": "wall",
  "powerType": "mains",
  "height": 6.0,
  "isActive": true,
  "groups": ["urban", "monitoring", "updated"],
  "description": "Updated device description",
  "latitude": -1.2922,
  "longitude": 36.822,
  "visibility": true
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully modified the device",
  "updated_device": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "aq_device_001",
    "long_name": "Updated Device Name",
    "mountType": "wall",
    "powerType": "mains",
    "height": 6.0,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 6. Delete Device

**Endpoint:** `DELETE /`

**Description:** Deletes a device (Currently disabled)

**Response (503 - Service Unavailable):**

```json
{
  "success": false,
  "message": "feature temporarily disabled --coming soon",
  "errors": {
    "message": "Service Unavailable"
  }
}
```

### 7. Refresh Device

**Endpoint:** `PUT /refresh`

**Description:** Refreshes device metadata (Currently disabled)

**Response (503 - Service Unavailable):**

```json
{
  "success": false,
  "message": "feature temporarily disabled --coming soon",
  "errors": {
    "message": "Service Unavailable"
  }
}
```

### 8. Bulk Update Devices

**Endpoint:** `PUT /bulk`

**Description:** Updates multiple devices simultaneously

**Request Body:**

```json
{
  "deviceIds": [
    "60f1b2e4d4a5c123456789ab",
    "60f1b2e4d4a5c123456789ac",
    "60f1b2e4d4a5c123456789ad"
  ],
  "updateData": {
    "groups": ["urban", "monitoring", "bulk_updated"],
    "category": "lowcost",
    "description": "Bulk updated devices",
    "mobility": false
  }
}
```

**Validation Rules:**

- Maximum 30 devices per bulk update
- All deviceIds must be valid MongoDB ObjectIds
- Allowed update fields: groups, mobility, owner, description, product_name, device_manufacturer, category

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully modified 3 devices",
  "bulk_update_notes": {
    "modifiedCount": 3,
    "matchedCount": 3
  },
  "metadata": {
    "totalDevicesUpdated": 3,
    "requestedDeviceIds": [
      "60f1b2e4d4a5c123456789ab",
      "60f1b2e4d4a5c123456789ac",
      "60f1b2e4d4a5c123456789ad"
    ],
    "existingDeviceIds": [
      "60f1b2e4d4a5c123456789ab",
      "60f1b2e4d4a5c123456789ac",
      "60f1b2e4d4a5c123456789ad"
    ]
  }
}
```

### 9. Get Device Count

**Endpoint:** `GET /count`

**Description:** Retrieves the total number of devices matching filter criteria

**Query Parameters:**

- `tenant` (optional): Network tenant
- Additional filter parameters (same as list devices)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "retrieved the number of devices",
  "devices": 150
}
```

### 10. Claim Device

**Endpoint:** `POST /claim`

**Description:** Claims an unclaimed device for a user

**Request Body:**

```json
{
  "device_name": "aq_device_001",
  "claim_token": "EXAMPLE_CLAIM_TOKEN",
  "user_id": "60f1b2e4d4a5c123456789ab"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device claimed successfully!",
  "data": {
    "name": "aq_device_001",
    "long_name": "AirQo Device 001",
    "status": "not deployed",
    "claim_status": "claimed",
    "claimed_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 11. Get My Devices

**Endpoint:** `GET /my-devices`

**Description:** Retrieves devices owned by a specific user

**Query Parameters:**

- `tenant` (optional): Network tenant
- `user_id` (required): User ID (MongoDB ObjectId)
- `organization_id` (optional): Filter by organization

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Devices retrieved successfully",
  "devices": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "aq_device_001",
      "long_name": "AirQo Device 001",
      "status": "deployed",
      "isActive": true,
      "claim_status": "claimed",
      "claimed_at": "2024-01-15T10:30:00.000Z",
      "deployment_date": "2024-01-20T09:00:00.000Z",
      "latitude": -1.2921,
      "longitude": 36.8219
    }
  ],
  "total_devices": 1,
  "deployed_devices": 1
}
```

### 12. Check Device Availability

**Endpoint:** `GET /check-availability/:deviceName`

**Description:** Checks if a device is available for claiming

**Path Parameters:**

- `deviceName` (required): Device name to check

**Query Parameters:**

- `tenant` (optional): Network tenant

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device available for claiming",
  "data": {
    "available": true,
    "status": "unclaimed"
  }
}
```

### 13. Assign Device to Organization

**Endpoint:** `POST /assign-to-organization`

**Description:** Assigns a user's device to an organization

**Request Body:**

```json
{
  "device_name": "aq_device_001",
  "organization_id": "60f1b2e4d4a5c123456789ab",
  "user_id": "60f1b2e4d4a5c123456789ac",
  "organization_data": {
    "name": "Kampala University",
    "type": "Educational Institution"
  }
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device assigned to organization successfully",
  "data": {
    "name": "aq_device_001",
    "assigned_organization_id": "60f1b2e4d4a5c123456789ab",
    "assigned_organization": {
      "id": "60f1b2e4d4a5c123456789ab",
      "name": "Kampala University",
      "type": "Educational Institution",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    "organization_assigned_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 14. Switch Organization Context

**Endpoint:** `POST /switch-organization/:organization_id`

**Description:** Switches user's organizational context

**Path Parameters:**

- `organization_id` (required): Organization ID to switch to

**Request Body:**

```json
{
  "user_id": "60f1b2e4d4a5c123456789ab"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Organization context switched successfully",
  "data": {
    "current_organization_id": "60f1b2e4d4a5c123456789ab",
    "user_id": "60f1b2e4d4a5c123456789ab"
  }
}
```

### 15. Get User Organizations

**Endpoint:** `GET /user-organizations`

**Description:** Retrieves organizations associated with a user

**Query Parameters:**

- `user_id` (required): User ID (MongoDB ObjectId)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Successfully retrieved user organizations",
  "organizations": [
    {
      "id": "60f1b2e4d4a5c123456789ab",
      "name": "Kampala University",
      "type": "Educational Institution"
    },
    {
      "id": "60f1b2e4d4a5c123456789ac",
      "name": "Research Institute",
      "type": "Research"
    }
  ],
  "total_organizations": 2
}
```

### 16. Generate Claim QR Code

**Endpoint:** `GET /qr-code/:deviceName`

**Description:** Generates a QR code for device claiming

**Path Parameters:**

- `deviceName` (required): Device name

**Query Parameters:**

- `tenant` (optional): Network tenant
- `include_token` (optional): Include claim token ("true" or "false")
- `format` (optional): Response format ("data" or "image")

**Response (Success - 200, format=data):**

```json
{
  "success": true,
  "message": "QR code generated successfully",
  "device_name": "aq_device_001",
  "qr_code_data": {
    "device_id": "aq_device_001",
    "device_name": "AirQo Device 001",
    "claim_url": "https://platform.airqo.net/claim-device?id=aq_device_001",
    "platform": "AirQo",
    "tenant": "airqo",
    "generated_at": "2024-01-15T10:30:00.000Z"
  },
  "qr_code_url": "https://platform.airqo.net/claim-device?id=aq_device_001"
}
```

**Response (Success - 200, format=image):**
Returns PNG image data with Content-Type: image/png

### 17. Generate QR Code (Legacy)

**Endpoint:** `GET /qrcode`

**Description:** Generates a QR code for device information (legacy endpoint)

**Query Parameters:**

- `tenant` (optional): Network tenant
- Device identifier (device_number, id, or name)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "QR code generated successfully",
  "data": {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "device_name": "aq_device_001",
    "data_size_bytes": 256
  }
}
```

### 18. Migrate Devices for Claiming

**Endpoint:** `POST /migrate-for-claiming`

**Description:** Administrative endpoint to migrate devices for claiming system

**Headers:**

- `admin_key` (required): Admin authorization key

**Request Body:**

```json
{
  "dry_run": false,
  "batch_size": 100,
  "generate_tokens": true
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device migration completed successfully",
  "migration_stats": {
    "devices_updated": 150,
    "devices_matched": 150,
    "token_generation": {
      "tokens_generated": 150,
      "batch_processed": 150
    },
    "tenant": "airqo",
    "migration_completed_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 19. Encrypt Device Keys

**Endpoint:** `PUT /encrypt`

**Description:** Encrypts device API keys (writeKey and readKey)

**Query Parameters:**

- `tenant` (optional): Network tenant
- Device identifier (device_number, id, or name)

**Request Body:**

```json
{
  "writeKey": "EXAMPLE_THINGSPEAK_WRITE_KEY",
  "readKey": "EXAMPLE_THINGSPEAK_READ_KEY"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully modified the device",
  "updated_device": {
    "_id": "60f1b2e4d4a5c123456789ab",
    "name": "aq_device_001",
    "writeKey": "EXAMPLE_ENCRYPTED_KEY",
    "readKey": "EXAMPLE_ENCRYPTED_KEY"
  }
}
```

### 20. Decrypt Device Key

**Endpoint:** `POST /decrypt`

**Description:** Decrypts a single encrypted device key

**Request Body:**

```json
{
  "encrypted_key": "EXAMPLE_ENCRYPTED_KEY"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully decrypted the text",
  "decrypted_key": "EXAMPLE_THINGSPEAK_WRITE_KEY"
}
```

**Response (Error - 404):**

```json
{
  "success": false,
  "message": "the provided encrypted key is not recognizable",
  "errors": {
    "message": "the provided encrypted key is not recognizable"
  }
}
```

### 21. Decrypt Multiple Device Keys

**Endpoint:** `POST /decrypt/bulk`

**Description:** Decrypts multiple encrypted device keys

**Request Body:**

```json
[
  {
    "encrypted_key": "EXAMPLE_ENCRYPTED_KEY",
    "device_number": 12345
  },
  {
    "encrypted_key": "EXAMPLE_ENCRYPTED_KEY",
    "device_number": 12346
  }
]
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully decrypted the provided keys",
  "decrypted_keys": [
    {
      "encrypted_key": "EXAMPLE_ENCRYPTED_KEY",
      "device_number": 12345,
      "decrypted_key": "EXAMPLE_THINGSPEAK_WRITE_KEY"
    },
    {
      "encrypted_key": "EXAMPLE_ENCRYPTED_KEY",
      "device_number": 12346,
      "decrypted_key": "EXAMPLE_THINGSPEAK_READ_KEY"
    }
  ]
}
```

### 22. Get Devices by Nearest Coordinates

**Endpoint:** `GET /by/nearest-coordinates`

**Description:** Finds devices within a specified radius of coordinates

**Query Parameters:**

- `tenant` (required): Network tenant
- `latitude` (required): Latitude coordinate
- `longitude` (required): Longitude coordinate
- `radius` (required): Search radius in kilometers
- `limit` (optional): Number of results
- `skip` (optional): Number of results to skip

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "successfully retrieved nearest devices",
  "devices": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "aq_device_001",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "distance": 0.5,
      "status": "deployed"
    },
    {
      "_id": "60f1b2e4d4a5c123456789ac",
      "name": "aq_device_002",
      "latitude": -1.2925,
      "longitude": 36.8225,
      "distance": 1.2,
      "status": "deployed"
    }
  ]
}
```

### 23. Soft Operations (Platform Only)

#### Create Device (Soft)

**Endpoint:** `POST /soft`

**Description:** Creates device on platform only (without external systems)

**Request Body:** Same as regular create device

**Response:** Same format as regular create device

#### Update Device (Soft)

**Endpoint:** `PUT /soft`

**Description:** Updates device on platform only

**Request Body:** Same as regular update device

**Response:** Same format as regular update device

#### Delete Device (Soft)

**Endpoint:** `DELETE /soft`

**Description:** Deletes device on platform only

**Response:** Same format as regular delete device

### 24. Shipping Preparation

#### Prepare Device for Shipping

**Endpoint:** `POST /prepare-for-shipping`

**Description:** Prepares a single device for shipping with claim token generation

**Request Body:**

```json
{
  "device_name": "aq_device_001",
  "token_type": "hex"
}
```

**Token Types:**

- `hex`: Generates hexadecimal token (default)
- `readable`: Generates human-readable token

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Device prepared for shipping successfully",
  "device_preparation": {
    "device_name": "aq_device_001",
    "claim_token": "EXAMPLE_CLAIM_TOKEN",
    "token_type": "hex",
    "qr_code_data": {
      "device_id": "aq_device_001",
      "claim_url": "https://platform.airqo.net/claim-device?id=aq_device_001&token=EXAMPLE_CLAIM_TOKEN"
    },
    "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "label_data": {
      "device_name": "aq_device_001",
      "claim_token": "EXAMPLE_CLAIM_TOKEN",
      "instructions": "Scan QR code to claim device"
    },
    "shipping_prepared_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Prepare Bulk Devices for Shipping

**Endpoint:** `POST /prepare-bulk-for-shipping`

**Description:** Prepares multiple devices for shipping

**Request Body:**

```json
{
  "device_names": ["aq_device_001", "aq_device_002", "aq_device_003"],
  "token_type": "readable"
}
```

**Validation Rules:**

- 1-50 device names per request
- Each device name must be 3-50 characters
- No duplicate device names allowed

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Bulk preparation completed: 3 successful, 0 failed",
  "bulk_preparation_results": {
    "successful_preparations": [
      {
        "device_name": "aq_device_001",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "token_type": "readable"
      },
      {
        "device_name": "aq_device_002",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "token_type": "readable"
      },
      {
        "device_name": "aq_device_003",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "token_type": "readable"
      }
    ],
    "failed_preparations": [],
    "summary": {
      "total_requested": 3,
      "successful_count": 3,
      "failed_count": 0
    }
  }
}
```

#### Get Shipping Status

**Endpoint:** `GET /shipping-status`

**Description:** Retrieves shipping preparation status for devices

**Query Parameters:**

- `tenant` (optional): Network tenant
- `device_names` (optional): Comma-separated device names or array

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Shipping preparation status retrieved successfully",
  "shipping_status": {
    "devices": [
      {
        "name": "aq_device_001",
        "long_name": "AirQo Device 001",
        "claim_status": "unclaimed",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "shipping_prepared_at": "2024-01-15T10:30:00.000Z",
        "owner_id": null,
        "claimed_at": null
      }
    ],
    "summary": {
      "total_devices": 1,
      "prepared_for_shipping": 1,
      "claimed_devices": 0,
      "deployed_devices": 0
    },
    "categorized": {
      "prepared_for_shipping": [
        {
          "name": "aq_device_001",
          "claim_status": "unclaimed",
          "claim_token": "EXAMPLE_CLAIM_TOKEN"
        }
      ],
      "claimed_devices": [],
      "deployed_devices": []
    }
  }
}
```

#### Generate Shipping Labels

**Endpoint:** `POST /generate-shipping-labels`

**Description:** Generates printable shipping labels for devices

**Request Body:**

```json
{
  "device_names": ["aq_device_001", "aq_device_002"]
}
```

**Validation Rules:**

- 1-20 device names per request
- Devices must be prepared for shipping (have claim tokens)

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Shipping labels generated successfully",
  "shipping_labels": {
    "labels": [
      {
        "device_name": "aq_device_001",
        "device_long_name": "AirQo Device 001",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "instructions": "Scan QR code to claim device",
        "label_id": "LABEL-001-2024"
      },
      {
        "device_name": "aq_device_002",
        "device_long_name": "AirQo Device 002",
        "claim_token": "EXAMPLE_CLAIM_TOKEN",
        "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgBB...",
        "instructions": "Scan QR code to claim device",
        "label_id": "LABEL-002-2024"
      }
    ],
    "total_labels": 2
  }
}
```

### 25. Metadata Management

#### Get Mobile Devices Metadata Analysis

**Endpoint:** `GET /mobile-metadata-analysis`

**Description:** Analyzes device metadata for conflicts and inconsistencies between mobile and static devices

**Query Parameters:**

- `tenant` (optional): Network tenant
- `limit` (optional): Number of results
- `skip` (optional): Number of results to skip

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Comprehensive device metadata analysis completed",
  "mobile_devices": [
    {
      "_id": "60f1b2e4d4a5c123456789ab",
      "name": "aq_mobile_001",
      "deployment_type": "mobile",
      "mobility": true,
      "mountType": "vehicle",
      "powerType": "alternator",
      "grid_id": "60f1b2e4d4a5c123456789ad"
    }
  ],
  "conflicting_devices": [
    {
      "_id": "60f1b2e4d4a5c123456789ac",
      "name": "aq_device_002",
      "deployment_type": "mobile",
      "mobility": true,
      "mountType": "pole",
      "powerType": "solar",
      "conflicts": [
        {
          "type": "mobile_mount_type_invalid",
          "message": "Mobile device has invalid mountType 'pole', should be 'vehicle'",
          "current_value": {
            "mountType": "pole",
            "deployment_type": "mobile"
          },
          "suggested_fix": {
            "mountType": "vehicle"
          }
        },
        {
          "type": "mobile_power_type_invalid",
          "message": "Mobile device has invalid powerType 'solar', should be 'alternator'",
          "current_value": {
            "powerType": "solar",
            "deployment_type": "mobile"
          },
          "suggested_fix": {
            "powerType": "alternator"
          }
        }
      ],
      "severity": "medium"
    }
  ],
  "metadata_analysis": {
    "total_devices": 100,
    "valid_mobile_devices": 15,
    "valid_static_devices": 80,
    "conflicting_devices": 5,
    "high_severity_conflicts": 2,
    "conflict_breakdown": {
      "mobile_issues": {
        "invalid_mount_type": 3,
        "invalid_power_type": 2,
        "has_site_not_grid": 1,
        "mobility_false": 1
      },
      "static_issues": {
        "vehicle_mount": 1,
        "alternator_power": 1,
        "has_grid_not_site": 1,
        "mobility_true": 1
      },
      "cross_validation_issues": {
        "vehicle_mount_not_mobile": 2,
        "pole_mount_not_static": 1,
        "alternator_power_not_mobile": 1,
        "both_site_and_grid": 1
      }
    },
    "business_rules_summary": {
      "expected_mobile_attributes": {
        "mountType": "vehicle",
        "powerType": "alternator",
        "mobility": true,
        "location_reference": "grid_id"
      },
      "expected_static_attributes": {
        "mountType": "pole|wall|faceboard|rooftop|suspended",
        "powerType": "solar|mains",
        "mobility": false,
        "location_reference": "site_id"
      }
    }
  }
}
```

#### Fix Metadata Conflicts

**Endpoint:** `POST /fix-metadata-conflicts`

**Description:** Automatically fixes device metadata conflicts based on business rules

**Request Body:**

```json
{
  "dry_run": false,
  "fix_types": ["all"],
  "auto_assign_locations": false
}
```

**Parameters:**

- `dry_run`: If true, shows what would be fixed without making changes
- `fix_types`: Array of conflict types to fix (default: ["all"])
- `auto_assign_locations`: If true, automatically assigns locations when possible

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Enhanced metadata cleanup completed",
  "fixed_devices": [
    {
      "device_id": "60f1b2e4d4a5c123456789ab",
      "device_name": "aq_device_001",
      "conflicts_detected": 2,
      "fixes_applied": [
        "Set mountType to 'vehicle' for mobile device",
        "Set powerType to 'alternator' for mobile device"
      ],
      "update_data": {
        "mountType": "vehicle",
        "powerType": "alternator"
      },
      "status": "fixed"
    }
  ],
  "manual_review_required": [
    {
      "device_id": "60f1b2e4d4a5c123456789ac",
      "device_name": "aq_device_002",
      "conflicts": [
        {
          "type": "static_vehicle_mount",
          "message": "Static device cannot have mountType 'vehicle'"
        }
      ],
      "suggested_fixes": [
        "MANUAL REVIEW: Vehicle-mounted device marked as static"
      ],
      "partial_update_data": {},
      "status": "requires_manual_review"
    }
  ],
  "failed_fixes": [],
  "fix_summary": {
    "total_conflicting_devices": 5,
    "automatically_fixed": 3,
    "requires_manual_review": 2,
    "failed_fixes": 0,
    "dry_run": false,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "business_rules_applied": {
      "mobile_requirements": "mountType=vehicle, powerType=alternator, mobility=true, grid_id required",
      "static_requirements": "mountType≠vehicle, powerType≠alternator, mobility=false, site_id required"
    }
  }
}
```

## Device Categories

The system supports three device categories:

- **`lowcost`**: Low-cost air quality sensors (default)
- **`bam`**: Beta Attenuation Monitoring devices
- **`gas`**: Gas-specific monitoring devices

## Device Types

### Static Devices

- **Deployment Type**: `static`
- **Mobility**: `false`
- **Mount Types**: pole, wall, faceboard, rooftop, suspended
- **Power Types**: solar, mains
- **Location Reference**: site_id

### Mobile Devices

- **Deployment Type**: `mobile`
- **Mobility**: `true`
- **Mount Types**: vehicle
- **Power Types**: alternator
- **Location Reference**: grid_id

## Claim Status Values

- **`unclaimed`**: Device is available for claiming
- **`claimed`**: Device has been claimed by a user

## Device Status Values

- **`not deployed`**: Device is registered but not deployed
- **`deployed`**: Device is active and deployed
- **`maintenance`**: Device is under maintenance
- **`recalled`**: Device has been recalled

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
- `403` - Forbidden (access denied, invalid admin key)
- `404` - Not Found (device not found, resource not found)
- `409` - Conflict (duplicate values, device already claimed)
- `500` - Internal Server Error (server-side errors)
- `503` - Service Unavailable (feature disabled)

## Rate Limits

- Bulk operations: Maximum 30 devices per request
- Shipping preparation: Maximum 50 devices per bulk request
- Label generation: Maximum 20 devices per request

## Business Rules

### Mobile Device Requirements

- Must have `mountType: "vehicle"`
- Must have `powerType: "alternator"`
- Must have `mobility: true`
- Must be associated with `grid_id` (not `site_id`)

### Static Device Requirements

- Cannot have `mountType: "vehicle"`
- Cannot have `powerType: "alternator"`
- Must have `mobility: false`
- Must be associated with `site_id` (not `grid_id`)

### Validation Rules

- Device names must be lowercase, alphanumeric with hyphens/underscores
- Coordinates must have minimum 5 decimal places
- Height must be between 0-100 meters
- Phone numbers must be valid international format
- Serial numbers are auto-generated for AirQo network devices

## Notes

- Some endpoints are currently disabled and return 503 Service Unavailable
- Admin endpoints require special authorization keys
- The system supports multi-tenant architecture via the `tenant` parameter
- External system integration (ThingSpeak) is only available for AirQo network devices
- QR codes are optimized for size and scanning reliability
