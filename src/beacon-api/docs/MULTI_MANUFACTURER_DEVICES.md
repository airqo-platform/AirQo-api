# Devices from other sensor manufacturers in Beacon

Beacon historically mirrored only AirQo's own monitors. The rest of the AirQo
platform (device registry, Vertex, the ETL pipelines) has carried devices from
other manufacturers for years. This document records how those systems
represent such devices, what Beacon assumed, and the phased plan for closing
the gap. Phase 1 is implemented on this branch.

## 1. How the rest of the platform handles other manufacturers

### Device registry (the API behind Vertex)

- **`network` is the manufacturer.** A device's `network` string names the
  sensor manufacturer or data provider that owns it. Vertex labels the same
  field "Sensor Manufacturer" (`/admin/networks`). Valid values are whatever
  exists in the registry's `networks` collection, exposed through
  `GET /api/v2/devices/networks`. On staging today: `airqo`, `airbeam`,
  `airgradient`, `airly`, `clarity`, `iqair`, `metone`, `plumelabs`,
  `quant-aq` (the `clarity` network query also returns the older `kcca`
  devices through the registry's alias table).
- **`category` is the equipment type**, independent of manufacturer:
  `lowcost`, `bam` or `gas`.
- **External devices carry different identity fields.** Every non-airqo
  device must have a `serial_number`; most also have `api_code` (the full
  manufacturer API URL the registry fetches readings from), `access_code`
  (a per-device vendor credential, never returned by list endpoints) and
  `authRequired`. They have no ThingSpeak `device_number`, `readKey` or
  `writeKey`.
- **Per-network adapters.** `config/definitions/networks.js` plus the
  `adapter` sub-document on each network record describe how to reach the
  manufacturer API: base URL, URL template, auth style, a `field_map` that
  renames vendor fields to AirQo names (`pm02 → pm2_5`, `rco2 → co2` ...).
  AirGradient and IQAir have full adapters; the others are placeholders.
- **Latest reading for any device.**
  `GET /api/v2/devices/feeds/transform/recent?channel=<n>` serves airqo
  devices from ThingSpeak, while `?serial_number=<s>` serves every other
  network through its adapter and returns the normalised fields. A device the
  manufacturer no longer knows returns `404 upstream_device_not_found`.
- **Stored measurements.** `/api/v2/devices/measurements/devices/{id}/recent`
  and `/historical` read the registry's events, which the ETL pipelines
  populate for every network that flows through them. Events carry
  `network`, `device_id`, `device` (name) and `site_id`.
- **Online status** for AirGradient and IQAir devices is refreshed by polling
  the manufacturer API; other external networks report
  `no_device_number` and stay offline.
- **Import.** Vertex's "Register Non-AirQo Device" form (name, sensor
  manufacturer, category, authentication required, tags, serial number,
  device connection URL, description) calls `POST /api/v2/devices/soft`;
  bulk CSV/JSON import uses `POST /api/v2/devices/soft/bulk`.

### Vertex

Vertex lists every network's devices side by side and shows the manufacturer
on each device page. For AirQo devices it renders live readings from the
ThingSpeak feed endpoint. For other manufacturers it shows registry metadata
and the last-active timestamp only; it makes no measurement call.

### Workflows (ETL) and BigQuery

- `DeviceNetwork` enum: metone, airqo, urbanbetter, iqair, nasa, kcca,
  airbeam, plumelabs, tahmo, purpleair, airgradient, copernicus, openweather,
  nomads.
- The low-cost DAGs pull **every** network's low-cost devices and dispatch
  per device on `network`: ThingSpeak for airqo, a registered adapter
  (`airqo_etl_utils/sources/`) for iqair, airgradient, airbeam, metone
  (AirNow), tahmo. Vendor-specific DAGs cover AirNow BAMs, PurpleAir,
  PlumeLabs and AirBeam.
- All networks share the raw and hourly BigQuery tables; rows are told apart
  by the `network` and `device_category` columns. The row key is
  `device_id` = registry device **name**. BigQuery's `device_manufacturer`
  column is simply the network string.
- Only `network == "airqo"` rows are calibrated.

### Analytics API

The raw-data endpoint Beacon's cohort performance path calls accepts a
`network` of `airqo`, `iqair`, `airnow` or `metone` only.

## 2. What Beacon assumed before this branch

