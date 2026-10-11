# Beacon API: Device Health, Diagnostics and Status Codes

This document covers what was added to the Beacon API so device health can be shown wherever devices are listed (devices, sites, grids, cohorts and groups), and so device-reported status codes (such as BAM-1020 error codes) can be translated into readable faults.

All paths are relative to the Beacon API base (`/api/v1`; `/api/v1/beacon` through the platform gateway).

---

## 1. Overview: three views of device health

| View | What it tells you | Where it comes from | How to get it |
| :--- | :--- | :--- | :--- |
| **Performance** | Is the device sending data? Uptime, data completeness, averages and a time series for a chosen date range | Locally synced ThingSpeak data, computed on request | `includePerformance=true` + `startDateTime` + `endDateTime` |
| **Diagnostics** | Is the device healthy? Health score, lifecycle state and detected issues with streaks | The nightly diagnostic engine run, stored per device per day | `includeDiagnostics=true` on lists; `/diagnostics/fleet/*` for overviews |
| **Status codes** | What does the device itself say is wrong? e.g. BAM status `17` = Tape Break + Flow Failure | Status code sets: code meanings plus a decode rule, per device type | `/status-code-sets/{name}` and `/status-code-sets/{name}/decode` |

---

## 2. Performance on sites and devices

Grids and cohorts already supported `includePerformance`. Sites and devices now do too.

### Endpoints

| Endpoint | New parameters |
| :--- | :--- |
| `GET /sites/` | `group`, `includePerformance`, `startDateTime`, `endDateTime`, `frequency` |
| `GET /sites/{site_id}` | same as above |
| `GET /devices/synced` | `includePerformance`, `startDateTime`, `endDateTime`, `frequency` (`group` was already required) |

- `frequency` is `raw`, `hourly` (default) or `daily`; anything else returns `400`.
- Performance is only computed when `includePerformance=true` **and** both dates are given.

### Behaviour

- **`group` on sites** (optional, comma-separated group titles): only sites containing at least one of the group's devices are returned, and each site lists only those devices. Without `group`, all sites are returned as before. `airqo` sees everything; an unknown group returns `404` and an empty `group=` returns `400`.
- **Non-airqo devices are left out when performance is on**, as for grids, because only airqo devices have locally synced data. This is applied in the query, before paging, so `meta.total` stays correct.
- **Single site `404`s**: the site doesn't exist; it has none of the group's devices; or performance is on and it has no airqo devices.
- **`/devices/synced` paging**: `meta.nextPage` keeps the performance parameters.

### Fields added

On each site and each device (devices in `/devices/synced` and devices inside sites):

| Field | Meaning |
| :--- | :--- |
| `uptime` | % of hours (or days, for `daily`) in the range with at least one reading (0–100) |
| `data_completeness` | Same as `uptime`, kept for compatibility |
| `averages` | Mean of each measured value, e.g. `{"pm2.5 sensor1": 20.0, "pm2.5": 25.0}` |
| `data` | Readings over the range; for a site, averaged across its devices at each timestamp |

A site's `uptime` and `averages` are averaged across its devices.

```
GET /sites/?group=<title>&includePerformance=true&startDateTime=2026-10-01T00:00:00Z&endDateTime=2026-10-08T00:00:00Z
GET /devices/synced?group=<title>&includePerformance=true&startDateTime=2026-10-01T00:00:00Z&endDateTime=2026-10-08T00:00:00Z
```

---

## 3. Diagnostics in list responses: `includeDiagnostics=true`

Adds each device's most recent stored diagnosis to list responses, and a roll-up per site, grid and cohort. The engine never runs during these requests; they only read what the nightly run stored.

### Endpoints

`/devices/synced`, `/sites/`, `/sites/{site_id}`, `/grids/synced`, `/grids/synced/{grid_id}`, `/cohorts/synced`, `/cohorts/synced/{cohort_id}`

It can be combined with `includePerformance` in the same request.

### Per device: `diagnostics`

The device's latest diagnosis from the **last 7 days**, or `null` when there is none (the device was offline, or its profile can't be diagnosed). Show `null` as "Not diagnosed".

