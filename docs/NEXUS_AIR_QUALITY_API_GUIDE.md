# Nexus Air Quality API Guide

> **Audience:** Frontend engineers working on the AirQo Nexus redesign. This covers the endpoints built in response to the Nexus backend requirements doc: nearby air quality, African AQI rankings, historical comparisons, the dynamic AQI legend — plus chart configuration.

**Updates since this guide was first shared:**
1. Section 1's claim that device-registry and analytics were "now aligned" on AQI colors/breakpoints was premature — corrected below.
2. Section 4 didn't include the actual endpoint path, which caused a mix-up with a different, similarly-named endpoint (`grids/nearby`, which returns polygons, not readings) — the correct path is now included.
3. Section 5 previously pointed at the wrong endpoint (a per-user preference feature, not a group-wide default). The real capability didn't exist, so it was built — then refined to support multiple devices/sites per saved default.
4. Direction changed again: rather than a group-wide default, users now configure their own chart locations and settings even within a group. Section 5 now documents the personal chart endpoints (no more `deviceId` in the URL, plus new `subTitle` and per-location `locationColors` fields) as the one to build against; the group-default endpoints are still there but no longer the recommended path.

---

## Overview

All five capabilities from the requirements doc are ready to integrate, including chart configuration (section 5).

Everything below is described in terms of what you send and what comes back. Base URL and request conventions (headers, error format) match the rest of the AirQo API you're already integrating with.

---

## 1. AQI legend / ranges

**`GET /api/v2/devices/aqi-ranges`**

Returns the AQI bands used across AirQo — labels, colors, and numeric ranges — so the legend can be built dynamically instead of hard-coded.

No parameters required.

Response gives you an ordered list of bands (Good → Hazardous), each with a label, a min/max PM2.5 range, a hex color, and a color name. The list also identifies which AQI standard is in effect, plus a `version` number and `effective_from` timestamp that change whenever an admin updates the config — useful if you (or any other service) want to detect a change without deep-comparing the ranges array.

**Correction:** this guide previously said device-registry and analytics had been reconciled onto the same AQI boundaries/colors and were "now aligned." That was premature — **they are not currently aligned.** Device-registry uses the boundaries this endpoint returns; analytics still has its own separate, older hardcoded copy. Bringing analytics in sync (properly — fetching and caching this config, not a one-time value copy) is real, scoped work now in progress on the analytics side. Until then, don't assume analytics-sourced chart colors will match this legend.

---

## 2. African AQI rankings (leaderboard)

**`GET /api/v2/devices/readings/rankings`**

Returns a ranked list of African countries or cities by current air quality, for a leaderboard view.

| Parameter | Required | Notes |
|---|---|---|
| `level` | No | `country` (default) or `city` |
| `sort` | No | `best` (default, cleanest first) or `worst` (most polluted first) |
| `limit` | No | Default 20, max 100 |

Each ranked entry includes: rank position, name, country code (country-level only), average PM2.5, the derived AQI value and category, how many monitoring sites contributed, and when the ranking was generated.

**Open questions, undocumented in the requirements doc:**
- **Default sort order.** Currently defaults to cleanest-first ("best"). IQAir/WAQI-style "worst air quality" leaderboards typically lead with the most polluted place. Worth a gut-check on which framing fits Nexus.
- **Freshness window.** Rankings only include a location if it has a reading from the last 3 days. A country/city with no recent data just won't appear in the list — it isn't shown as zero or "no data," it's simply absent. Site count is included per entry so you can show a confidence indicator if useful.

---

## 3. Historical African comparison (year-by-year)

**Team direction, read this first:** going forward, anything requiring genuinely deep/multi-year history should be sourced from `analytics`, not this endpoint — that's where real long-term historical data actually lives. The endpoint below still exists and works, but treat it as a device-registry-side capability with growing-but-limited depth (see the coverage note), not the long-term answer for historical comparisons. Check with the backend team on the `analytics` equivalent's status before building against this one for anything beyond recent history.

**`GET /api/v2/devices/readings/rankings/history`**

Returns multi-year air quality history per country or city, shaped for a table with entities as rows and years as columns.

| Parameter | Required | Notes |
|---|---|---|
| `level` | No | `country` (default) or `city` |
| `start_year` | Yes | 4-digit year |
| `end_year` | Yes | 4-digit year, must be ≥ `start_year`, and the span is capped at 5 years |

Each entity in the response includes its name, country code (country-level only), and a list of yearly values — average PM2.5, derived AQI category, and how many sites contributed that year.

**Important for rendering:** a year with no usable data comes back as `null`, never `0`. Please don't treat a missing year as "clean air" — render it as "no data" (grayed out, dash, etc.).

**Coverage note, please read before demoing this:** this data is built up by a daily background process, not computed live — which also means it only accumulates from whenever that process started running. If you request years before that, you'll correctly get "no data" for them (never an error, never zero). In practice this means real historical depth builds up gradually over time rather than being available immediately for past years.

**Scope note:** this is annual granularity only for now. Monthly/daily historical rollups are a larger effort and aren't in this round — flag if that's a near-term blocker.

---

## 4. Nearby air quality (GPS-based)

**`GET /api/v2/devices/readings/nearest`**

| Parameter | Required | Notes |
|---|---|---|
| `latitude` | Yes | Valid latitude |
| `longitude` | Yes | Valid longitude |
| `radius` | No | Search radius in km, default 15 |
| `limit` | No | Default 5 |

Returns nearby monitoring locations with distance, pollutant values, and a nearest-city fallback when nothing is within radius. Each result includes `is_stale` and `data_age_minutes` fields so the frontend can visually flag stale readings.

