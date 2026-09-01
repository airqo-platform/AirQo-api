# AirQo Analytics API Documentation

Reference for the AirQo Analytics data endpoints: request formats, response
structures and usage examples.

This document covers the four data endpoints below. The service exposes further
routes — scheduled exports, grid reports, report templates and other dashboard
aggregations — which are not documented here yet; consult the generated OpenAPI
schema at `/docs` for those.

For running the service locally, configuration and deployment, see the
[service README](../../README.md).

## Table of Contents

- [API Overview](#api-overview)
- [API Versioning](#api-versioning)
- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Endpoints Covered](#endpoints-covered)
- [Shared Request Fields](#shared-request-fields)
- [Validation Rules](#validation-rules)
- [Data Download](#data-download)
- [Raw Data](#raw-data)
- [Dashboard Charts](#dashboard-charts)
- [Response Format](#response-format)
- [Pagination](#pagination)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Known Limitations](#known-limitations)
- [Best Practices](#best-practices)

## API Overview

The API provides access to air quality data collected from AirQo's network of
sensors. The endpoints documented here let callers:

- Download processed data at several frequencies (hourly, daily and up)
- Query raw sensor measurements
- Retrieve chart-ready aggregations for dashboards

## API Versioning

- **v2** — base path `/api/v2/analytics` — internal surface.
- **v3** — base path `/api/v3/public/analytics` — public surface, more tightly
  rate-limited.

`data-download` and `raw-data` exist on both versions and accept the same
request body. The chart endpoints are v2 only.

## Authentication

**This service does not authenticate callers itself.** It contains no API-key
check, no bearer-token validation and no auth middleware. Authentication is
performed upstream at the API gateway, which is expected to reject
unauthenticated traffic before it reaches this service.

None of the endpoints documented here require a user identity.

## Rate Limits

Two independent limits apply, both keyed on the client IP (taken from
`X-Forwarded-For`, but only when the immediate peer is a configured trusted
proxy):

| Scope                                      | Limit               |
| ------------------------------------------ | ------------------- |
| Global middleware, every route             | 100 requests / 60 s |
| Additional per-route limit on v3 endpoints | 10 requests / 60 s  |

The v2 endpoints carry no per-route limit — only the global one. Exceeding
either returns **429** with the standard error envelope. The global limit is
fixed in code and is not environment-tunable.

While Redis is unavailable the limiter falls back to per-process counters, so
the effective ceiling becomes approximately `workers × replicas ×` the
configured value until Redis returns.

## Endpoints Covered

| Method | Path                                        | Notes                         |
| ------ | ------------------------------------------- | ----------------------------- |
| POST   | `/api/v2/analytics/data-download`           | Processed data, JSON or CSV   |
| POST   | `/api/v3/public/analytics/data-download`    | Same body, stricter rate cap  |
| POST   | `/api/v2/analytics/raw-data`                | Raw measurements, JSON or CSV |
| POST   | `/api/v3/public/analytics/raw-data`         | Same body, stricter rate cap  |
| POST   | `/api/v2/analytics/dashboard/chart/data`    | Chart-ready series            |
| POST   | `/api/v2/analytics/dashboard/chart/d3/data` | D3-shaped series              |

## Shared Request Fields

All six endpoints accept the fields below. **Field names are case-sensitive and
deliberately mixed** — dates and output options are camelCase, filters are
snake_case.

| JSON field        | Type              | Required            | Default   | Notes                                                     |
| ----------------- | ----------------- | ------------------- | --------- | --------------------------------------------------------- |
| `startDateTime`   | ISO 8601 datetime | **yes**             | —         | Must not be in the future                                 |
| `endDateTime`     | ISO 8601 datetime | **yes**             | —         | Must be after `startDateTime`                             |
| `sites`           | string[]          | one filter required | —         | Site IDs                                                  |
| `device_ids`      | string[]          | one filter required | —         | Device IDs                                                |
| `device_names`    | string[]          | one filter required | —         | See note below                                            |
| `grid_ids`        | string[]          | one filter required | —         | Exactly one grid                                          |
| `cohort_ids`      | string[]          | one filter required | —         | Exactly one cohort                                        |
| `network`         | enum              | no                  | `airqo`   | `airqo`                                                   |
| `device_category` | enum              | no                  | `lowcost` | `lowcost`, `bam`, `gas`, `general`, `mobile`, `satellite` |
| `pollutants`      | string[]          | no                  | `[]`      | Only `pm2_5` and `pm10`                                   |
| `metaDataFields`  | string[]          | no                  | —         | Only `latitude`, `longitude`, `site_id`                   |
| `weatherFields`   | string[]          | no                  | —         | Only `temperature`, `humidity`                            |
| `cursor`          | string            | no                  | —         | Pagination token                                          |

`device_names` and `device_ids` both resolve to the same underlying `device_id`
column, so `device_names` will **not** match a human-readable device name —
supply device IDs for either.

## Validation Rules

Every rule below is enforced server-side and returns **422** with a
`Validation error` envelope naming the offending field.

- Exactly **one** filter family per request (`sites`, `device_ids`,
  `device_names`, `grid_ids` or `cohort_ids`). Zero filters and two filters are
  both rejected.
- At most `MAX_FILTER_VALUES` entries in that filter list — **1000** by
  default.
- At most **one** `grid_id`, and at most **one** `cohort_id`.
- Date window no wider than `MAX_QUERY_DAYS` — **365 days** by default.
- `startDateTime` must not be in the future; `endDateTime` must be strictly
  after it.
- `datatype: "calibrated"` is invalid with `frequency: "raw"`.
- `device_category: "mobile"` requires `frequency: "raw"`.

The `?tenant=` selector has been removed.

## Data Download

`POST /api/v2/analytics/data-download`
`POST /api/v3/public/analytics/data-download`

Processed data at the requested frequency, calibrated by default. Accepts the
shared fields plus:

| JSON field     | Type    | Default          | Allowed values                                          |
| -------------- | ------- | ---------------- | ------------------------------------------------------- |
| `frequency`    | enum    | `daily`          | `raw`, `hourly`, `daily`, `weekly`, `monthly`, `yearly` |
| `datatype`     | enum    | `calibrated`     | `raw`, `averaged`, `calibrated`, `consolidated`         |
| `downloadType` | enum    | `json`           | `json`, `csv`                                           |
| `outputFormat` | enum    | `airqo-standard` | `airqo-standard`, `aqcsv`                               |
| `minimum`      | boolean | `false`          | Minimal column set — excludes metadata and weather      |

Request:

```json
{
  "startDateTime": "2026-01-01T00:00:00Z",
  "endDateTime": "2026-01-02T00:00:00Z",
  "sites": ["site1", "site2"],
  "pollutants": ["pm2_5", "pm10"],
  "device_category": "lowcost",
  "frequency": "hourly",
  "datatype": "calibrated",
  "downloadType": "json",
  "metaDataFields": ["latitude", "longitude"],
  "weatherFields": ["temperature", "humidity"]
}
```

Response:

```json
{
  "status": "success",
  "message": "Data retrieved successfully.",
  "data": [
    {
      "datetime": "2026-01-01T12:00:00Z",
      "device_id": "device1",
      "site_name": "Site A",
      "pm2_5": 15.5,
      "pm10": 25.7,
      "latitude": 0.3476,
      "longitude": 32.5825,
      "temperature": 24.5,
      "humidity": 65.3
    }
  ],
  "metadata": { "total_count": 1, "has_more": false, "next": null }
}
```

With `"downloadType": "csv"` the response is a CSV attachment
(`Content-Type: text/csv`) instead of the JSON envelope.

## Raw Data

`POST /api/v2/analytics/raw-data`
`POST /api/v3/public/analytics/raw-data`

Unprocessed sensor measurements. Takes the shared fields and returns the same
envelope as data-download. It **does** support `"downloadType": "csv"`.

```json
{
  "startDateTime": "2026-01-01T00:00:00Z",
  "endDateTime": "2026-01-02T00:00:00Z",
  "device_ids": ["device1", "device2"],
  "pollutants": ["pm2_5", "pm10"],
  "device_category": "lowcost"
}
```

## Dashboard Charts

`POST /api/v2/analytics/dashboard/chart/data`
`POST /api/v2/analytics/dashboard/chart/d3/data`

Aggregations shaped for dashboard rendering. Both take the same body: the
shared fields plus:

| JSON field         | Type   | Required | Default | Allowed values                                          |
| ------------------ | ------ | -------- | ------- | ------------------------------------------------------- |
| `chartType`        | enum   | **yes**  | —       | `line`, `pie`, `bar`                                    |
| `frequency`        | enum   | no       | `daily` | `raw`, `hourly`, `daily`, `weekly`, `monthly`, `yearly` |
| `organisationName` | string | no       | —       | Label applied to the rendered output                    |

Request:

```json
{
  "startDateTime": "2026-01-01T00:00:00Z",
  "endDateTime": "2026-01-31T00:00:00Z",
  "sites": ["site1", "site2"],
  "pollutants": ["pm2_5"],
  "frequency": "daily",
  "chartType": "line"
}
```

Response — note the additional `chart_type` key:

```json
{
  "status": "success",
  "message": "Chart data retrieved successfully.",
  "chart_type": "line",
  "data": [
    { "datetime": "2026-01-01T00:00:00Z", "site_id": "site1", "pm2_5": 15.5 }
  ],
  "metadata": { "total_count": 1, "has_more": false, "next": null }
}
```

For pie charts `metadata.total_count` counts the aggregated chart points (one
per site), not the underlying rows.

The record shape depends on `chartType`:

- `line` and `bar` → `{datetime, site_id, <pollutant>}`
- `pie` → `{label, value}`, where `value` is the mean for that series

For `pie`, `label` is the **site name** by default. It is only the site ID if
you explicitly request it via `"metaDataFields": ["site_id"]`, since the
cleaning pipeline otherwise strips that column.

## Response Format

Successful data responses use this envelope:

- `status` — always `"success"`
- `message` — human-readable summary
- `data` — the payload
- `metadata` — pagination block: `{total_count, has_more, next}`

The chart endpoints add a `chart_type` key.

All response keys are snake_case.

Errors use the **same four keys** (see [Error Handling](#error-handling)), so a
client can branch on `status` alone and always find `message` populated.

**A query that matches nothing is a success, not an error.** You get `200` with
`status: "success"`, an empty `data`, `total_count: 0`, and a `message` naming
the window:

```json
{
  "status": "success",
  "message": "No data available for the selected period (2025-01-01 to 2025-01-31).",
  "data": [],
  "metadata": { "total_count": 0, "has_more": false, "next": null }
}
```

Every endpoint uses that same wording, so "no data" can be detected once rather
than per endpoint. Check `data` for emptiness — do not treat it as a failure.

## Pagination

`data-download` and `raw-data` return a cursor when more data is available.
**The metadata keys are snake_case.**

```json
"metadata": { "total_count": 1000, "has_more": true, "next": "<cursor token>" }
```

- `total_count` — the number of records in `data` for this page. It is **not**
  a grand total of all matching records.
- `has_more` — whether another page exists.
- `next` — the token to send as `cursor` on the following request.

To page: issue the first request with no `cursor`, then repeat with
`cursor: <metadata.next>` while `metadata.has_more` is `true`.

**Cursors expire after 6 minutes.** They are HMAC-SHA256 signed, so a tampered,
expired or unsigned token is rejected with `Invalid or expired cursor token`.
Fetch each page within 6 minutes of the previous response, and note that tokens
do not survive a `SECRET_KEY` rotation. Cursors are stateless and keep working
during a Redis outage.

## Error Handling

Errors use a consistent envelope. There is **no** `code` key:

```json
{
  "message": "Detailed error message",
  "status": "error",
  "data": null,
  "metadata": null
}
```

Validation failures add an `errors` array describing each offending field:

```json
{
  "message": "Validation error",
  "status": "error",
  "errors": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, Provide exactly one of: sites, device_ids, device_names, grid_ids"
    }
  ],
  "data": null,
  "metadata": null
}
```

| Status  | Meaning                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------- |
| 200     | Success — including "no data", see [Response Format](#response-format)                            |
| **400** | Business-rule failure: the date range scans too much data (below), or an unresolvable data source |
| 404     | Unknown route                                                                                     |
| 405     | Method not allowed                                                                                |
| **422** | Request validation failed — **this is the common one**, not 400                                   |
| 429     | Rate limit exceeded                                                                               |
| 500     | Unhandled server error                                                                            |
| 503     | A required dependency is unavailable                                                              |

**400 when the date range scans too much data.** Every query runs under a
per-request byte ceiling (`BIGQUERY_MAX_BYTES_BILLED`, **1 GiB** by default).
BigQuery checks it while planning the job, so an over-budget request is refused
before anything is scanned — the query never runs and costs nothing. The
response says how far over it went and by how much to cut back:

```json
{
  "status": "error",
  "message": "The requested date range is too large for hourly data: it would scan 5.2 GB of data, above the 1.0 GB limit for a single request. Shorten the date range by about 6x, or request a coarser frequency such as daily, then try again.",
  "data": null,
  "metadata": null
}
```

Bytes are billed per **time partition scanned**, so the date range is the lever
that moves the figure. Narrowing `sites`/`device_ids` does not help — that
filter is applied after the scan. Retry with a shorter window, or split the
window into several requests. Note this ceiling can bite well inside the
365-day `MAX_QUERY_DAYS` cap, especially at `raw` frequency.

## Examples

```python
import requests

BASE = "https://<host>/api/v3/public/analytics"

def fetch_all(params):
    """Page through a result set. Each page must be fetched within 6 minutes."""
    all_data, cursor = [], None

    while True:
        if cursor:
            params["cursor"] = cursor

        body = requests.post(f"{BASE}/raw-data", json=params, timeout=60).json()

        if body.get("status") != "success":
            raise RuntimeError(body.get("message", "request failed"))

        all_data.extend(body["data"])

        meta = body.get("metadata") or {}
        if not meta.get("has_more"):
            return all_data
        cursor = meta["next"]


records = fetch_all({
    "startDateTime": "2026-01-01T00:00:00Z",
    "endDateTime": "2026-01-02T00:00:00Z",
    "device_ids": ["device1", "device2"],
    "pollutants": ["pm2_5", "pm10"],
    "device_category": "lowcost",
})
print(f"Retrieved {len(records)} measurements")
```

```javascript
let allData = [];
let cursor = null;

while (true) {
  const res = await fetchData({ ...params, cursor });
  const body = await res.json();

  allData = allData.concat(body.data);

  if (!body.metadata?.has_more) break;
  cursor = body.metadata.next;
}
```

## Known Limitations

Behaviour that is surprising but current. Please do not build against these.

- **`network` in the request body does not filter.** The value is validated
  against the enum — an unknown value returns 422 — but is then dropped before
  the query is built, so results always come from the AirQo tables regardless
  of what you send.
- **`device_names` matches device IDs**, not names — see
  [Shared Request Fields](#shared-request-fields).
- **Private site/device screening is not currently applied.** The device-registry
  check exists but every request path has it switched off, so results are not
  screened for entries marked private.
- **`grid_ids` and `cohort_ids` would not be screened even when it is on.**
  The registry screens site and device IDs, not the containers that resolve to
  them.
- **500 responses omit CORS and `X-Request-ID` headers**, because the handler
  that produces them runs outside the middleware stack. Browser clients will
  see an opaque failure rather than the JSON body.

## Best Practices

1. **Keep windows modest.** 365 days is the hard cap, but the byte ceiling
   usually bites first — narrower ranges return faster, cost less to serve, and
   avoid the 400 described in [Error Handling](#error-handling).
2. **Filter deliberately.** One filter family per request; keep lists well
   under the 1000-entry cap.
3. **Page promptly.** Cursors expire after 6 minutes.
4. **Request only what you need.** Fewer pollutants and metadata fields means
   less data scanned.
5. **Handle 429 and 503.** Both are expected under load or during a dependency
   outage; retry with backoff.
6. **Treat an empty `data` as a normal result.** It arrives as a 200 with a
   `message` explaining that the period holds no measurements.

---

For further assistance, contact the AirQo API support team at support@airqo.net