| Field | Meaning |
| :--- | :--- |
| `diagnosis_date` | Day the diagnosis covers (`YYYY-MM-DD`). Show as "as of", since an offline device keeps its last diagnosis |
| `overall_health_score` | 0–100 |
| `lifecycle_state` | `HEALTHY`, `DEGRADING`, `SUSPICIOUS`, `LIKELY_FAILURE`, `FAILED` or `RECOVERING` |
| `issue_count` | Issues detected that day (all of them, not just those listed) |
| `max_severity` | Worst issue severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, or `null` |
| `top_cause_code` | Most likely root cause |
| `headline` | One-line summary, e.g. `"Likely failure (47/100): device_battery (battery) fault (92%)"` |
| `issues` | The **3 most severe** issues: `issue_code`, `title`, `severity`, `subsystem`, `component_name`, `streak_days` (consecutive days seen), `is_new` (first seen that day) |

### Per site, grid and cohort: `diagnostics_summary`

Grids get one per site and one for the whole grid.

| Field | Meaning |
| :--- | :--- |
| `devices_total` | Devices in the container |
| `devices_diagnosed` / `devices_not_diagnosed` | With / without a diagnosis in the last 7 days |
| `devices_with_issues` | Diagnosed devices with at least one issue |
| `average_health_score` / `min_health_score` | Across diagnosed devices |
| `lifecycle_state_counts` | e.g. `{"HEALTHY": 2, "LIKELY_FAILURE": 1}` |
| `max_severity` | Worst severity across devices |
| `latest_diagnosis_date` | Most recent diagnosis date among the devices |
| `top_issues` | The **5 most common** issues: `issue_code`, `title`, `severity` (highest seen), `subsystem`, `device_count` |

### Example

```
GET /sites/?group=<title>&includeDiagnostics=true
```

```json
{
  "site_id": "site_1",
  "name": "A Site",
  "diagnostics_summary": {
    "devices_total": 2,
    "devices_diagnosed": 2,
    "devices_not_diagnosed": 0,
    "devices_with_issues": 2,
    "average_health_score": 58.5,
    "min_health_score": 47.0,
    "lifecycle_state_counts": {"LIKELY_FAILURE": 1, "DEGRADING": 1},
    "max_severity": "CRITICAL",
    "latest_diagnosis_date": "2026-10-10",
    "top_issues": [
      {"issue_code": "DATA_GAPS:device", "title": "...", "severity": "HIGH", "subsystem": "device", "device_count": 2}
    ]
  },
  "devices": [
    {
      "device_id": "dev_1",
      "device_name": "aq_01",
      "diagnostics": {
        "diagnosis_date": "2026-10-10",
        "overall_health_score": 47.0,
        "lifecycle_state": "LIKELY_FAILURE",
        "issue_count": 4,
        "max_severity": "CRITICAL",
        "headline": "...",
        "issues": [
          {"issue_code": "METRIC_BELOW_MIN:device_battery.battery_voltage", "title": "...", "severity": "CRITICAL",
           "subsystem": "battery", "component_name": "device_battery", "streak_days": 4, "is_new": false}
        ]
      }
    }
  ]
}
```

### Performance cost

- **Two database queries per request, regardless of page size**: one for each device's latest diagnosis, one for those diagnoses' issues. Both use existing indexes.
- Only summary columns are read; the large JSON columns (`indicators`, `trends`, `metrics_summary`, ...) are never loaded.
- Device IDs are sent in batches of 1,000.

---

## 4. Group filter on fleet diagnostics

| Endpoint | New parameter |
| :--- | :--- |
| `GET /diagnostics/fleet/daily-summary` | `group` |
| `GET /diagnostics/fleet/issues` | `group` (combines with all existing filters) |

- Limits results to the group's devices.
- When no date is given, uses **the group's own latest diagnosed day**, which can differ from the fleet's.
- `airqo` sees the whole fleet; an unknown group returns `404` and an empty `group=` returns `400`.
- The group's devices are filtered inside the database (a subquery), not passed as a long list, so large groups stay fast.

```
GET /diagnostics/fleet/daily-summary?group=<title>
GET /diagnostics/fleet/issues?group=<title>&severity=CRITICAL&min_streak_days=2
```

---

## 5. Status code sets

Some devices report a status code in a telemetry field, and each device type has its own codes. A **status code set** stores one type's codes, what they mean, and the rule for translating a reported value.

### Decode rules