**Important — do not confuse this with `GET /api/v2/devices/grids/nearby`.** That's a different, existing endpoint that returns grid *polygons*, not individual site readings. If you tested "nearby" and got polygon/boundary data back instead of pollutant values, that's the one you hit — this section's endpoint (`readings/nearest`) is the correct one for site-level air quality.

We're intentionally not introducing a second nearby-readings endpoint — there were multiple overlapping ones already, and consolidating onto this one avoids fragmenting behavior further.

---

## 5. Chart configuration

**Direction change:** earlier drafts of this section covered group-wide *default* charts (one shared config every group member sees). Per direction from the Nexus side, that's no longer the model going forward — users configure their own locations and chart settings even within a group, rather than inheriting someone else's defaults. **Personal chart configuration is what you should build against.** The group-default endpoints still exist and still work (documented lower down for completeness), but they're not the recommended path anymore.

### Personal chart configuration (build against this)

`/api/v2/users/preferences/charts...` — keyed on `user_id` + `group_id`, each chart belongs to one user. Lives in **auth-service**.

**Scoped by `device_ids`/`site_ids` arrays, not a single device.** This changed since the last version of this doc — there's no `deviceId` in the URL anymore. One chart can compare multiple locations at once (e.g. Kampala + Jinja together), so scope is two arrays on the chart itself. At least one of `device_ids`/`site_ids` must be provided and non-empty.

**Two new chart fields, both raised as gaps in the previous version of this endpoint:**
- **`subTitle`** — was present on the old netmanager preference doc but missing from the new chart-config object; it's back, as a field on each individual chart (alongside `title`).
- **`locationColors`** — lets you assign a distinct color per selected device/site, so a multi-location chart doesn't default to one color throughout (e.g. Kampala in red, Jinja in yellow). Each entry is `{ "id": "<deviceOrSiteId>", "color": "<hex>" }`, and every `id` used here must already be present in that chart's `device_ids` or `site_ids` — assigning a color to a location the chart doesn't include is rejected. If a selected location has no entry in `locationColors`, it falls back to the chart-wide `color` field (unchanged, still there).

#### Create a chart
`POST /api/v2/users/preferences/charts`

```json
{
  "group_id": "<optional, defaults to your default group>",
  "device_ids": ["<kampalaDeviceId>", "<jinjaDeviceId>"],
  "site_ids": [],
  "chartConfig": {
    "fieldId": 1,
    "title": "PM2.5 — Kampala vs Jinja",
    "subTitle": "Last 7 days",
    "chartType": "Line",
    "locationColors": [
      { "id": "<kampalaDeviceId>", "color": "#FF0000" },
      { "id": "<jinjaDeviceId>", "color": "#FFFF00" }
    ]
  }
}
```
`chartConfig.fieldId` (1–8) is required; every other chart field you already know (`chartType`, `days`, `results`, `referenceLines`, `comparisonPeriod`, `showLegend`, etc.) is unchanged and still supported.

#### Update a chart
`PUT /api/v2/users/preferences/charts/:chartId` — partial update, send only what's changing. No `deviceId` in the URL. `device_ids`/`site_ids` can be included to change scope, but the chart can't end up with both empty — clearing both in one request is rejected.

```json
{
  "subTitle": "Last 30 days",
  "locationColors": [{ "id": "<kampalaDeviceId>", "color": "#00AA00" }]
}
```

#### Delete a chart
`DELETE /api/v2/users/preferences/charts/:chartId` — no body, no `deviceId` in the URL.

#### List your charts
`GET /api/v2/users/preferences/charts` — returns every chart you've configured for a group. Optional query params: `?group_id=` (defaults to your default group), `?device_id=`, `?site_id=` (narrows to charts scoped to that location).

#### Get a single chart
`GET /api/v2/users/preferences/charts/:chartId`

#### Copy a chart
`POST /api/v2/users/preferences/charts/:chartId/copy` — duplicates a chart (including its `device_ids`/`site_ids`/`locationColors`) as a new one, titled `"<original title> (Copy)"`.

All of the above require the same auth header you're already using elsewhere, and `chartId` alone is enough to identify a chart for update/delete/get/copy — you don't need to also pass `group_id` for those.

### Group-wide default charts (still live, not the recommended path)

`/api/v2/users/preferences/groups/:grp_id/charts...` — one shared config per group, read by any member, written by managers/admins only. Same `device_ids`/`site_ids`/`chartConfig` shape as above. Kept working in case shared defaults come back into scope later, but don't build new work against this unless told otherwise.

**On the duplicate-values error some testers hit separately:** that isn't from either chart endpoint family — it comes from the general `POST /api/v2/users/preferences/` (plain create) endpoint. That one legitimately fails with a duplicate-key conflict for any user who already has a preference doc for that group, which is the common case, not an edge case — `POST /upsert` is the endpoint meant to be called repeatedly. The error response now includes a hint saying exactly that.

---

## Notes for the redesign conversation

A few observations from working through this, offered as input rather than a prescription:

- Since the redesign has leaned mobile-app/personalized over standard-dashboard, it's worth deciding **before** wiring these endpoints up whether the rankings/legend/history views are meant to be the primary, IQAir/WAQI-style entry point, or a secondary personalized layer — it changes how prominently they should feature in the layout.
- Rankings and historical data are both scoped to Africa by design (matching the requirements doc). If there's ever a need to show a non-African location for context, that would need a small parameter addition — worth flagging now if it's on the roadmap rather than later.
- Because "no recent data" and "zero pollution" are different things in this API (see sections 2 and 3), it's worth settling on one consistent visual treatment for "no data" across the leaderboard, the historical table, and the nearby view before implementation, rather than each screen inventing its own.
