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
  `device_names` or `grid_ids`). Zero filters and two filters are both
  rejected.
- At most `MAX_FILTER_VALUES` entries in that filter list — **1000** by
  default.
- At most **one** `grid_id`.
- Date window no wider than `MAX_QUERY_DAYS` — **365 days** by default.
- `startDateTime` must not be in the future; `endDateTime` must be strictly
  after it.
- `datatype: "calibrated"` is invalid with `frequency: "raw"`.
- `device_category: "mobile"` requires `frequency: "raw"`.

The `airqlouds` filter and the `?tenant=` selector have both been removed.
Requests still sending `airqlouds` fail the one-filter check with an
explanatory message rather than being silently ignored.

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
  "total_records": 1,
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

Response — note the `chart_type` key and the **absence of `total_records`**:

```json
{
  "status": "success",
  "message": "Chart data retrieved successfully.",
  "chart_type": "line",
  "data": [
    { "datetime": "2026-01-01T00:00:00Z", "site_id": "site1", "pm2_5": 15.5 }
  ],
  "metadata": null
}
```

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
- `total_records` — records in this page, **after** cleaning
- `metadata` — pagination block, or `null`

The chart endpoints differ: they add `chart_type` and omit `total_records`
entirely.

All response keys are snake_case.

## Pagination

`data-download` and `raw-data` return a cursor when more data is available.
**The metadata keys are snake_case.**

```json
"metadata": { "total_count": 1000, "has_more": true, "next": "<cursor token>" }
```

- `total_count` — rows in the current page as returned by the query, before the
  cleaning pipeline runs. It is **not** a grand total of matching records, and
  it can exceed `total_records` when deduplication removes rows.
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

| Status  | Meaning                                                         |
| ------- | --------------------------------------------------------------- |
| 200     | Success                                                         |
| **400** | Business-rule failure, e.g. an unresolvable data source         |
| 404     | Unknown route                                                   |
| 405     | Method not allowed                                              |
| **422** | Request validation failed — **this is the common one**, not 400 |
| 429     | Rate limit exceeded                                             |
| 500     | Unhandled server error                                          |
| 503     | A required dependency is unavailable — see below                |

**503 on privacy filtering.** `data-download` and `raw-data` strip private
sites and devices by consulting the device-registry service. If that service is
unreachable these endpoints **fail closed** with `Unable to verify site/device privacy status. Please try again later.` If every requested ID turns out to be
private, the filter becomes empty and the caller receives a normal 200 with
`data: []`.

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
- **500 responses omit CORS and `X-Request-ID` headers**, because the handler
  that produces them runs outside the middleware stack. Browser clients will
  see an opaque failure rather than the JSON body.

## Best Practices

1. **Keep windows modest.** 365 days is the hard cap, but narrower ranges
   return faster and cost less to serve.
2. **Filter deliberately.** One filter family per request; keep lists well
   under the 1000-entry cap.
3. **Page promptly.** Cursors expire after 6 minutes.
4. **Request only what you need.** Fewer pollutants and metadata fields means
   less data scanned.
5. **Handle 429 and 503.** Both are expected under load or during a dependency
   outage; retry with backoff.

---

For further assistance, contact the AirQo API support team at support@airqo.net