- Device sync, device list, single-device, cohort and grid paths all dropped
  any platform device whose network was not `airqo`.
- Measurement ingest was ThingSpeak only: the nightly job selected devices
  with a channel number and read key, and stored feeds in
  `sync_raw_device_data` / `sync_hourly_device_data` / `sync_daily_device_data`
  keyed by `channel_id` with generic `field1..field20` columns.
- Everything downstream (latest readings, online counts, performance,
  collocation, inlab, daily diagnostics) reads those tables, so a device
  without a ThingSpeak channel simply has no data.
- `DeviceProfile` (per-profile telemetry mappings, vendor link) and `Vendor`
  already exist and are hardware-agnostic, but were only ever populated for
  AirQo profiles (`lowcost`, `lowcost_gas`, `bam`).

## 3. Phase 1 (this branch): mirror every manufacturer's devices

Goal: devices from other manufacturers appear in Beacon with their
manufacturer, identity and category, exactly as Vertex shows them, without
pretending to have ThingSpeak data.

- **Networks are mirrored.** New `sync_network` table and
  `POST /api/v1/networks/sync` pull the platform's networks list.
  `GET /api/v1/networks/` lists them with per-network device counts (total,
  deployed, online, ThingSpeak-readable, manufacturer-API-readable).
- **Devices keep their manufacturer identity.** `sync_device` gains
  `serial_number`, `api_code` and `auth_required`; `network_id` is indexed.
  Device payloads expose them plus a derived `data_source`:
  `thingspeak`, `external_api` or `none`.
- **The airqo-only filter became an allow-list.** `ENABLED_NETWORKS`
  (comma-separated) limits which networks are mirrored; empty (the default)
  mirrors every network. The same rule is applied at every former airqo-only
  ingress: device sync, device list, single device, local cohorts, platform
  cohorts, grid performance.
- **Device list filter.** `GET /api/v1/devices/synced?network=airqo,airgradient`
  and `GET /api/v1/devices/?network=...` narrow by manufacturer.
- **Profiles are resolved per manufacturer.** A device from network `X` with
  category `C` is assigned the profile named `X_C` (e.g. `airgradient_lowcost`)
  when one exists; otherwise it stays unassigned. The plain `lowcost`,
  `lowcost_gas` and `bam` profiles describe AirQo hardware on ThingSpeak and
  are only used for airqo devices.
- **ThingSpeak sync is explicit about eligibility.** Only airqo-network
  devices with a channel number and read key are fetched, so external
  devices that happen to carry a numeric identifier are never treated as
  ThingSpeak channels.
- **Cohort performance via analytics raw-data** groups devices by
  (network, category) and skips networks the analytics API does not accept,
  instead of sending every device as `airqo`.

Not changed in Phase 1: online/offline counts, performance, collocation,
inlab and daily diagnostics still read the ThingSpeak-shaped local tables, so
external devices show no readings and count as offline. That matches Vertex's
behaviour today.

## 4. Phase 2 (this branch): readings for external devices

Goal: external devices get readings in the same local tables airqo devices
use, so latest readings, online status, performance, collocation and daily
diagnostics work for every manufacturer without special cases downstream.

**Three data sources, closest to the device first.** AirQo devices are read
straight from ThingSpeak because it offers per-channel history by date range
with a per-device key. Manufacturer APIs differ, so external devices combine:

1. *Live feed* (`poll_external_feeds`, every `EXTERNAL_FEED_POLL_MINUTES`,
   default 60; `POST /api/v1/data-sync/poll-external-feeds` on demand). The
   registry's `GET /devices/feeds/transform/recent?serial_number=` calls the
   manufacturer API through the per-network adapter, applies the vendor
   credentials server-side and returns the latest reading with AirQo field
   names. Beacon stores it as one raw sample (the reading's own timestamp
   when the manufacturer supplies one, otherwise the poll time) and refreshes
   that hour's and day's aggregates from every stored sample. Near real-time
   latest readings and online status, no vendor secrets in beacon. Limited to
   networks with a working adapter (`EXTERNAL_FEED_NETWORKS`, default
   airgradient and iqair).