**`bitmask`** — the value is the **sum** of every active code, and each code is a single bit (1, 2, 4, 8, ...). Splitting a value into its bits is the same as repeatedly subtracting the largest code that fits, and single-bit codes guarantee there is only one way to split it.

| Value | Decodes to | Status |
| :--- | :--- | :--- |
| `0` | Functional | `ok` |
| `17` | 16 Flow Failure + 1 Tape Break | `fault` |
| `144` | 128 Power Failure + 16 Flow Failure | `fault` |
| `528` | 512 Maintenance + 16 Flow Failure | `fault` |
| `512` | Maintenance | `info` |
| `1040` | 16 Flow Failure + unknown `1024` | `fault` |

Codes like 1, 2 and 3 are rejected under this rule: `3` could mean "3" or "1 + 2".

**`exact`** — the value is a single code (for devices that report one state number). Values without a definition are `unknown`.

### Code kinds and overall status

Each code has a `kind`:

| Kind | Meaning |
| :--- | :--- |
| `ok` | Normal operation (with `bitmask`, only code `0`) |
| `fault` | Something is wrong |
| `info` | Worth knowing but not a fault, e.g. Maintenance |

A decoded value's `status` is its most serious part: **`fault` > `unknown` > `info` > `ok`**. Values that aren't non-negative whole numbers below 2^53 (`"abc"`, `3.5`, `-1`, `9007199254740993`) are `invalid`, since larger values can't be read exactly. `17`, `17.0` and `"17"` are all accepted.

### Endpoints

| Method & path | Use |
| :--- | :--- |
| `GET /status-code-sets/` | List sets (`skip`, `limit`, `search` on name) |
| `POST /status-code-sets/` | Create a set with its codes |
| `GET /status-code-sets/{id or name}` | Get one set, e.g. `/status-code-sets/bam-1020` |
| `PUT`/`PATCH /status-code-sets/{id or name}` | Update; omitted fields are kept, and `codes` (when given) replaces the whole list |
| `DELETE /status-code-sets/{id or name}` | Delete a set and its codes |
| `GET /status-code-sets/{id or name}/decode?value=17&value=144` | Translate one or more values (up to 1,000) |

Errors: `404` set not found · `409` name already used · `422` invalid codes (`detail` lists each problem) · `400` more than 1,000 values.

### Examples

Create a set:

```json
POST /status-code-sets/
{
  "name": "bam-1020",
  "description": "Met One BAM-1020 status codes",
  "decode_rule": "bitmask",
  "codes": [
    {"code": 0,  "label": "Functional",   "kind": "ok"},
    {"code": 1,  "label": "Tape Break",   "kind": "fault", "description": "No tape movement was detected during the tape move process."},
    {"code": 16, "label": "Flow Failure", "kind": "fault", "description": "Sample flow is less than 1.0 SLPM for >1 minute, ..."}
  ]
}
```

Decode values:

```json
GET /status-code-sets/bam-1020/decode?value=17&value=0

{
  "code_set": "bam-1020",
  "decode_rule": "bitmask",
  "results": [
    {
      "value": 17.0,
      "status": "fault",
      "codes": [
        {"code": 1,  "label": "Tape Break",   "description": "No tape movement was detected ...", "kind": "fault"},
        {"code": 16, "label": "Flow Failure", "description": "Sample flow is less than 1.0 SLPM ...", "kind": "fault"}
      ],
      "unknown_codes": []
    },
    {
      "value": 0.0,
      "status": "ok",
      "codes": [{"code": 0, "label": "Functional", "description": "...", "kind": "ok"}],
      "unknown_codes": []
    }
  ]
}
```

### Linking a device type to its code set

A device profile points a telemetry field at a set by name, in that field's telemetry mapping. Different models or firmware can point at different sets.

```json
"telemetry_mappings": {
  "field6": {"key": "device_status", "label": "BAM Status Code", "status_code_set": "bam-1020"}
}
```

### Seeded BAM-1020 set

`POST /diagnostics/seed-defaults` creates the `bam-1020` set and links the BAM profile's `field6` to it. An existing BAM profile is linked only if `field6` is mapped to `device_status` and not already linked to another set.

