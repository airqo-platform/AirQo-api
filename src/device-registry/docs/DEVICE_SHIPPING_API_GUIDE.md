# Device Shipping API Guide

This guide walks through the full device shipping workflow — from preparing devices for shipping to generating printable labels.

---

## Overview: Correct Order of Operations

```
1. Prepare devices  →  POST /api/v2/devices/prepare-bulk-for-shipping
2. Generate labels  →  POST /api/v2/devices/generate-shipping-labels
```

Step 2 **will fail** if Step 1 has not been completed successfully first. Labels can only be generated for devices that have been prepared.

---

## Step 1 — Prepare Devices for Shipping

**Endpoint:** `POST /api/v2/devices/prepare-bulk-for-shipping`

Sets a claim token on each device and marks it as ready for shipping. Optionally groups prepared devices into a named shipping batch.

### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `JWT <token>` |
| `Content-Type` | `application/json` |

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `device_names` | `string[]` | Yes | Array of 1–50 device names to prepare. Names must match exactly as stored (case-sensitive). |
| `batch_name` | `string` | No | If provided, groups all successfully prepared devices into a named shipping batch. |
| `token_type` | `string` | No | Token format: `"hex"` (default) or `"readable"`. |

### Example Request

```json
{
  "device_names": ["aq_device_001", "aq_device_002"],
  "batch_name": "shipment-june-2026",
  "token_type": "hex"
}
```

### Success Response (`200 OK`)

```json
{
  "success": true,
  "message": "Bulk preparation completed: 2 successful, 0 failed. Shipping batch 'shipment-june-2026' was created.",
  "bulk_preparation_results": {
    "successful_preparations": [
      {
        "device_id": "<mongo_id>",
        "device_name": "aq_device_001",
        "claim_token": "abc123...",
        "token_type": "hex",
        "qr_code_data": { "..." : "..." },
        "qr_code_image": "data:image/png;base64,...",
        "label_data": { "..." : "..." },
        "shipping_prepared_at": "2026-06-11T10:00:00.000Z"
      }
    ],
    "failed_preparations": [],
    "summary": {
      "total_requested": 2,
      "successful_count": 2,
      "failed_count": 0
    }
  }
}
```

### Partial Failure Response (`200 OK`)

For valid requests, the endpoint returns `200` even when one or more devices fail. Check `failed_preparations` for individual device errors. Invalid requests (e.g. missing `device_names`) return `400`.

```json
{
  "success": true,
  "message": "Bulk preparation completed: 1 successful, 1 failed. Shipping batch 'shipment-june-2026' was created.",
  "bulk_preparation_results": {
    "successful_preparations": ["..."],
    "failed_preparations": [
      {
        "device_name": "aq_device_002",
        "error": "Device not found"
      }
    ],
    "summary": {
      "total_requested": 2,
      "successful_count": 1,
      "failed_count": 1
    }
  }
}
```

### Common Failure Reasons (per device)

| `error` value | Cause | Fix |
|---|---|---|
| `"Device not found"` | Name doesn't match any device in the system | Verify the exact device name (case-sensitive) |
| `"Device is currently deployed and cannot be prepared for shipping"` | Device has `status: deployed` | Recall the device before preparing it for shipping |

### Important Notes

- `batch_name` is **optional**. Omitting it still prepares the devices; it just skips batch grouping.
- A batch is only created if `batch_name` is provided **and** at least one device was prepared successfully.
- If all devices fail, the message will read: `"No shipping batch was created as no devices were prepared successfully."` — even if `batch_name` was provided.
- Device names are **case-sensitive**.

---

## Step 2 — Generate Shipping Labels

**Endpoint:** `POST /api/v2/devices/generate-shipping-labels`

Generates printable QR code labels for devices that have already been prepared via Step 1.

### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `JWT <token>` |
| `Content-Type` | `application/json` |

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `device_names` | `string[]` | Yes | Array of 1–20 device names. Each device must have been prepared for shipping first. |

### Example Request

```json
{
  "device_names": ["aq_device_001", "aq_device_002"]
}
```

### Success Response (`200 OK`)

```json
{
  "success": true,
  "message": "Shipping labels generated successfully",
  "shipping_labels": {
    "labels": [
      {
        "device_name": "aq_device_001",
        "device_long_name": "AirQo Device 001",
        "claim_token": "abc123...",
        "qr_code_data": { "..." : "..." },
        "qr_code_image": "data:image/png;base64,...",
        "label_data": { "..." : "..." }
      }
    ],
    "total_labels": 1
  }
}
```

### Failure Response (`404 Not Found`)

```json
{
  "success": false,
  "message": "No prepared devices found",
  "errors": {
    "message": "Devices not found or not prepared for shipping"
  }
}
```

This error means either:
- The device names don't exist in the system, **or**
- The devices exist but Step 1 (prepare for shipping) has not been completed for them yet

---

## End-to-End Example

### 1. Prepare devices

```bash
curl -X POST https://<host>/api/v2/devices/prepare-bulk-for-shipping \
  -H "Authorization: JWT <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_names": ["aq_device_001"],
    "batch_name": "shipment-june-2026"
  }'
```

Confirm `successful_count > 0` before proceeding.

### 2. Generate labels

```bash
curl -X POST https://<host>/api/v2/devices/generate-shipping-labels \
  -H "Authorization: JWT <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_names": ["aq_device_001"]
  }'
```