2. *Direct history* (`DIRECT_SOURCES`). Manufacturer APIs with per-device
   history by date range, read with beacon's own credentials. The first is
   AirGradient's authenticated raw endpoint (`AIRGRADIENT_API_TOKEN`,
   `AIRGRADIENT_BASE_URL`), in 12-hour chunks, for devices shared privately
   with the account (`authRequired` true in the registry). Public "world"
   devices expose a snapshot only and fall through to the next source.
   IQAir's device URL returns a fixed historical block with no window
   control, and Met One is only reachable through AirNow by bounding box, so
   neither has a direct source yet.
3. *Analytics raw-data* (fallback). The ETL pipelines write every network's
   measurements to the same BigQuery raw table, tagged with the device's
   network, and `POST /analytics/raw-data` serves them by device name. Used
   for devices without a direct source and whenever a direct fetch fails. Its
   request model validated `network` against a short enum; this branch widens
   that enum in the analytics service, and beacon falls back to
   `network=airqo` on a 422 from an older deployment (the value is validated
   but not used in the query).

**Source keys.** The local tables stay keyed by `channel_id`, but the key is
now `device_source_key`: the ThingSpeak channel number for airqo devices and
the registry device id for every other manufacturer (unique, stable, and
immune to vendor serial numbers that look like channel numbers). Every read
path that joined on `device_number` now resolves through that helper.

**Manufacturer profiles.** Named fields (`pm2_5`, `pm10`, `temperature`,
`co2` ...) are placed into `field1..field20` through the device's
`<network>_<category>` profile. `manufacturer_profiles.py` seeds
`airgradient_lowcost`, `iqair_lowcost`, `clarity_lowcost`, `kcca_lowcost`,
`airbeam_lowcost` and `metone_bam`, each with a vendor row. The external
low-cost layout keeps PM2.5, PM10, location, battery, temperature and
humidity in the same slots as the AirQo lowcost profile and leaves the
second-sensor slots empty; the external BAM layout follows the AirQo BAM
concentration slots. Reads label slots back through the same profile, so an
external device's averages come out as `PM2.5`, `PM10`, `Ambient Temperature`.

**The nightly job.** `external_sync_service.sync_external_device_data` runs
after the ThingSpeak sync (`EXTERNAL_SYNC_ENABLED`, default on) and on demand
through `POST /api/v1/data-sync/sync-external`:

1. seed/assign manufacturer profiles;
2. select devices whose data source is `external_api`;
3. per device, find the days in the window without a complete daily record;
4. devices with a direct source fetch those days from the manufacturer;
5. the rest (and any device whose direct fetch failed) are grouped by
   (network, category), chunked into 50 device names and 7-day segments per
   analytics request, with cursor pagination and 429/5xx backoff;
6. upsert raw rows (`entry_id` = reading epoch second) and recompute the
   hourly and daily aggregates.

Retention cleanup stays with the ThingSpeak job, which runs first.

**Known limits.**

- External rows are as fine-grained as the pipeline's raw table (about every
  10 minutes for adapter-ingested networks), so raw-frequency uptime for
  them is lower than for 2-minute ThingSpeak feeds; hourly and daily
  frequencies compare like for like.
- Met One BAM rows from AirNow land in the general hourly table, not the BAM
  raw table the analytics endpoint reads for `device_category=bam`, so they
  only appear once the pipeline writes them there.
- Networks with no ingestion path (airbeam, plumelabs, airly, quant-aq)
  return no rows and stay offline.
- Live-feed samples for IQAir carry the poll time, not a device timestamp,
  so repeated polls of an unchanged reading store repeated samples.
- `POST /api/v1/networks/profiles/seed` re-seeds profiles and assigns them
  to devices without one; operator edits to a profile's slot layout are
  never overwritten.

## 5. Phase 3: manufacturer-aware operations

- Link `sync_network` to `vendor` so firmware, profiles and stock can be
  grouped by manufacturer.
- Surface per-manufacturer health in the fleet overview and cohort/grid
  summaries.
- Decide whether manufacturer credentials (`access_code`, network API keys)
  ever need to live in Beacon; today they stay in the registry and Beacon
  only calls registry endpoints.

## 6. Open questions

- The registry's `network=` filter treats a comma-separated value as one
  literal string unless every value is in its alias table, so Beacon passes
  the filter through unchanged and expects one network per request on the
  platform-backed device list.
- Several placeholder networks (airly, plumelabs, quant-aq) have no devices
  on staging and no adapter; they will list with zero devices.