| Code | Label | Kind |
| :--- | :--- | :--- |
| 0 | Functional | ok |
| 1 | Tape Break | fault |
| 2 | Beta Detector | fault |
| 4 | Sensor Range | fault |
| 8 | Tape Advance | fault |
| 16 | Flow Failure | fault |
| 32 | Nozzle Failure | fault |
| 64 | Digital Link Failure | fault |
| 128 | Power Failure | fault |
| 256 | Short Sample | info |
| 512 | Maintenance | info |

Kinds can be changed with `PATCH /status-code-sets/bam-1020`.

---

## 6. Frontend integration (`AirQo-frontend/src/beacon`)

### A. Fleet diagnostics page: open it to every group

`app/dashboard/diagnostics/page.tsx` currently loads nothing unless the active group is `airqo`.

1. `services/diagnosticsService.ts`: add `group?: string` to the `getFleetDailySummary` parameters.
2. `types/diagnostics.ts`: add `group?: string` to `FleetIssueFilters`.
3. In the page: pass `group: activeGroup` to both calls, remove the `isAirqoGroup` gate (keep it only on airqo-only admin actions such as the daily run), and add `activeGroup` to the hooks' dependencies.

### B. Diagnostics in the analytics lists

1. `services/airqloud.service.ts`: add `includeDiagnostics?: boolean` to `AirQloudsQueryParams`, append it in `getAirQlouds`, `getGrids`, `getSites` and `getDevicesWithPerformance`, and add it as an option to `getAirQloudById`, `getGridById` and `getSiteById`.
2. No normalizer changes are needed: they copy the incoming objects, so `diagnostics` and `diagnostics_summary` pass through.
3. Health scores are 0–100. Don't convert them with `toLegacyFraction` as is done for uptime.
4. Suggested UI:
   - Device rows: lifecycle badge, health score, issue count and worst severity; headline and top issues on hover or expand; link to `/dashboard/devices/{id}/diagnostics`.
   - Site / grid / cohort rows: state counts as chips ("2 healthy · 1 likely failure"), average and lowest score, top issue with its device count.

### C. Status codes

`lib/bam-status.ts` hardcodes the BAM table and only the collocation pages use it. Instead:

1. Read `status_code_set` from the device profile's telemetry mapping for the status field.
2. Fetch the set once (`GET /status-code-sets/{name}`) and decode values locally, or call `/decode` for one-off values.
3. Show decoded codes as chips (red `fault`, grey `info`, green `ok`) with the description on hover.

Local decoding, matching the API:

```ts
const RANK = { ok: 0, info: 1, unknown: 2, fault: 3 } as const

export function decodeStatus(set: StatusCodeSet, value: unknown): StatusDecodeResult {
  const n = Number(value)
  // Above 2^53 a JS number can't hold every whole number, so those values are rejected as by the API.
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isInteger(n) || n < 0 || n >= 2 ** 53) {
    return { value: null, status: 'invalid', codes: [], unknown_codes: [] }
  }
  const byCode = new Map(set.codes.map((c) => [c.code, c]))
  let wanted: number[]
  if (set.decode_rule === 'bitmask') {
    if (n === 0) return { value: 0, status: 'ok', codes: byCode.has(0) ? [byCode.get(0)!] : [], unknown_codes: [] }
    wanted = []
    // Division instead of bitwise operators, which are limited to 32 bits in JS.
    for (let bit = 1; bit <= n; bit *= 2) if (Math.floor(n / bit) % 2 === 1) wanted.push(bit)
  } else {
    wanted = [n]
  }
  const codes = wanted.filter((c) => byCode.has(c)).map((c) => byCode.get(c)!)
  const unknown_codes = wanted.filter((c) => !byCode.has(c))
  const kinds = [...codes.map((c) => c.kind), ...(unknown_codes.length ? ['unknown' as const] : [])]
  const status = kinds.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok' as keyof typeof RANK)
  return { value: n, status, codes, unknown_codes }
}
```

### D. Types to add (`types/diagnostics.ts`)

