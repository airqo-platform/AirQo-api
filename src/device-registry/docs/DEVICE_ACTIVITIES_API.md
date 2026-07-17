# Device Activities API Guide

> **Audience:** Frontend engineers integrating with the AirQo device registry — specifically the `airqo-frontend/src/vertex` platform. This document covers every endpoint involved in device lifecycle activities: deployment (static and mobile), recall, and maintenance.

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Authentication](#base-url--authentication)
3. [Common Request Conventions](#common-request-conventions)
4. [Deployment](#deployment)
   - [How the API Determines Deployment Type](#how-the-api-determines-deployment-type)
   - [Static Deployment](#static-deployment)
   - [Mobile Deployment](#mobile-deployment)
   - [Batch Deployment](#batch-deployment)
   - [Deployment Statistics](#deployment-statistics)
5. [Recall](#recall)
6. [Maintenance](#maintenance)
7. [Listing & Querying Activities](#listing--querying-activities)
8. [Field Reference](#field-reference)
   - [Shared Fields (All Activities)](#shared-fields-all-activities)
   - [Deployment-Only Fields](#deployment-only-fields)
   - [Mobile-Only Fields](#mobile-only-fields)
   - [Recall-Only Fields](#recall-only-fields)
   - [Maintenance-Only Fields](#maintenance-only-fields)
9. [Validation Rules & Error Handling](#validation-rules--error-handling)
10. [State Transitions](#state-transitions)
11. [Enums & Allowed Values](#enums--allowed-values)

---

## Overview

The Device Activities API manages the full lifecycle of AirQo monitoring devices — from their initial deployment in the field, through scheduled maintenance, to eventual recall. Lifecycle actions such as deployment, recall, and maintenance create **Activity** records and simultaneously update the **Device** document. These records are not universally immutable — separate admin endpoints (`PUT` and `DELETE /api/v2/devices/activities`) can edit or remove existing activity records.

There are two fundamentally different deployment modes:

| Mode | Where the device lives | Key identifier | Power | Mount |
|------|------------------------|----------------|-------|-------|
| **Static** | Fixed geographic site | `site_id` | `solar` or `mains` | pole, wall, rooftop, faceboard, suspended |
| **Mobile** | Moving within a grid area | `grid_id` | `alternator` | `vehicle` only |

> **Why this matters for the frontend:** The deployment form must branch into two completely different field sets depending on whether the user selects a static or mobile deployment type. Sending the wrong combination (e.g., `grid_id` with `powerType: "solar"`) will result in a `400` validation error from the API.

---

## Base URL & Authentication

All activity endpoints share the same base path:

```http
POST/GET /api/v2/devices/activities/...
```

**Headers required on every request:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Authorization` | Bearer token (standard AirQo auth) |

---

## Common Request Conventions

### The `tenant` Query Parameter

All endpoints accept an optional `tenant` query parameter. For all AirQo platform operations, this is always `airqo` — you do not need to expose this in the UI; just append it to every request.

```http
POST /api/v2/devices/activities/deploy?tenant=airqo&deviceName=aq_g5_19
```

### The `deviceName` Query Parameter

For single-device operations (deploy, recall, maintain) the device's name is passed as a **query parameter**, not in the request body.

```http
POST /api/v2/devices/activities/deploy?tenant=airqo&deviceName=aq_g5_19
```

### Date Format

All `date` values must be a valid ISO 8601 datetime with the `T` separator (fractional seconds are allowed but not required):

```json
"date": "2025-05-12T10:30:00.000Z"
```

Constraints enforced server-side:
- Must not be more than **1 month in the past**
- Must not be in the **future** (a 5-minute buffer is allowed for clock skew)

### ObjectId Format

All ID fields (`site_id`, `grid_id`, `user_id`, `host_id`, `device_id`) must be 24-character hexadecimal MongoDB ObjectIds:

```json
"site_id": "507f1f77bcf86cd799439011"
```

---

## Deployment

### How the API Determines Deployment Type

When you call the generic `POST /deploy` endpoint, the API infers the deployment type from the body:

- Body contains **`site_id`** → treated as **static**
- Body contains **`grid_id`** → treated as **mobile**

You can also call the explicit typed endpoints (`/deploy/static`, `/deploy/mobile`) which apply stricter type-specific validation and are the recommended approach when your UI already knows the type.

---

### Static Deployment

A static deployment anchors a device to a known, fixed monitoring site.

**Endpoint**

```http
POST /api/v2/devices/activities/deploy/static?tenant=airqo&deviceName={deviceName}
```

**When to call this:** The user has selected a site from the site list and is deploying a fixed sensor (pole-mounted, wall-mounted, etc.).

**Request Body**

```json
{
  "site_id": "507f1f77bcf86cd799439011",
  "height": 3.5,
  "mountType": "pole",
  "powerType": "solar",
  "isPrimaryInLocation": true,
  "date": "2025-05-12T10:30:00.000Z",
  "user_id": "507f1f77bcf86cd799439012",
  "firstName": "John",
  "lastName": "Doe",
  "userName": "jdoe",
  "email": "jdoe@example.com",
  "host_id": "507f1f77bcf86cd799439013",
  "network": "airqo"
}
```

**Required fields for static deployment**

| Field | Type | Notes |
|-------|------|-------|
| `site_id` | ObjectId | The site where the device will be installed |
| `height` | Number | Mounting height in metres (>0 and <100, exclusive) |
| `mountType` | String | Any value except `"vehicle"` — see [Enums](#enums--allowed-values) |
| `powerType` | String | `"solar"` or `"mains"` — `"alternator"` is **not allowed** for static |

**Optional fields**

| Field | Type | Notes |
|-------|------|-------|
| `date` | ISO 8601 string | When the deployment took place; defaults to current date/time if omitted |
| `isPrimaryInLocation` | Boolean | Whether this is the primary device at the site |
| `user_id` | ObjectId | ID of the user performing the deployment |
| `firstName`, `lastName`, `userName`, `email` | String | Identity of the person performing deployment |
| `host_id` | ObjectId | Host/owner entity for the device |
| `network` | String | Defaults to the device's existing network |

**What happens server-side**

1. Validates the device exists and is not already deployed
2. Validates the `site_id` exists in the Sites collection
3. Retrieves site coordinates and calculates an approximate device position using bearing/distance offsets
4. Creates an `Activity` record with `activityType: "deployment"` and `deployment_type: "static"`
5. Updates the Device document — sets `site_id`, clears any `grid_id`, sets `mobility: false`
6. Triggers a Kafka notification on the deploy topic

**Successful Response (`200`)**

```json
{
  "success": true,
  "message": "successfully deployed the device on AirQo platform",
  "updatedDevice": { "...device fields..." },
  "createdActivity": { "...activity fields..." }
}
```

---

### Mobile Deployment

A mobile deployment attaches a device to a **grid** (a geographic area) rather than a fixed site. Mobile devices are mounted on vehicles and powered by the vehicle's alternator.

**Endpoint**

```http
POST /api/v2/devices/activities/deploy/mobile?tenant=airqo&deviceName={deviceName}
```

**When to call this:** The user is deploying a sensor that will move around (e.g., on a bus or boda boda). The form should show a grid selector instead of a site selector, and `mountType`/`powerType` should be hardcoded or auto-set in the UI.

**Request Body**

```json
{
  "grid_id": "507f1f77bcf86cd799439014",
  "height": 1.5,
  "mountType": "vehicle",
  "powerType": "alternator",
  "date": "2025-05-12T10:30:00.000Z",
  "mobility_metadata": {
    "route_id": "route_kampala_05",
    "coverage_area": "central_kampala",
    "operational_hours": "06:00-18:00",
    "movement_pattern": "fixed-route"
  },
  "user_id": "507f1f77bcf86cd799439012",
  "firstName": "Jane",
  "lastName": "Smith",
  "userName": "jsmith",
  "email": "jsmith@example.com",
  "network": "airqo"
}
```

**Required fields — mobile only**

| Field | Type | Notes |
|-------|------|-------|
| `grid_id` | ObjectId | The grid (geographic area) the device operates within |
| `height` | Number | Mounting height on the vehicle, metres (>0 and <100, exclusive) |
| `mountType` | String | **Must be `"vehicle"`** — the API rejects any other value |
| `powerType` | String | **Must be `"alternator"`** — the API rejects `"solar"` or `"mains"` |

**Mobile-specific optional fields**

| Field | Type | Notes |
|-------|------|-------|
| `date` | ISO 8601 string | When the deployment took place; defaults to current date/time if omitted |
| `mobility_metadata` | Object | Structured info about the device's movement pattern |
| `mobility_metadata.route_id` | String | Identifier for the route the vehicle follows |
| `mobility_metadata.coverage_area` | String | Human-readable description of the area covered |
| `mobility_metadata.operational_hours` | String | Operating hours (e.g., `"06:00-18:00"`) |
| `mobility_metadata.movement_pattern` | String | Nature of movement (e.g., `"fixed-route"`, `"random"`) |

**Do NOT send for mobile deployments**

- `site_id` — must be absent; providing it will cause a validation error
- `latitude` / `longitude` — the API derives position from the grid's center coordinates
- `isPrimaryInLocation` — not applicable for mobile devices; omit the key entirely rather than sending it as an empty value

**What happens server-side**

1. Validates the device exists and is not already deployed
2. Validates `grid_id` exists in the Grids collection
3. Retrieves the grid's center coordinates (from `grid.centers[0]` or computed from the grid shape)
4. Creates an `Activity` record with `activityType: "deployment"` and `deployment_type: "mobile"`
5. Updates the Device document — sets `grid_id`, clears `site_id`, sets `mobility: true`, stores `mobility_metadata`
6. Triggers a Kafka notification on the deploy topic

**Successful Response (`200`)**

```json
{
  "success": true,
  "message": "successfully deployed the device on AirQo platform",
  "updatedDevice": { "...device fields..." },
  "createdActivity": { "...activity fields..." }
}
```

---

### Side-by-side Comparison: Static vs Mobile

| Aspect | Static | Mobile |
|--------|--------|--------|
| Location reference | `site_id` (required) | `grid_id` (required) |
| `mountType` | `pole`, `wall`, `rooftop`, `faceboard`, or `suspended` | **`vehicle` only** |
| `powerType` | `solar` or `mains` | **`alternator` only** |
| `isPrimaryInLocation` | Supported | Not applicable |
| `mobility_metadata` | Not applicable | Supported |
| Device `mobility` flag | Set to `false` | Set to `true` |
| Coordinates source | Derived from site geo | Derived from grid center |
| Previous history field | `previous_sites[]` | `previous_grids[]` |

---

### Batch Deployment

Deploy multiple devices in a single request. The batch can contain a mix of static and mobile items.

**Endpoint**

```http
POST /api/v2/devices/activities/deploy/batch?tenant=airqo
```

**Request Body**

An array where each item includes the `deviceName` and all fields for that device's deployment type:

```json
[
  {
    "deviceName": "aq_g5_19",
    "deployment_type": "static",
    "site_name": "Kampala Central Market",
    "latitude": 0.3476,
    "longitude": 32.5825,
    "height": 3.5,
    "mountType": "pole",
    "powerType": "solar",
    "network": "airqo"
  },
  {
    "deviceName": "aq_mob_03",
    "deployment_type": "mobile",
    "grid_id": "507f1f77bcf86cd799439014",
    "height": 1.5,
    "mountType": "vehicle",
    "powerType": "alternator",
    "mobility_metadata": {
      "route_id": "route_kampala_05",
      "coverage_area": "central_kampala"
    }
  }
]
```

**Required fields per item — static batch**

| Field | Type | Notes |
|-------|------|-------|
| `deviceName` | String | Device name |
| `deployment_type` | String | `"static"` |
| `site_name` | String | Used to create or match a site |
| `latitude` | Number | Finite number, must be provided |
| `longitude` | Number | Finite number, must be provided |
| `height` | Number | >0 and <100 (exclusive) |
| `mountType` | String | Not `"vehicle"` |
| `powerType` | String | `"solar"` or `"mains"` |

**Required fields per item — mobile batch**

| Field | Type | Notes |
|-------|------|-------|
| `deviceName` | String | Device name |
| `deployment_type` | String | `"mobile"` |
| `grid_id` | ObjectId | Must already exist |
| `height` | Number | >0 and <100 (exclusive) |
| `mountType` | String | Must be `"vehicle"` |
| `powerType` | String | Must be `"alternator"` |

**Batch processing behaviour**

The server processes batches in multiple phases:
1. Validates all items for type-specific consistency
2. Checks device existence and current deployment status for all items
3. For static items: creates any new sites needed (with race-condition protection via pre-reserved sequential names)
4. For mobile items: validates that all `grid_id`s already exist (grids cannot be created on the fly)
5. Bulk-creates Activity records and updates Device documents
6. Sends Kafka notifications per device

**Successful Response (`200`)**

```json
{
  "success": true,
  "message": "batch deployment completed",
  "data": {
    "successful": [ { "deviceName": "aq_g5_19", "...": "..." } ],
    "failed": []
  }
}
```

---

### Deployment Statistics

Fetch a summary of how many devices are deployed, broken down by type.

**Endpoint**

```http
GET /api/v2/devices/activities/deploy/stats?tenant=airqo
```

**Response**

```json
{
  "success": true,
  "message": "Deployment statistics retrieved successfully",
  "data": {
    "deployments": {
      "total": 150,
      "static": 100,
      "mobile": 50,
      "static_percentage": "66.67",
      "mobile_percentage": "33.33"
    },
    "active_devices": {
      "total": 145,
      "static": 98,
      "mobile": 47,
      "static_percentage": "67.59",
      "mobile_percentage": "32.41"
    },
    "all_devices": {
      "total": 200,
      "active_rate": "72.50"
    },
    "generated_at": "2025-05-12T10:30:00.000Z"
  }
}
```

**Devices by Deployment Type**

```http
GET /api/v2/devices/activities/devices/by-type/{deploymentType}?tenant=airqo&limit=20&skip=0
```

Replace `{deploymentType}` with `static` or `mobile`.

---

## Recall

Recalling a device removes it from its current location and marks it as inactive. This applies to both static and mobile devices — you do not need to specify the deployment type.

**Endpoint**

```http
POST /api/v2/devices/activities/recall?tenant=airqo&deviceName={deviceName}
```

**Request Body**

```json
{
  "recallType": "damaged",
  "date": "2025-05-12T10:30:00.000Z",
  "user_id": "507f1f77bcf86cd799439012",
  "firstName": "John",
  "lastName": "Doe",
  "userName": "jdoe",
  "email": "jdoe@example.com",
  "host_id": "507f1f77bcf86cd799439013",
  "network": "airqo"
}
```

**Required fields**

| Field | Type | Notes |
|-------|------|-------|
| `recallType` | String | Must be a valid recall type (see [Enums](#enums--allowed-values)) |

**Optional fields**

| Field | Type | Notes |
|-------|------|-------|
| `date` | ISO 8601 string | When the recall occurred; defaults to current date/time if omitted |
| `user_id` | ObjectId | Who performed the recall |
| `firstName`, `lastName`, `userName`, `email` | String | Identity of person performing recall |
| `host_id` | ObjectId | Host/owner entity |
| `network` | String | Defaults to device's existing network |

> **Note:** `description` is not accepted on recall requests — the server always sets it to `"device recalled"` internally.

**What happens server-side**

- Sets `isActive: false` and `status: "recalled"` on the Device
- Sets `recall_date` to the provided `date`
- **Clears** all location fields: `site_id`, `grid_id`, `latitude`, `longitude`, `deployment_type`, `mountType`, `powerType`, `height`, `isPrimaryInLocation`, `deployment_date`, `mobility`
- **Archives** the previous `site_id` into `device.previous_sites[]` (static) or `grid_id` into `device.previous_grids[]` (mobile)
- Marks associated device readings as inactive
- Creates an Activity record with `activityType: "recallment"`
- Triggers a Kafka notification on the recall topic

**Successful Response (`200`)**

```json
{
  "success": true,
  "message": "successfully recalled the device",
  "updatedDevice": { "...device fields..." },
  "createdActivity": { "...activity fields..." }
}
```

> **UI note:** After a successful recall, the device's status will be `"recalled"` and it will no longer have a `site_id` or `grid_id`. Any deployment form for this device should be available again.

---

## Maintenance

Record a maintenance event for a currently-deployed device. Maintenance does **not** change the device's location or deployment state — it only logs the event and updates the next-maintenance date.

**Endpoint**

```http
POST /api/v2/devices/activities/maintain?tenant=airqo&deviceName={deviceName}
```

**Request Body**

```json
{
  "maintenanceType": "battery_replacement",
  "date": "2025-05-12T10:30:00.000Z",
  "description": "Replaced battery and cleaned solar panel",
  "tags": ["battery", "cleaning"],
  "user_id": "507f1f77bcf86cd799439012",
  "firstName": "John",
  "lastName": "Doe",
  "userName": "jdoe",
  "email": "jdoe@example.com",
  "host_id": "507f1f77bcf86cd799439013",
  "network": "airqo",
  "site_id": "507f1f77bcf86cd799439011"
}
```

**Required fields**

| Field | Type | Notes |
|-------|------|-------|
| `maintenanceType` | String | Must be a valid maintenance type (see [Enums](#enums--allowed-values)) |

**Optional fields**

| Field | Type | Notes |
|-------|------|-------|
| `date` | ISO 8601 string | When the maintenance occurred; defaults to current date/time if omitted |
| `description` | String | Free-text description of work done |
| `tags` | String[] | Categorisation tags (e.g., `["battery", "sensor"]`) |
| `user_id` | ObjectId | Who performed the maintenance |
| `firstName`, `lastName`, `userName`, `email` | String | Identity of person |
| `host_id` | ObjectId | Host/owner entity |
| `site_id` | ObjectId | Optional override if different from device's current site |
| `network` | String | Defaults to device's existing network |

**Prerequisite:** The device must currently have `status: "deployed"`. Maintenance cannot be recorded on a recalled or undeployed device.

**What happens server-side**

- Creates an Activity record with `activityType: "maintenance"`
- Updates `device.nextMaintenance` (calculated as approximately 3 months from the maintenance date)
- Updates `device.maintenance_date` to the provided `date`
- Does **not** change `site_id`, `grid_id`, `isActive`, or any other deployment fields
- Triggers a Kafka notification on the maintain topic

**Recalculate Next Maintenance**

```http
POST /api/v2/devices/activities/recalculate-next-maintenance?tenant=airqo
```

Used to bulk-recalculate the `nextMaintenance` date across devices. This is typically an admin operation, not needed in normal deployment UI flows.

**Successful Response (`200`)**

```json
{
  "success": true,
  "message": "successfully maintained the device",
  "updatedDevice": { "...device fields..." },
  "createdActivity": { "...activity fields..." }
}
```

---

## Listing & Querying Activities

**List all activities (paginated)**

```http
GET /api/v2/devices/activities?tenant=airqo&limit=30&skip=0&sortBy=createdAt&order=desc
```

| Query param | Type | Default | Notes |
|-------------|------|---------|-------|
| `limit` | Number | 30 (max 80) | Max records per page |
| `skip` | Number | 0 | Offset for pagination |
| `sortBy` | String | `createdAt` | Field to sort by |
| `order` | String | `desc` | `asc` or `desc` |

You can also filter by device, site, or activity type by passing additional query parameters (e.g., `activity_type=deployment`, `maintenance_type=battery_replacement`, `recall_type=damaged`, `device=aq_g5_19`).

**Update an activity**

```http
PUT /api/v2/devices/activities?tenant=airqo&id={activityId}
```

The filter (e.g., `id`, `device`, `activity_type`) goes in the **query string**. The request body contains only the fields to update.

**Delete an activity**

```http
DELETE /api/v2/devices/activities?tenant=airqo&id={activityId}
```

The filter goes in the **query string** — no request body is needed.

**Refresh caches**

```http
POST /api/v2/devices/activities/refresh-caches?tenant=airqo
```

Body:
```json
{
  "device_names": ["aq_g5_19"],
  "site_ids": ["507f1f77bcf86cd799439011"],
  "refresh_all": false
}
```

---

## Field Reference

### Shared Fields (All Activities)

These identity and network fields are accepted by every endpoint.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `date` | ISO 8601 string | No | When the activity occurred; defaults to current date/time |
| `user_id` | ObjectId | No | User performing the action |
| `firstName` | String | No | Person's first name |
| `lastName` | String | No | Person's last name |
| `userName` | String | No | Username |
| `email` | String | No | Email (validated format) |
| `host_id` | ObjectId | No | Host/owner entity |
| `network` | String | No | Defaults to device's network |

> **`description` and `tags`:** These fields are only accepted by the **maintenance** endpoint. For deploy and recall, the server sets `description` to a fixed internal string (`"device deployed"` / `"device recalled"`) — any client-provided value is ignored. `tags` and `activity_codes` are similarly not read from the request body for deploy or recall.

### Deployment-Only Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `site_id` | ObjectId | Yes (static) | Fixed site reference |
| `grid_id` | ObjectId | Yes (mobile) | Grid area reference |
| `height` | Number | Yes | Metres above ground (>0 and <100, exclusive) |
| `mountType` | String | Yes | How device is mounted |
| `powerType` | String | Yes | Device's power source |
| `isPrimaryInLocation` | Boolean | No | Static only — is this the main device at the site? |
| `deployment_type` | String | No (inferred) | `"static"` or `"mobile"` |

### Mobile-Only Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `mobility_metadata` | Object | No | Movement details |
| `mobility_metadata.route_id` | String | No | Route identifier |
| `mobility_metadata.coverage_area` | String | No | Area description |
| `mobility_metadata.operational_hours` | String | No | e.g., `"06:00-18:00"` |
| `mobility_metadata.movement_pattern` | String | No | e.g., `"fixed-route"` |

### Recall-Only Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `recallType` | String | Yes | Reason for recall |

### Maintenance-Only Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `maintenanceType` | String | Yes | Type of maintenance performed |
| `site_id` | ObjectId | No | Override for site reference |

---

## Validation Rules & Error Handling

### Rules Enforced on All Deployment Requests

| Rule | Error if violated |
|------|-------------------|
| Device must exist | `400 Bad Request` |
| Device must not already be deployed | `409 Conflict` |
| `date` (if provided) must be valid ISO 8601 with T separator | `400 Bad Request` |
| `date` must not be more than 1 month in the past | `400 Bad Request` |
| `date` must not be in the future (5-minute buffer allowed) | `400 Bad Request` |
| IDs must be 24-char hex ObjectIds | `400 Bad Request` |
| `height` must be strictly greater than 0 and strictly less than 100 | `400 Bad Request` |

### Static-Specific Rules

| Rule | Error if violated |
|------|-------------------|
| `site_id` must be present | `400 Bad Request` |
| `site_id` must exist in Sites collection | `400 Bad Request` |
| `grid_id` must be absent | `400 Bad Request` |
| `mountType` cannot be `"vehicle"` | `400 Bad Request` |
| `powerType` cannot be `"alternator"` | `400 Bad Request` |

### Mobile-Specific Rules

| Rule | Error if violated |
|------|-------------------|
| `grid_id` must be present | `400 Bad Request` |
| `grid_id` must exist in Grids collection | `400 Bad Request` |
| `site_id` must be absent | `400 Bad Request` |
| `mountType` must be `"vehicle"` | `400 Bad Request` |
| `powerType` must be `"alternator"` | `400 Bad Request` |

### Error Response Shape

```json
{
  "success": false,
  "message": "bad request errors",
  "errors": {
    "message": "mountType must be 'vehicle' for mobile deployments"
  }
}
```

### Lifecycle Field Protection

The following Device fields are **protected** and can only be changed through dedicated activity endpoints — attempting to update them directly via the Device update API will silently ignore those fields:

```text
mobility, deployment_type, site_id, grid_id,
status, deployment_date, recall_date, isActive
```

---

## State Transitions

A device moves through these states, each requiring a specific API call:

```text
[not deployed / new]
        │
        │  POST /deploy or /deploy/static or /deploy/mobile
        ▼
   [deployed]  ──────┐
        │             │  POST /maintain (stays "deployed")
        │             └──────────────────────────────────┐
        │                                                 │
        │  POST /recall                                   │
        ▼                                             [deployed]
    [recalled]
        │
        │  POST /deploy (again, starts new cycle)
        ▼
   [deployed]
```

**Device status values:** `"ready"`, `"deployed"`, `"recalled"`, `"undeployed"`, `"decommissioned"`, `"assembly"`, `"testing"`, `"not deployed"`

After a successful **deployment**: `status` → `"deployed"`, `isActive` → `true`

After a successful **recall**: `status` → `"recalled"`, `isActive` → `false`

After **maintenance**: `status` unchanged (stays `"deployed"`)

---

## Enums & Allowed Values

### `deploymentType`
```text
"static" | "mobile"
```

### `mountType`
```text
"pole" | "wall" | "faceboard" | "rooftop" | "suspended" | "vehicle"
```

> For **static** deployments, use any value except `"vehicle"`.
> For **mobile** deployments, use only `"vehicle"`.

### `powerType`
```text
"solar" | "mains" | "alternator"
```

> For **static** deployments, use `"solar"` or `"mains"`.
> For **mobile** deployments, use only `"alternator"`.

### `activityType`
Internal — set automatically by the server. Values: `"deployment"`, `"recallment"`, `"maintenance"`.

### `recallType`
Configured per environment. Common values include: `"user_requested"`, `"damaged"`, `"end_of_life"`, `"faulty"`. Fetch the current list from environment config or ask the backend team.

### `maintenanceType`
Configured per environment. Common values include: `"battery_replacement"`, `"sensor_cleaning"`, `"calibration"`, `"firmware_update"`. Fetch the current list from environment config or ask the backend team.

### `status` (Device)
```text
"recalled" | "ready" | "deployed" | "undeployed" |
"decommissioned" | "assembly" | "testing" | "not deployed"
```

---

*This document was generated from the device-registry source at `src/device-registry/utils/activity.util.js`, `src/device-registry/validators/activities.validators.js`, `src/device-registry/models/Activity.js`, `src/device-registry/models/Device.js`, and `src/device-registry/routes/v2/activities.routes.js`.*
