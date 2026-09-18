# AirQo Analytics API Documentation

Reference for the AirQo Analytics data endpoints: request formats, response
structures and usage examples.

This document covers the data and report endpoints below. The service exposes
further routes — scheduled exports, report templates and other dashboard
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
- [Air-Quality Report](#air-quality-report)
- [Response Format](#response-format)
- [Pagination](#pagination)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Best Practices](#best-practices)

## API Overview

The API provides access to air quality data collected from AirQo's network of
sensors. The endpoints documented here let callers:

- Download processed data at several frequencies (hourly, daily and up)
- Query raw sensor measurements
- Retrieve chart-ready aggregations for dashboards
- Generate PM aggregate reports for a grid or a cohort

## API Versioning

- **v2** — base path `/api/v2/analytics` — internal surface.
- **v3** — base path `/api/v3/public/analytics` — public surface, more tightly
  rate-limited.

`data-download`, `raw-data`, `report` and `summary` exist on both versions and
accept the same request body. `forecast-data` is v3 only, and the chart
endpoints are v2 only.

Where an endpoint exists on both, the v3 copy is the same endpoint with the
public surface's constraints applied. For `report` and `summary` that means two
further differences beyond the rate limit:

- The window ceiling is `MAX_PUBLIC_REPORT_DAYS` — **92 days** by default —
  rather than the 365 days v2 allows. It can only tighten: a value set above
  `MAX_QUERY_DAYS` is clamped down to it, so the public surface is never more
  permissive than the internal one.
- On `report`, sites and devices marked private in the device registry are
  dropped from the grid or cohort before the query runs. If the registry
  cannot be reached the request fails with a **503** rather than returning an
  unscreened result. This screening is not user-aware — it withholds the
  caller's own private members too. `summary` is not screened at all; see
  [Air-Quality Report](#air-quality-report) for both caveats.

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

| Method | Path                                        | Notes                                               |
| ------ | ------------------------------------------- | --------------------------------------------------- |
| POST   | `/api/v2/analytics/data-download`           | Processed data, JSON or CSV                         |
| POST   | `/api/v3/public/analytics/data-download`    | Same body, stricter rate cap                        |
| POST   | `/api/v2/analytics/raw-data`                | Raw measurements, JSON or CSV                       |
| POST   | `/api/v3/public/analytics/raw-data`         | Same body, stricter rate cap                        |
| POST   | `/api/v2/analytics/dashboard/chart/data`    | Chart-ready series                                  |
| POST   | `/api/v2/analytics/dashboard/chart/d3/data` | D3-shaped series                                    |
| POST   | `/api/v2/analytics/report`                  | PM aggregates for a grid or cohort                  |
| POST   | `/api/v3/public/analytics/report`           | Same body, shorter window, private members screened |
| POST   | `/api/v2/analytics/summary`                 | Data-completeness counts for a grid or cohort       |
| POST   | `/api/v3/public/analytics/summary`          | Same body, shorter window                           |

## Shared Request Fields

The download and chart endpoints accept the fields below. **Field names are
case-sensitive and deliberately mixed** — dates and output options are
camelCase, filters are snake_case. The report endpoints take a different body;
see [Air-Quality Report](#air-quality-report).

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
- Date window no wider than `MAX_QUERY_DAYS` — **365 days** by default. On the
  v3 copies of `report` and `summary` the ceiling is `MAX_PUBLIC_REPORT_DAYS`
  instead — **92 days** by default.
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

## Air-Quality Report

`POST /api/v2/analytics/report`
`POST /api/v3/public/analytics/report`

PM2.5/PM10 aggregates over a window for **one grid or one cohort**, computed
server-side and returned in a single response. This does not paginate, and
takes a different body from the endpoints above:

| JSON field   | Type              | Required            | Notes                   |
| ------------ | ----------------- | ------------------- | ----------------------- |
| `grid_id`    | string            | one entity required | Report on a grid        |
| `cohort_id`  | string            | one entity required | Report on a cohort      |
| `start_time` | ISO 8601 datetime | **yes**             | Non-zero window         |
| `end_time`   | ISO 8601 datetime | **yes**             | Within `MAX_QUERY_DAYS` |

Supply **exactly one** of `grid_id` / `cohort_id` — zero or both is a 422. The
entity lives in the body rather than the path.

[`/summary`](#endpoints-covered) takes this identical body — the same four
fields, the same exactly-one rule — and answers the other question about the
same subject: how much data exists for that grid or cohort over that window,
as hourly, calibrated and uncalibrated record counts per site and per device.
Use it to check coverage before reading a report's numbers.

### On the public API

The v3 copy is the same endpoint with two constraints added, described in full
under [API Versioning](#api-versioning): a 92-day window ceiling, and private
members dropped before the query runs. One consequence is worth stating
plainly: a grid whose members are **all** private returns a `200` with every
aggregate empty, not a `404`. The grid resolved; its members were simply
withheld, which is the same answer as a window holding no measurements.

Screening is currently **not user-aware**. It withholds every member marked
private, including ones belonging to the caller, so a request on v3 for your
own grid will not show your own private sites — use the v2 endpoint for those
until the filter can tell the difference.

`/summary` is **not** screened on either version. It resolves membership inside
its own SQL, as a join through the grid and cohort metadata tables rather than
as a list the registry could be handed, so screening it means filtering the
result rows instead. That is tracked separately — for now, treat its per-site
and per-device counts as covering private entries too.

Both kinds share one pipeline and differ only in how membership resolves: a
grid resolves to its **sites**, a cohort to its **devices**, both read from
BigQuery metadata rather than an external service. The response reflects that —
a grid report carries `sites: {site_ids, number_of_sites, ...}`, a cohort report
carries `devices: {device_ids, number_of_devices, ...}`.

### Sample request

```bash
curl -X POST http://localhost:5000/api/v2/analytics/report \
  -H "Content-Type: application/json" \
  -d '{
    "grid_id": "64b5f7c2d4a1e80013f9a2b1",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-03-31T23:59:59Z"
  }'
```

For a cohort, swap the identifier — everything else is identical:

```json
{
  "cohort_id": "65a1c9e4b2f7d30014e8c3d2",
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-03-31T23:59:59Z"
}
```

### Sample response

The response below has been shortened in two ways. Each aggregate is shown with
a single record, where a real response holds many, and each record is shown
with one or two of the four PM columns it actually
carries. [Data blocks](#data-blocks) lists every aggregate the endpoint returns
and describes the exact shape of each one.

```json
{
  "airquality": {
    "status": "success",
    "grid_id": "64b5f7c2d4a1e80013f9a2b1",
    "sites": {
      "site_ids": ["64a1...", "64a2..."],
      "number_of_sites": 2,
      "grid name": ["Kampala"]
    },
    "period": {
      "startTime": "2024-01-01T00:00:00+00:00",
      "endTime": "2024-03-31T23:59:59+00:00"
    },
    "daily_mean_pm": [
      {
        "date": "2024-01-01",
        "pm2_5_calibrated_value": 34.21,
        "pm10_calibrated_value": 52.08
      }
    ],
    "diurnal": [{ "hour": 0, "pm2_5_calibrated_value": 41.55 }],
    "mean_pm_by_day_hour": [
      { "day": "Monday", "hour": 0, "pm2_5_calibrated_value": 39.7 }
    ],
    "annual_pm": [{ "year": 2024, "pm2_5_calibrated_value": 33.9 }],
    "monthly_pm": [{ "month": 1, "pm2_5_calibrated_value": 34.2 }],
    "site_mean_pm": [
      {
        "site_name": "Makerere",
        "site_latitude": 0.3313,
        "site_longitude": 32.5702,
        "pm2_5_calibrated_value": 30.1
      }
    ],
    "mean_pm_by_city": [
      {
        "city": "Kampala",
        "month": 1,
        "year": 2024,
        "pm2_5_calibrated_value": 34.0
      }
    ],
    "mean_pm_by_country": [
      { "country": "Uganda", "pm2_5_calibrated_value": 34.0 }
    ],
    "mean_pm_by_region": [
      { "region": "Central", "pm2_5_calibrated_value": 34.0 }
    ],
    "mean_pm_by_day_of_week": [
      { "day": "Monday", "pm2_5_calibrated_value": 35.4 }
    ]
  }
}
```

A cohort report replaces `grid_id`/`sites` with `cohort_id`/`devices`; the
aggregate keys are the same.

`grid name` is **not** the grid's name. It is the list of distinct `city`
values across the rows that survived filtering, so a grid spanning two cities
returns both. The key is `cohort name` on a cohort report, and it holds the
same thing.

### Data blocks

Every aggregate is a **mean of hourly rows**, computed in pandas after a single
BigQuery read. Reading one correctly means knowing three things: what is in the
pool, what the pool is grouped by, and what the mean is taken over.

**The pool.** One query reads the hourly consolidated table for the entity's
resolved members across the window. Two filters narrow it before any
aggregation runs, so rows they remove are absent from **every** block:

- Rows whose `pm2_5_raw_value` is NULL are excluded in SQL. A row carrying a
  calibrated value but no raw value contributes to nothing.
- Rows with no `site_latitude`/`site_longitude` are then dropped, since they
  cannot be grouped by site.

If that leaves nothing, the window counts as holding no measurements and you
get the empty-aggregate `200` shown below.

**The grouping.** Breakdown columns are derived per row from `timestamp`, which
is UTC — so `hour` is a UTC hour and `day` a UTC weekday, not site-local ones
(see [Timestamps](#timestamps)):

| Column       | Derived from             | Values                 |
| ------------ | ------------------------ | ---------------------- |
| `date`       | `timestamp.date`         | `YYYY-MM-DD`           |
| `hour`       | `timestamp.hour`         | `0`–`23`               |
| `day`        | `timestamp.day_name()`   | `Monday` … `Sunday`    |
| `month`      | `timestamp.month`        | `1`–`12`               |
| `month_name` | `timestamp.month_name()` | `January` … `December` |
| `year`       | `timestamp.year`         | four-digit year        |

**The blocks.** The endpoint returns fifteen of them; the sample response above
shows ten.

| Response key             | Grouped by                   | One record per                         | Rounded to           |
| ------------------------ | ---------------------------- | -------------------------------------- | -------------------- |
| `datetime_mean_pm`       | `timestamp`                  | distinct hourly timestamp              | 4 decimal places     |
| `daily_mean_pm`          | `date`                       | calendar day                           | 4 decimal places     |
| `diurnal`                | `hour`                       | hour of day (at most 24 records)       | 4 decimal places     |
| `monthly_pm`             | `month`                      | month number, all years merged         | **2 decimal places** |
| `pm_by_month_name`       | `month_name`                 | month name, all years merged           | 4 decimal places     |
| `pm_by_month_year`       | `month`, `year`              | month within a specific year           | 4 decimal places     |
| `annual_pm`              | `year`                       | year                                   | 4 decimal places     |
| `mean_pm_by_day_of_week` | `day`                        | weekday (at most 7 records)            | 4 decimal places     |
| `mean_pm_by_day_hour`    | `day`, `hour`                | weekday and hour (at most 168 records) | 4 decimal places     |
| `site_mean_pm`           | `site_name`                  | site, across the whole window          | 4 decimal places     |
| `site_monthly_mean_pm`   | `site_name`, `month`, `year` | site and month                         | 4 decimal places     |
| `site_annual_mean_pm`    | `site_name`, `year`          | site and year                          | 4 decimal places     |
| `mean_pm_by_city`        | `city`, `month`, `year`      | city and month                         | 4 decimal places     |
| `mean_pm_by_region`      | `region`                     | region                                 | 4 decimal places     |
| `mean_pm_by_country`     | `country`                    | country                                | **2 decimal places** |

`mean_pm_by_city` is grouped by month and year as well as city, despite the
name — a one-year window over one city returns twelve records, not one.

**What a record holds.** Its group key or keys, plus all four PM columns:
`pm2_5_raw_value`, `pm2_5_calibrated_value`, `pm10_raw_value` and
`pm10_calibrated_value`. The three `site_*` blocks additionally carry
`site_latitude` and `site_longitude`. `daily_mean_pm.date` is formatted
`YYYY-MM-DD` and `datetime_mean_pm.timestamp` as `YYYY-MM-DD HH:MM UTC`.

**How the mean behaves.** Four things worth knowing before you build on these:

- **Nulls are skipped per column, independently.** The four PM values in one
  record can be averaged over different numbers of rows. Only
  `pm2_5_raw_value` is guaranteed present; a group whose `pm10_calibrated_value`
  is null throughout returns `null` for it while the other three are populated.
- **It is unweighted across members.** Every surviving hourly row counts once,
  so a site reporting twenty-four hours a day carries twice the weight of one
  reporting twelve. There is no per-site normalisation. Every block except the
  three `site_*` ones collapses across all members of the entity.
- **Absent groups are omitted, not nulled.** An hour with no measurements has
  no record in `diurnal` at all — do not index the array by hour, and do not
  assume 24 entries.
- **Ordering is ascending by group key**, which for the string-keyed blocks
  means _alphabetical_: `mean_pm_by_day_of_week`, `mean_pm_by_day_hour` and
  `pm_by_month_name` arrive Friday-first and April-first, not chronologically.
  Sort client-side before plotting. `site_mean_pm` is the one exception — it is
  sorted by `pm2_5_calibrated_value` descending, most-polluted site first.

**`diurnal` worked through.** Take a 90-day grid report covering 5 sites. Every
surviving hourly row is bucketed by its UTC hour, ignoring which day it fell
on, and each bucket is averaged. The `hour: 13` record is therefore the mean of
up to 90 × 5 = 450 readings — every 13:00 UTC value from every site across the
quarter. It answers "what does a typical 1 p.m. look like here", and in doing
so flattens away both the day-to-day trend and the differences between sites.
`mean_pm_by_day_hour` is the same construction split by weekday, so its
`{day: "Monday", hour: 13}` record averages only the thirteen or so Monday
13:00 readings from each site.

These two are the only hour-of-day views the service offers — there is no
separate endpoint. For an unaggregated hourly series use
[Data Download](#data-download) or the [chart endpoints](#dashboard-charts).

### Errors and empty windows

This reads hourly consolidated data, so a wide window can exceed the byte
ceiling and return the 400 described in [Error Handling](#error-handling);
around three months is a realistic ceiling at the default 1 GiB.

`404` means the entity could not be resolved — the `grid_id` or `cohort_id` has
no members in BigQuery metadata. That is the same rule everywhere else: an
identifier that does not resolve is a `404`.

A window that resolves but holds no measurements is **not** a `404`. It is a
`200` in the usual shape, with `message` naming the period and every aggregate
present but empty, so you can iterate any of them without a key check:

```json
{
  "airquality": {
    "status": "success",
    "message": "No data available for grid 64b5f7c2d4a1e80013f9a2b1 for the selected period (2024-01-01 to 2024-03-31).",
    "grid_id": "64b5f7c2d4a1e80013f9a2b1",
    "sites": {
      "site_ids": ["64a1...", "64a2..."],
      "number_of_sites": 2,
      "grid name": []
    },
    "period": { "startTime": "...", "endTime": "..." },
    "daily_mean_pm": [],
    "diurnal": []
  }
}
```

### Timestamps

Report timestamps are UTC, matching the download and chart endpoints. The
`diurnal`, `mean_pm_by_day_hour` and `mean_pm_by_day_of_week` breakdowns are
therefore UTC hours and UTC day names, not site-local ones.

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