```ts
export interface DeviceDiagnosticsIssue {
  issue_code: string
  title: string
  severity: IssueSeverity
  subsystem: string
  component_name: string | null
  streak_days: number
  is_new: boolean
}

export interface DeviceDiagnostics {
  diagnosis_date: string            // YYYY-MM-DD
  overall_health_score: number      // 0–100
  lifecycle_state: string           // HEALTHY | DEGRADING | SUSPICIOUS | LIKELY_FAILURE | FAILED | RECOVERING
  issue_count: number
  max_severity: IssueSeverity | null
  top_cause_code: string | null
  headline: string | null
  issues: DeviceDiagnosticsIssue[]  // top 3, most severe first
}

export interface DiagnosticsSummary {
  devices_total: number
  devices_diagnosed: number
  devices_not_diagnosed: number
  devices_with_issues: number
  average_health_score: number | null
  min_health_score: number | null
  lifecycle_state_counts: Record<string, number>
  max_severity: IssueSeverity | null
  latest_diagnosis_date: string | null
  top_issues: { issue_code: string; title: string; severity: IssueSeverity; subsystem: string; device_count: number }[]
}

export type StatusCodeKind = 'ok' | 'fault' | 'info'

export interface StatusCode {
  code: number
  label: string
  description: string | null
  kind: StatusCodeKind
}

export interface StatusCodeSet {
  id: string
  name: string
  description: string | null
  decode_rule: 'bitmask' | 'exact'
  codes: StatusCode[]
}

export interface StatusDecodeResult {
  value: number | null
  status: 'ok' | 'info' | 'unknown' | 'fault' | 'invalid'
  codes: StatusCode[]
  unknown_codes: number[]
}
```

---

## 7. Code map

| Area | Files |
| :--- | :--- |
| Site performance and group scope | `app/services/site_service.py`, `app/api/v1/site.py`, `app/schemas/site.py` |
| Device performance | `app/services/device_service.py` (`apply_local_performance_synced_devices`), `app/api/v1/devices.py` |
| Diagnostics on lists | `app/services/diagnostics/summaries.py`; wired into `app/api/v1/{devices,site,grid,cohort}.py`; schemas in `app/schemas/diagnostics.py` (`DeviceDiagnostics`, `DiagnosticsSummary`) and the site / grid / cohort schemas |
| Fleet group filter | `app/services/group_filter.py` (`group_device_id_select`), `app/services/diagnostics/daily.py` (`build_fleet_daily_summary`), `app/crud/crud_diagnostics.py`, `app/api/v1/diagnostics.py` |
| Status code sets | `app/models/status_codes.py`, `app/schemas/status_codes.py`, `app/services/status_codes.py`, `app/api/v1/status_codes.py`, seed in `app/services/diagnostics/seeds.py` |
| Migration | `alembic/versions/e1f2a3b4c5d6_add_status_code_sets.py` |

---

## 8. Deployment

1. Run the migration: `alembic upgrade head` creates `status_code_sets` and `status_codes`.
2. Seed the BAM set: `POST /diagnostics/seed-defaults`. It is safe to re-run; existing records are kept.

No other schema changes are needed. Everything else reads existing tables, and every new response field only appears when its flag is set (or is `null` / empty otherwise).

---

## 9. Tests

| File | Covers | Tests |
| :--- | :--- | :--- |
| `tests/test_site_device_health.py` | Site group scoping, site and device performance, paging | 14 |
| `tests/test_diagnostics_summaries.py` | Latest-diagnosis loading, roll-ups, `includeDiagnostics` on every list endpoint, fleet group filters | 25 |
| `tests/test_status_codes.py` | Decoding, validation, the status code set endpoints, seeding and profile linking | 25 |

Run one with `venv/bin/python -m unittest tests.test_status_codes`.

---

## 10. Not done yet

- **Status codes in the diagnostic engine**: turn active fault codes into diagnosed issues (so they appear in health scores, streaks and fleet summaries). Needs each code linked to a profile component (e.g. `"status_components": {"16": "sample_flow"}` on the mapping), components on the BAM profile (it currently has none, so BAM devices are not diagnosed), and a decision on `field20` (`device_status_ext`).
- **`site_ids` filter on `/sites/`**, so the frontend can fetch several sites' performance in one request instead of one per site.
- **Filtering and sorting `/devices/synced` by health** (lifecycle state, severity, score).
- **`includeDiagnostics` on the platform-shape endpoints** `/cohorts/`, `/cohorts/{ids}`, `/grids/` and `/grids/{ids}`.
- **Intermittent test**: `test_device_issue_summary` (in `tests/test_daily_diagnostics.py`) failed 3 times in early runs on this branch, then passed 200 runs in a row; the cause is unknown.
