# Device Onboarding, Claiming, and Import API Guide

**Audience:** Frontend engineers consuming the AirQo Device Registry API  
**Base URL:** `/api/v2/devices`  
**Auth:** All endpoints require a valid JWT in the `Authorization: JWT <token>` header  
**Tenant:** Recommended: include `?tenant=airqo` on every request; if omitted, the server defaults to `airqo`

---

## Table of Contents

1. [Core Concepts — Read This First](#1-core-concepts--read-this-first)
2. [Device Lifecycle at a Glance](#2-device-lifecycle-at-a-glance)
3. [Shipping — Preparing Devices for Distribution](#3-shipping--preparing-devices-for-distribution)
4. [Claiming — Assigning Physical Ownership](#4-claiming--assigning-physical-ownership)
5. [Importing External Devices](#5-importing-external-devices)
6. [Cohorts and Group (Organisation) Assignment](#6-cohorts-and-group-organisation-assignment)
7. [Organisation Context and Device Visibility](#7-organisation-context-and-device-visibility)
8. [Common Workflows End-to-End](#8-common-workflows-end-to-end)
9. [Frequently Asked Questions](#9-frequently-asked-questions)
10. [Quick Reference — All Endpoints](#10-quick-reference--all-endpoints)

---

## 1. Core Concepts — Read This First

Before making any API calls it is important to understand the four entities that the device onboarding system is built around. Getting these distinctions right will prevent a lot of confusion.

### Device

A device is a physical air-quality sensor registered in the system. Every device has a **`name`** (a system-generated slug, e.g. `cap_ple_kzn_za`), a **`long_name`** (the human-readable label, e.g. `CAP / PLE, KZN, ZA.`), and a **`network`** that identifies its manufacturer or data source (e.g. `airqo`, `airgradient`, `iqair`).

### Network (Sensor Manufacturer)

A network is the sensor manufacturer or data-source provider that made the device. Every device belongs to exactly one network. Devices made by AirQo have `network = "airqo"`; devices from third-party sources have their manufacturer's network key (e.g. `"airgradient"`). The list of registered networks is fetched from:

```http
GET /api/v2/devices/networks
```

### Cohort

A cohort is a **named collection of devices** used to group them for data access and display purposes. Cohorts are the primary mechanism by which devices are made visible to a group or organisation. A single device can belong to multiple cohorts at the same time. There are two special cohort types you will encounter frequently:

| Cohort type | Name pattern | Purpose |
|---|---|---|
| **Default / global** | `airqo` (system constant) | Every new device is automatically added here |
| **Personal** | `coh_user_<user_id>` | Auto-created when a user imports or claims a device without specifying a cohort |
| **Group cohort** | Custom, set by admins | Scopes a fleet of devices to a specific organisation |

### Group / Organisation

An organisation (also called a group) is an entity in the auth-service that users can belong to. Within the device registry, a group is referenced by its MongoDB ObjectId and corresponds to one or more cohorts that hold its devices. Being a member of an organisation in the auth-service does **not** automatically give you access to that organisation's devices — the devices must be explicitly assigned to the organisation's cohort. This assignment is what links an org to a device fleet.

---

## 2. Device Lifecycle at a Glance

```text
┌─────────────────────────────────────────────────────────────┐
│  SHIPPING PREP          CLAIMING              DEPLOYMENT     │
│                                                             │
│  [AirQo adds       →  [User scans QR    →  [Device is      │
│   device to           or enters token]      deployed to     │
│   system with                               a physical      │
│   claim_token]        claim_status:         site]           │
│                        "claimed"                            │
│  claim_status:                              claim_status:   │
│   "unclaimed"                                "deployed"     │
└─────────────────────────────────────────────────────────────┘
```

A device moves through three `claim_status` values in its life:

| Status | Meaning |
|---|---|
| `unclaimed` | Registered in the system; has a claim token; no owner yet |
| `claimed` | A user has claimed it as their own; `owner_id` is set |
| `deployed` | The device is actively installed and reporting at a physical site |

**External / imported devices** (non-AirQo) skip the shipping and claiming steps entirely. They go straight into the system as owned devices at the moment of import.

---

## 3. Shipping — Preparing Devices for Distribution

Shipping preparation is the step where AirQo registers physical devices in the system and generates the **claim tokens** that end-users will later use to take ownership. This is an internal AirQo workflow, but the shipping status and label endpoints may be consumed by frontend tools for tracking and printing.

### 3.1 Prepare a Single Device for Shipping

Registers one device and generates its claim token.

```http
POST /api/v2/devices/prepare-for-shipping
```

**Request body:**

```json
{
  "device_name": "aq_device_001",
  "token_type": "readable"
}
```

| Field | Required | Values | Notes |
|---|---|---|---|
| `device_name` | Yes | String | Must already exist in the system |
| `token_type` | Yes | `"hex"` or `"readable"` | `readable` produces a human-friendly token (easier to type); `hex` is a compact hex string |

**Response (200):**

```json
{
  "success": true,
  "message": "Device prepared for shipping",
  "data": {
    "device_name": "aq_device_001",
    "claim_token": "BLUE-RIVER-42",
    "claim_token_expires_at": "2026-06-12T00:00:00.000Z",
    "claim_status": "unclaimed"
  }
}
```

---

### 3.2 Prepare Multiple Devices for Shipping (up to 50)

```http
POST /api/v2/devices/prepare-bulk-for-shipping
```

**Request body:**

```json
{
  "device_names": ["aq_device_001", "aq_device_002", "aq_device_003"],
  "token_type": "readable"
}
```

| Field | Required | Notes |
|---|---|---|
| `device_names` | Yes | Array of 1–50 device names |
| `token_type` | Yes | `"hex"` or `"readable"` |

---

### 3.3 Create a Shipping Batch (Prepare + Group in One Call)

A shipping batch lets you prepare a set of devices and group them under a named batch for tracking and label printing.

```http
POST /api/v2/devices/shipping-batches
```

**Request body:**

```json
{
  "batch_name": "Uganda Schools Q2 2026",
  "device_names": ["aq_device_001", "aq_device_002"],
  "token_type": "readable"
}
```

| Field | Required | Notes |
|---|---|---|
| `batch_name` | Yes | Human-readable label for this shipment |
| `device_names` | Yes | Array of device names to include |
| `token_type` | Yes | `"hex"` or `"readable"` |

**Response (200):**

```json
{
  "success": true,
  "message": "Shipping batch created",
  "data": {
    "batch_id": "64a1f2e3b4c5d6e7f8a9b0c1",
    "batch_name": "Uganda Schools Q2 2026",
    "devices": [
      { "device_name": "aq_device_001", "claim_token": "BLUE-RIVER-42" },
      { "device_name": "aq_device_002", "claim_token": "GOLD-STORM-17" }
    ]
  }
}
```

---

### 3.4 Check Shipping Preparation Status

```http
GET /api/v2/devices/shipping-status?device_names=aq_device_001,aq_device_002
```

Returns preparation status for the specified devices.

---

### 3.5 Generate Shipping Labels for Printing

```http
POST /api/v2/devices/generate-shipping-labels
```

**Request body:**

```json
{
  "device_names": ["aq_device_001", "aq_device_002"]
}
```

Returns label data (device name, claim token, QR code data) ready for a print layout.

---

### 3.6 List All Shipping Batches

```http
GET /api/v2/devices/shipping-batches
```

Returns a paginated list of all shipping batches. Use `?limit=25&skip=0` for pagination.

---

### 3.7 Get Details of a Specific Shipping Batch

```http
GET /api/v2/devices/shipping-batches/:id
```

Returns full details of one batch including all devices and their claim tokens.

---

### 3.8 Remove Devices from a Batch

```http
DELETE /api/v2/devices/shipping-batches/:id/devices
```

**Request body:**

```json
{
  "device_names": ["aq_device_002"]
}
```

---

### 3.9 Generate a Claim QR Code for a Device

Produces a QR code image or data URI that a user can scan to claim the device without typing the token manually.

```http
GET /api/v2/devices/qr-code/:deviceName
```

**Example:**

```http
GET /api/v2/devices/qr-code/aq_device_001
```

---

## 4. Claiming — Assigning Physical Ownership

Claiming is the act of a user establishing **personal ownership** of a physical device that is currently `unclaimed`. Once claimed, the device's `owner_id` is set to that user's ID and its `claim_status` becomes `"claimed"`. Only the device owner (or an admin) can later transfer or release the device.

> **Key distinction from cohort assignment:** Claiming is about *who physically owns this device*. Cohort assignment is about *which groups or organisations can see and use this device's data*. A user can claim a device (own it) without it being in any group cohort, and a device can be in a group cohort without having a personal owner.

### 4.1 Claim a Single Device

```http
POST /api/v2/devices/claim
```

**Request body:**

```json
{
  "device_name": "aq_device_001",
  "claim_token": "BLUE-RIVER-42",
  "user_id": "64a1f2e3b4c5d6e7f8a9b0c1",
  "cohort_id": "64a1f2e3b4c5d6e7f8a9b0c2"
}
```

| Field | Required | Notes |
|---|---|---|
| `device_name` | Yes | The system name of the device to claim |
| `claim_token` | No | Required if the device was prepared with a token; some devices skip this |
| `user_id` | Yes | MongoDB ObjectId of the claiming user |
| `cohort_id` | No | If provided, adds the device to this cohort at the same time as claiming. Useful when claiming on behalf of an organisation. |

**Response (200):**

```json
{
  "success": true,
  "message": "Device claimed successfully",
  "data": {
    "device_name": "aq_device_001",
    "claim_status": "claimed",
    "owner_id": "64a1f2e3b4c5d6e7f8a9b0c1",
    "claimed_at": "2026-05-12T10:30:00.000Z"
  }
}
```

**What happens automatically when a device is claimed:**

- `claim_status` changes from `"unclaimed"` to `"claimed"`
- `owner_id` is set to the claiming user's ID
- `claimed_at` timestamp is recorded
- If the user has a personal cohort (`coh_user_<user_id>`), the device is added to it
- If `cohort_id` was supplied, the device is added to that cohort as well

---

### 4.2 Bulk Claim Multiple Devices

Claim up to 30 devices in a single request. Useful for organisation admins taking ownership of a whole shipment at once.

```http
POST /api/v2/devices/claim/bulk
```

**Request body:**

```json
{
  "user_id": "64a1f2e3b4c5d6e7f8a9b0c1",
  "cohort_id": "64a1f2e3b4c5d6e7f8a9b0c2",
  "devices": [
    { "device_name": "aq_device_001", "claim_token": "BLUE-RIVER-42" },
    { "device_name": "aq_device_002", "claim_token": "GOLD-STORM-17" },
    { "device_name": "aq_device_003" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `user_id` | Yes | The user claiming all devices |
| `devices` | Yes | Array, each item must have `device_name`; `claim_token` is required only if the device was prepared with one |
| `cohort_id` | No | All claimed devices will be added to this cohort |

**Response (200):**

```json
{
  "success": true,
  "message": "Bulk claim completed",
  "data": {
    "successful_claims": [
      { "device_name": "aq_device_001", "claim_status": "claimed" },
      { "device_name": "aq_device_002", "claim_status": "claimed" }
    ],
    "failed_claims": [
      { "device_name": "aq_device_003", "error": "Invalid claim token" }
    ]
  }
}
```

---

### 4.3 Transfer Device Ownership Between Users

Moves a device from one user to another. The device's `owner_id` is updated and it is removed from the original user's personal cohort and added to the new user's personal cohort.

```http
POST /api/v2/devices/transfer
```

**Request body:**

```json
{
  "device_name": "aq_device_001",
  "from_user_id": "64a1f2e3b4c5d6e7f8a9b0c1",
  "to_user_id": "64a1f2e3b4c5d6e7f8a9b0c9",
  "include_deployment_history": false
}
```

| Field | Required | Notes |
|---|---|---|
| `device_name` | Yes | |
| `from_user_id` | Yes | Current owner |
| `to_user_id` | Yes | New owner |
| `include_deployment_history` | No | `true` transfers the full deployment history along with ownership |

---

### 4.4 List a User's Claimed Devices

Returns all devices where `owner_id` matches the specified user. This is the "My Devices" feed.

```http
GET /api/v2/devices/my-devices?user_id=64a1f2e3b4c5d6e7f8a9b0c1
```

**Query parameters:**

| Parameter | Required | Notes |
|---|---|---|
| `user_id` | Yes | MongoDB ObjectId |
| `organization_id` | No | When set, filters to only devices the user owns within that organisation's cohort |
| `limit` | No | Defaults to 1000 |
| `skip` | No | Defaults to 0 |

---

### 4.5 List a User's Sites (My Sites)

Returns all deployment sites associated with a user. A site is a physical location where one or more devices are installed. This is the "My Sites" feed — the site-level counterpart to "My Devices".

```http
GET /api/v2/devices/sites/my-sites?user_id=64a1f2e3b4c5d6e7f8a9b0c1
```

**Query parameters:**

| Parameter | Required | Notes |
|---|---|---|
| `user_id` | No | MongoDB ObjectId. When provided, scopes results to sites associated with that user's devices |
| `limit` | No | Defaults to 1000 |
| `skip` | No | Defaults to 0 |

**Response (200):**

```json
{
  "success": true,
  "message": "successfully retrieved the sites",
  "sites": [
    {
      "_id": "64a1f2e3b4c5d6e7f8a9b200",
      "name": "makerere_university",
      "description": "Makerere University main campus",
      "latitude": 0.33354,
      "longitude": 32.56861,
      "country": "Uganda",
      "city": "Kampala"
    }
  ]
}
```

> **Relationship between Sites and Devices:** A site is a deployment location; a device is the physical sensor installed at that location. When a device is deployed, it is linked to a site. Fetching a user's sites gives an overview of all physical locations where their devices are active. If you need the devices at a specific site, filter the device list by `site_id`.

---

### 4.6 Individual Claiming vs Organisation Claiming

| Scenario | What to do |
|---|---|
| A private user claims a device for personal use | Call `POST /claim` with only `user_id`. Device lands in their personal cohort. No organisation visibility. |
| An admin claims devices on behalf of an organisation | Call `POST /claim/bulk` with `user_id` (the admin) **and** `cohort_id` (the organisation's cohort). Devices become part of the org fleet AND owned by the admin. |
| An organisation wants devices visible to all members but not personally owned | Skip claiming entirely. Import or register the device and assign it directly to the org's cohort via `POST /cohorts/:cohort_id/assign-devices`. |

---

## 5. Importing External Devices

External device import is for onboarding sensors manufactured by third parties (AirGradient, IQAir, etc.) that are not part of the standard AirQo shipping and claiming workflow. These devices are registered directly into the system with ownership set immediately at creation time — there is no claim token or shipping preparation step.

> External devices are identified by having a `network` value other than `"airqo"` (e.g. `"airgradient"`, `"iqair"`). They must have a `serial_number` as their external identifier.

### 5.1 Import a Single External Device

```http
POST /api/v2/devices/soft
```

**Request body:**

```json
{
  "long_name": "CAP / PLE, KZN, ZA.",
  "network": "airgradient",
  "serial_number": "55524",
  "latitude": -29.43461,
  "longitude": 31.252426,
  "category": "lowcost",
  "description": "O-1PP | Communities Against Pollution (CAP)",
  "api_code": "https://api.airgradient.com/public/api/v1/world/locations/55524/measures/current",
  "user_id": "64a1f2e3b4c5d6e7f8a9b0c1",
  "cohort_id": "64a1f2e3b4c5d6e7f8a9b0c2",
  "tags": ["urban", "residential"]
}
```

| Field | Required | Notes |
|---|---|---|
| `long_name` | Yes | Human-readable display name |
| `network` | Yes | Must match a registered network key (see `GET /networks`). Cannot be `"airqo"`. |
| `serial_number` | Yes | The device's external identifier (e.g. AirGradient `locationId`) |
| `user_id` | No | If provided, sets the device owner and auto-creates a personal cohort |
| `cohort_id` | No | If provided, adds the device to this cohort at creation time |
| `latitude` / `longitude` | No | Decimal degrees |
| `api_code` | No | The full URL the system uses to fetch live readings. If omitted, the system builds it automatically from the network's URL template and the `serial_number`. |
| `category` | No | `"lowcost"` (default) / `"bam"` / `"gas"` |
| `description` | No | Free text |
| `device_number` | No | Integer |
| `tags` | No | Array of strings |

**Response (200):**

```json
{
  "success": true,
  "message": "successfully created the device",
  "created_device": {
    "_id": "64a1f2e3b4c5d6e7f8a9b0ff",
    "name": "cap_ple_kzn_za",
    "long_name": "CAP / PLE, KZN, ZA.",
    "network": "airgradient",
    "serial_number": "55524",
    "claim_status": "claimed",
    "owner_id": "64a1f2e3b4c5d6e7f8a9b0c1"
  }
}
```

---

### 5.2 Bulk Import — JSON Array

Imports multiple external devices in a single call. Returns a `207 Multi-Status` response so you can see which rows succeeded and which failed without retrying the whole batch.

```http
POST /api/v2/devices/soft/bulk
Content-Type: application/json
```

**Request body:**

```json
{
  "user_id": "64a1f2e3b4c5d6e7f8a9b0c1",
  "cohort_id": "64a1f2e3b4c5d6e7f8a9b0c2",
  "network_override": "airgradient",
  "devices": [
    {
      "long_name": "CAP / PLE, KZN, ZA.",
      "serial_number": "55524",
      "latitude": -29.43461,
      "longitude": 31.252426,
      "category": "lowcost",
      "description": "O-1PP | Communities Against Pollution (CAP)"
    },
    {
      "long_name": "Sénégal, Dakar",
      "serial_number": "58550",
      "latitude": 14.74647557,
      "longitude": -17.51044096,
      "category": "lowcost"
    },
    {
      "long_name": "Harbour West, KZN, ZA.",
      "serial_number": "59398",
      "latitude": -28.78704806,
      "longitude": 32.03716134,
      "api_code": "https://api.airgradient.com/public/api/v1/world/locations/59398/measures/current",
      "category": "lowcost",
      "tags": ["urban", "residential"]
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `user_id` | Yes | Sets owner and personal cohort for all created devices |
| `devices` | Yes | Array of 1–500 device objects |
| `network_override` | No | When set, forces this network onto every row — you can then omit `network` from each device object |
| `cohort_id` | No | Adds all devices to this cohort at creation time |
| `devices[].long_name` | Yes | |
| `devices[].serial_number` | Yes | |
| `devices[].network` | Yes* | Required per device unless `network_override` is set at the top level |
| `devices[].latitude` | No | |
| `devices[].longitude` | No | |
| `devices[].api_code` | No | Auto-built if omitted |
| `devices[].category` | No | Defaults to `"lowcost"` |
| `devices[].description` | No | |
| `devices[].device_number` | No | Integer |
| `devices[].tags` | No | Array of strings |

---

### 5.3 Bulk Import — CSV File Upload

Accepts a `.csv` file instead of a JSON body. Ideal for importing from spreadsheets (Excel, Google Sheets).

```http
POST /api/v2/devices/soft/bulk
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File (`.csv`) | Yes | Max 5 MB. File must have a `.csv` extension. |
| `user_id` | Text | Yes | |
| `network_override` | Text | No | Locks all rows to this manufacturer network |
| `cohort_id` | Text | No | MongoDB ObjectId |

**CSV template** (UTF-8, first row is the header):

```csv
long_name,network,serial_number,latitude,longitude,api_code,category,description,device_number,tags
"CAP / PLE, KZN, ZA.",airgradient,55524,-29.43461,31.252426,,lowcost,"O-1PP | CAP",,
"Sénégal, Dakar",airgradient,58550,14.74647557,-17.51044096,,lowcost,,,
"Harbour West, KZN, ZA.",airgradient,59398,-28.78704806,32.03716134,,lowcost,,,"urban|residential"
```

**CSV column reference:**

| Column | Required | Notes |
|---|---|---|
| `long_name` | Yes | Device display name. Alias accepted: `locationName` |
| `network` | Yes* | Can be omitted if `network_override` is passed as a form field |
| `serial_number` | Yes | External device identifier. Alias accepted: `locationId` |
| `latitude` | No | Decimal degrees (e.g. `-29.43461`) |
| `longitude` | No | Decimal degrees (e.g. `31.252426`) |
| `api_code` | No | Full fetch URL; auto-built from network adapter if omitted |
| `category` | No | `lowcost` / `bam` / `gas`. Defaults to `lowcost` |
| `description` | No | Free text |
| `device_number` | No | Integer |
| `tags` | No | Pipe-separated: `urban\|residential` |

> **AirGradient shorthand:** If your spreadsheet uses AirGradient's own column names, the API also accepts `locationName` (→ `long_name`) and `locationId` (→ `serial_number`) without any column renaming. Pass `network_override=airgradient` as a form field alongside the file.

**AirGradient-style CSV (no renaming needed):**

```csv
locationName,locationId,latitude,longitude,model,firmwareVersion
"CAP / PLE, KZN, ZA.",55524,-29.43461,31.252426,O-1PP,
"Sénégal, Dakar",58550,14.74647557,-17.51044096,O-1PP,
"Harbour West, KZN, ZA.",59398,-28.78704806,32.03716134,O-1PST,3.6.2
```

> Note: `model` and `firmwareVersion` are ignored by the API (they are sensor readings metadata, not device registry fields). Include them in your export if you want to keep a reference copy, but they have no effect on the import.

---

### 5.4 Bulk Import Response — 207 Multi-Status

Both JSON and CSV bulk import always return HTTP `207 Multi-Status`. Do not use the HTTP status code alone to determine success — always inspect the `results` array.

```json
{
  "success": true,
  "message": "2 device(s) imported successfully, 1 failed",
  "imported": 2,
  "failed": 1,
  "total": 3,
  "results": [
    {
      "serial_number": "55524",
      "long_name": "CAP / PLE, KZN, ZA.",
      "success": true,
      "created_device": {
        "_id": "64a1f2e3b4c5d6e7f8a9b0ff",
        "name": "cap_ple_kzn_za",
        "network": "airgradient"
      }
    },
    {
      "serial_number": "58550",
      "long_name": "Sénégal, Dakar",
      "success": true,
      "created_device": { "_id": "...", "name": "senegal_dakar" }
    },
    {
      "serial_number": "59398",
      "long_name": "Harbour West, KZN, ZA.",
      "success": false,
      "error": "A device with serial_number 59398 already exists on network airgradient"
    }
  ]
}
```

**Displaying results in the UI:**

- Show a summary banner: `"2 of 3 devices imported. 1 failed."`
- Render the `results` array in a table with a status indicator per row
- For failed rows, show the `error` string so the user knows whether to fix the data or skip
- Allow the user to download a filtered CSV of failed rows for correction and re-upload

---

## 6. Cohorts and Group (Organisation) Assignment

### 6.1 What Is a Cohort?

A cohort is a device collection. Think of it as a playlist — a device can appear in multiple playlists at once, and the same playlist can be shown to different audiences. Cohorts are what controls which devices an organisation or user can see and query measurement data for.

Cohorts are **separate from claiming**. Claiming is about physical ownership (who is responsible for this hardware). Cohort membership is about **data visibility and organisational scope** (which teams or apps can access this device's readings).

### 6.2 Assigning Devices to a Cohort

#### Assign a single device

```http
PUT /api/v2/devices/cohorts/:cohort_id/assign-device/:device_id
```

| Parameter | Notes |
|---|---|
| `cohort_id` | MongoDB ObjectId of the target cohort |
| `device_id` | MongoDB ObjectId of the device |

No request body required.

---

#### Assign multiple devices at once

```http
POST /api/v2/devices/cohorts/:cohort_id/assign-devices
```

**Request body:**

```json
{
  "device_ids": [
    "64a1f2e3b4c5d6e7f8a9b0ff",
    "64a1f2e3b4c5d6e7f8a9b100",
    "64a1f2e3b4c5d6e7f8a9b101"
  ]
}
```

---

#### Unassign a single device from a cohort

```http
DELETE /api/v2/devices/cohorts/:cohort_id/unassign-device/:device_id
```

---

#### Unassign multiple devices from a cohort

```http
DELETE /api/v2/devices/cohorts/:cohort_id/unassign-many-devices
```

**Request body:**

```json
{
  "device_ids": ["64a1f2e3b4c5d6e7f8a9b0ff", "64a1f2e3b4c5d6e7f8a9b100"]
}
```

---

### 6.3 Listing Devices in a Cohort

#### List assigned devices

```http
GET /api/v2/devices/cohorts/:cohort_id/assigned-devices
```

Accepts standard pagination query parameters (`limit`, `skip`). Returns a paginated list of devices belonging to the cohort.

Or the pre-computed (faster) snapshot version, which accepts an optional JSON body for filtering:

```http
POST /api/v2/devices/cohorts/cached-devices
```

#### List devices available to assign (not yet in the cohort)

```http
GET /api/v2/devices/cohorts/:cohort_id/available-devices
```

---

### 6.4 Listing Sites in a Cohort

Just as a cohort groups devices, the same cohort scope can be used to list the **sites** (deployment locations) associated with those devices. This is particularly useful for building map views or location dashboards scoped to an organisation's fleet.

#### List sites for a cohort (live query)

```http
POST /api/v2/devices/cohorts/sites
```

**Request body:**

```json
{
  "cohorts": ["64a1f2e3b4c5d6e7f8a9b0c2"]
}
```

Returns all sites that contain at least one device belonging to the specified cohort(s). Accepts standard pagination query parameters (`limit`, `skip`).

#### List sites for a cohort (pre-computed snapshot — faster)

```http
POST /api/v2/devices/cohorts/cached-sites
```

Same request body shape as the live endpoint above. Serves results from a pre-populated snapshot collection, avoiding the aggregation pipeline at request time. Falls back to the live query automatically when the snapshot is not yet populated. Prefer this endpoint in production UI views for performance.

**Response (200 — both endpoints):**

```json
{
  "success": true,
  "message": "successfully retrieved the sites",
  "sites": [
    {
      "_id": "64a1f2e3b4c5d6e7f8a9b200",
      "name": "makerere_university",
      "description": "Makerere University main campus",
      "latitude": 0.33354,
      "longitude": 32.56861,
      "country": "Uganda",
      "city": "Kampala"
    }
  ],
  "meta": { "total": 12, "limit": 1000, "skip": 0 }
}
```

> **When to use sites vs devices from a cohort:** Use the cohort-devices endpoint when you need sensor-level data (readings, status, serial numbers). Use the cohort-sites endpoint when you need location-level data for map pins, site summaries, or deployment overviews. A single site can have multiple devices; the sites endpoint de-duplicates and returns one entry per physical location.

---

### 6.5 Managing Cohorts

#### Create a cohort

```http
POST /api/v2/devices/cohorts
```

**Request body:**

```json
{
  "name": "Dakar Schools Network",
  "description": "Air quality sensors deployed at schools in Dakar",
  "network": "airqo"
}
```

#### List cohorts

```http
GET /api/v2/devices/cohorts
```

#### Update a cohort

```http
PUT /api/v2/devices/cohorts/:cohort_id
```

#### Delete a cohort

```http
DELETE /api/v2/devices/cohorts/:cohort_id
```

#### Get a user's cohorts

```http
GET /api/v2/devices/cohorts/users?user_id=64a1f2e3b4c5d6e7f8a9b0c1
```

---

### 6.6 Can Any Organisation Member Add Devices or Cohorts?

Permission enforcement is handled by the **auth-service**, not the device registry. The device registry trusts the JWT presented in the request and will execute any operation the caller requests. This means:

- **Access control is the responsibility of your frontend and the auth-service.** Only surface cohort-assignment or import UI to users who have the appropriate role (e.g. `org_admin` or `device_manager`) for their organisation.
- A regular member of an organisation should not be shown the "Assign Device to Cohort" action unless their role permits it.
- The device registry will not reject a request from a regular member — the auth-service gate must be applied upstream.

In practice, in the vertex frontend, the pattern is:

1. Check the user's role in the organisation via the auth-service
2. If the role is `org_admin` or equivalent, render the device import and cohort assignment UI
3. If the role is `member`, render read-only views scoped to the org's cohort

---

## 7. Organisation Context and Device Visibility

### 7.1 What Does an Organisation Member See?

When a user is logged in as part of an organisation (the auth-service indicates `userContext = "external-org"`), they see devices that belong to **cohorts associated with their organisation**. They do not automatically see all devices in the system.

The data flow is:

```text
User belongs to Org A (auth-service)
  → Org A has cohort: "coh_org_a_devices"
  → "coh_org_a_devices" contains 47 devices
  → User sees those 47 devices when browsing the platform
```

If a device has not been added to any of the organisation's cohorts, organisation members cannot see it even if it is in the system.

### 7.2 Switching Between Organisation and Personal Context

A user can belong to multiple organisations. The context switch call tells the device registry which organisation's scope to apply when fetching devices and data.

#### Get the user's organisations

```http
GET /api/v2/devices/user-organizations?user_id=64a1f2e3b4c5d6e7f8a9b0c1
```

Returns a list of organisations the user belongs to.

#### Switch active organisation context

```http
POST /api/v2/devices/switch-organization/:organization_id
```

After switching, queries that filter by the user's context will apply the selected organisation's cohort scope.

### 7.3 Adding Devices to an Organisation's Fleet

There are two ways to add devices to an organisation's cohort so that all members can see them:

**Option A — At import time (most efficient):**  
When calling `POST /devices/soft` or `POST /devices/soft/bulk`, include the organisation's `cohort_id` in the request body. The device is created and added to the cohort in a single step.

**Option B — After the fact:**  
If the device is already in the system (imported or AirQo-manufactured), call:

```http
PUT /api/v2/devices/cohorts/:cohort_id/assign-device/:device_id
```

or for many devices at once:

```http
POST /api/v2/devices/cohorts/:cohort_id/assign-devices
```

---

## 8. Common Workflows End-to-End

### Workflow A: AirQo ships a device to an individual user

```text
1. Admin: POST /devices/prepare-for-shipping
   → Device gets claim_token "BLUE-RIVER-42"

2. Admin: POST /devices/shipping-batches
   → Batch created with printable labels

3. Device physically shipped to user with printed QR code / token

4. User scans QR code or enters token in app
   → App calls: POST /devices/claim
   Body: { device_name, claim_token, user_id }

5. Device is now "claimed"; user sees it in GET /devices/my-devices
```

---

### Workflow B: Organisation admin onboards an AirGradient fleet

```text
1. Partner provides a spreadsheet of AirGradient sensor locations

2. Admin prepares CSV using the template (or uses AirGradient column names as-is)

3. Admin uploads via the UI:
   POST /devices/soft/bulk (multipart/form-data)
   Form fields: file=<csv>, user_id=<admin_id>,
                network_override=airgradient,
                cohort_id=<org_cohort_id>

4. API returns 207 with per-row results
   → Show success/failure summary to admin
   → Allow download of failed rows for correction

5. All successfully created devices are now:
   - Owned by the admin user (owner_id set)
   - In the org's cohort → visible to all org members
   - In the global airqo cohort → visible to AirQo platform monitoring
```

---

### Workflow C: Admin manually assigns an existing device to an org

```text
1. Fetch the device to get its _id:
   GET /devices?name=cap_ple_kzn_za

2. Assign to org cohort:
   PUT /devices/cohorts/:cohort_id/assign-device/:device_id

3. All org members now see the device in their feed
```

---

### Workflow D: Transfer a device from one user to another

```text
1. Verify current ownership:
   GET /devices/my-devices?user_id=<original_owner_id>

2. Transfer:
   POST /devices/transfer
   Body: { device_name, from_user_id, to_user_id }

3. Device moves to new owner's personal cohort
   Original owner no longer sees it in their "My Devices"
```

---

## 9. Frequently Asked Questions

**Q: What is the difference between claiming a device and assigning it to a cohort?**

Claiming is about physical ownership — one named individual becomes responsible for the hardware. Cohort assignment is about data-access grouping — one or many organisations or user collections can see the device's readings. A device can be claimed without being in any cohort, be in many cohorts without having an individual owner, or both.

---

**Q: What is the difference between claiming as an individual vs claiming through an organisation?**

When an individual claims a device, they use `POST /claim` with only their `user_id`. The device lands in their personal cohort (`coh_user_<their_id>`) and is visible only to them. When claiming on behalf of an organisation, the admin also passes `cohort_id` (the org's cohort), so the device simultaneously belongs to the individual owner and is visible to all organisation members.

---

**Q: When a user joins an organisation, do they automatically see that org's devices?**

Yes — but only if the devices have been added to the org's cohort. Joining an organisation gives you access to the org's cohort scope. Devices not yet added to that cohort remain invisible to org members.

---

**Q: Can any organisation member import devices or assign cohorts?**

The device registry API does not enforce role-based restrictions internally. It is up to the frontend and auth-service to gate these actions behind role checks. In the vertex frontend, only users with an admin role for their organisation should see the import and cohort-assignment UI.

---

**Q: If I import a device without a `cohort_id`, where does it end up?**

It is added to:
1. The global default cohort (every device is in this)
2. The importing user's personal cohort (`coh_user_<user_id>`) — if `user_id` was supplied

It is **not** visible to any organisation until explicitly assigned to an org cohort.

---

**Q: Can I import an AirQo device using the `/soft` or `/soft/bulk` endpoint?**

No. Setting `network = "airqo"` on an import will fail validation because AirQo devices go through the shipping and claiming workflow, not direct import. External device import is exclusively for third-party manufacturer devices.

---

**Q: What happens if the same device is imported twice (same `serial_number` + `network`)?**

The system detects the duplicate and the second import attempt will fail with an error message in the per-device result. The original device is not modified.

---

**Q: What is `api_code` and do I need to provide it?**

`api_code` is the URL the system uses to fetch live readings from the device's external API (e.g. `https://api.airgradient.com/.../55524/measures/current`). For networks that have an adapter configured with a URL template, the system builds `api_code` automatically from the `serial_number`. You only need to provide it manually if you know the exact URL and want to override the auto-built one, or if the network has no template configured.

---

**Q: What is `network_override` in the bulk import endpoint?**

It is a convenience field that sets the same `network` value for every device in the batch, so you do not have to repeat it in every row of the JSON body or CSV file. It is especially useful when you are uploading a partner-specific file (e.g. all rows are AirGradient devices).

---

## 10. Quick Reference — All Endpoints

### Shipping

| Method | Path | Description |
|---|---|---|
| `POST` | `/prepare-for-shipping` | Prepare a single device; generate claim token |
| `POST` | `/prepare-bulk-for-shipping` | Prepare up to 50 devices |
| `POST` | `/shipping-batches` | Create a named shipping batch |
| `GET` | `/shipping-batches` | List all shipping batches |
| `GET` | `/shipping-batches/:id` | Get batch details |
| `DELETE` | `/shipping-batches/:id/devices` | Remove devices from a batch |
| `GET` | `/shipping-status` | Check preparation status for devices |
| `POST` | `/generate-shipping-labels` | Generate label data for printing |
| `GET` | `/qr-code/:deviceName` | Get QR code for a device's claim token |

### Claiming

| Method | Path | Description |
|---|---|---|
| `POST` | `/claim` | Claim a single device |
| `POST` | `/claim/bulk` | Claim up to 30 devices at once |
| `POST` | `/transfer` | Transfer device ownership between users |
| `GET` | `/my-devices` | List a user's claimed devices |
| `GET` | `/sites/my-sites` | List sites associated with a user's devices |

### Importing External Devices

| Method | Path | Description |
|---|---|---|
| `POST` | `/soft` | Import a single external device |
| `POST` | `/soft/bulk` | Bulk import — JSON array or CSV file upload |

### Cohorts

| Method | Path | Description |
|---|---|---|
| `POST` | `/cohorts` | Create a cohort |
| `GET` | `/cohorts` | List cohorts |
| `GET` | `/cohorts/:cohort_id` | Get a single cohort |
| `PUT` | `/cohorts/:cohort_id` | Update a cohort |
| `DELETE` | `/cohorts/:cohort_id` | Delete a cohort |
| `GET` | `/cohorts/users` | Get cohorts for a user |
| `PUT` | `/cohorts/:cohort_id/assign-device/:device_id` | Assign one device to a cohort |
| `POST` | `/cohorts/:cohort_id/assign-devices` | Assign many devices to a cohort |
| `DELETE` | `/cohorts/:cohort_id/unassign-device/:device_id` | Unassign one device |
| `DELETE` | `/cohorts/:cohort_id/unassign-many-devices` | Unassign many devices |
| `GET` | `/cohorts/:cohort_id/assigned-devices` | List devices in a cohort |
| `GET` | `/cohorts/:cohort_id/available-devices` | List devices not yet in the cohort |
| `POST` | `/cohorts/cached-devices` | Fast snapshot of devices in a cohort |
| `POST` | `/cohorts/sites` | List sites for one or more cohorts (live) |
| `POST` | `/cohorts/cached-sites` | Fast snapshot of sites for a cohort |

### Organisation Context

| Method | Path | Description |
|---|---|---|
| `GET` | `/user-organizations` | Get a user's organisations |
| `POST` | `/switch-organization/:organization_id` | Switch active org context |

---

*Last updated: May 2026 — covers bulk import endpoint added in the `bulk-import` branch.*
