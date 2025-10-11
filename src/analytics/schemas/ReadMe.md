# Data Validation Rules

This document describes the validation logic applied to requests handled by the data processing API.
Validation is enforced via Marshmallow schemas to ensure correct and consistent query parameters.

## General Rules

### 1. Date Validation

- **Rule:** `endDateTime` **must not** be earlier than `startDateTime`.
- **Applies to:** All schemas.
- **Error:** `endDateTime must not be earlier than startDateTime.`

---

### 2. Mutually Exclusive Filters

- **Rule:** Exactly **one** of the following fields must be provided:
  - `sites`
  - `device_ids`
  - `device_names`
- **Error:** `Exactly one of 'sites', 'device_ids', or 'device_names' must be provided.`

---

## DataDownloadSchema Rules

### 3. Datatype + Frequency (Calibrated)

- **Rule:** If `datatype` = `"calibrated"`, then `frequency` must be **one of:**
  - `hourly`, `daily`, `weekly`, `monthly`, `yearly`
- **Error Example:** `Invalid frequency 'raw' for datatype 'calibrated'. Must be one of ['daily', 'hourly', 'monthly', 'weekly', 'yearly']`

---

### 4. Device Category + Datatype

- **Rule:** If `device_category` is `"bam"` or `"mobile"`, then `datatype` **must** be `"raw"`.
- **Error Example:** `Invalid datatype 'calibrated' for device_category 'bam'. Must be 'raw'.`

---

### 5. Sites + Device Category

- **Rule:** If `sites` is provided, then `device_category` **must** be `"lowcost"`.
- **Error Example:** `Invalid device category and sites metadata combination. Must be 'lowcost'.`

---

### 6. Mobile Device + Frequency

- **Rule:** If `device_category` is `"mobile"`, then `frequency` **must** be `"raw"`.
- **Error Example:** `Invalid frequency 'hourly' for device_category 'mobile'. Must be 'raw'.`

---

## RawDataSchema Rules

- Enforces:
  - Date validation
  - Mutual exclusivity between `sites`, `device_ids`, and `device_names`
  - Required `network` in: `airqo`, `iqair`, `airnow`
  - Required `device_category` in: `bam`, `lowcost`, `mobile`

---

## DataExportSchema Rules

- Enforces:
  - Date validation
  - Mutual exclusivity between `sites`, `device_ids`, and `device_names`
  - `frequency` allowed: `hourly`, `daily`, `raw`
  - Required `exportFormat`: `csv` or `json`
  - Required `outputFormat`: `airqo-standard` or `aqcsv`
  - `pollutants` allowed: `pm2_5`, `pm10`

---

## Summary Table of Key Combinations

| Condition                                       | Allowed Values                                   | Not Allowed Example                       |
| ----------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `datatype = calibrated`                         | `hourly`, `daily`, `weekly`, `monthly`, `yearly` | `raw`                                     |
| `device_category = bam` or `mobile`             | `datatype = raw`                                 | `datatype = calibrated`                   |
| `device_category = mobile`                      | `frequency = raw`                                | `frequency = hourly`                      |
| `sites` provided                                | `device_category = lowcost`                      | `device_category = bam`                   |
| Filters (`sites`, `device_ids`, `device_names`) | Exactly one provided                             | `sites` **and** `device_ids` both present |

---
