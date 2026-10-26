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
  `thingspeak`, `external_api` or `none`. `none` means beacon has no live
  path to the device (no channel, serial number or connection URL); such a
  device can still be backfilled from the analytics fallback by name.
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
2. *Direct manufacturer sources.* Two kinds, per what AirGradient's public
   API spec (`/public/docs/api/v1/swagger.json`) actually offers:
   - *Public current readings, no credential at all* (`DIRECT_LIVE_SOURCES`).
     `GET /world/locations/measures/current` returns the current reading of
     every device shared to the AirGradient world map in one tokenless call
     (about 2,900 locations worldwide); `/world/locations/{id}/measures/current`
     does the same per device. The poll fetches the bulk payload once and
     serves every public AirGradient device from it, so their latest readings
     need neither the platform nor a vendor token. A device that is not on
     the public map falls back to the registry feed. The location id is the
     registry serial number, else parsed from the API URL or the `ag_<id>`
     device name.
   - *History with beacon's own credential* (`DIRECT_SOURCES`). AirGradient's
     `GET /locations/{id}/measures/past?token=&from=&to=` returns 5-minute (or
     60-minute, for older data) buckets for any window, but only for locations
     that belong to or are shared with the token's account
     (`AIRGRADIENT_API_TOKEN`; `authRequired` true in the registry). There is
     no public history endpoint: a public device's history can only be
     accumulated by polling or taken from the analytics fallback.
   IQAir's device URL returns a fixed historical block with no window
   control, and Met One is only reachable through AirNow by bounding box, so
   neither has a direct source yet.
3. *Analytics raw-data* (fallback). The ETL pipelines write every network's
   measurements to the same BigQuery raw table, tagged with the device's
   network, and `POST /analytics/raw-data` serves them by device name. Used
   for devices without a direct source and whenever a direct fetch fails. No
   change to the analytics service is needed. Its request model validates
   `network` against a short list (`airqo`, `iqair`, `airnow`, `metone`), but
   the export never uses that value in the query: rows are selected by device
   name and each row keeps its own `network` column. So beacon sends the
   device's own network when analytics accepts it and `airqo` otherwise
   (`analytics_request_network`). Verified on staging: `network=airqo` with an
   AirGradient device name returns that device's rows, tagged `airgradient`.

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

## 5. Phase 3 (this branch): per-manufacturer diagnostics

The IoT diagnostic engine is profile-driven and vendor-agnostic. It builds
its model from a profile's components (type, criticality), their metrics
(telemetry key, expected range, maximum rate of change per hour, role) and
the relationships between components, using a generic vocabulary only:
POWERS / COOLS / COMMUNICATES_VIA dependencies, MEASURES_SAME_AS redundancy,
a `connectivity` component that delivers the data, and the `charge_level`,
`charge_source` and `signal_strength` metric roles. Evidence codes are
generic too (`METRIC_BELOW_MIN:<component>.<metric>`, `METRIC_STUCK:...`,
`METRIC_RATE_EXCEEDED:...`, `DATA_GAPS:<link>`), and root causes come from
the component graph, not from vendor rules. A profile is diagnosable as soon
as it has components with at least one telemetry-mapped metric or a
connectivity component.

Phase 2 seeded the manufacturer profiles with slot layouts only, so the daily
job skipped their devices. Phase 3 gives each one a component model
(`manufacturer_profiles.MANUFACTURER_COMPONENT_MODELS`), attached when the
profile is created and retro-fitted to profiles that have none; profiles an
operator has already modelled are never touched.

| Profile | Components | What the engine can detect |
|---|---|---|
| `airgradient_lowcost` | pm_sensor (pm2_5, pm10, pm1), gas_sensor (co2, tvoc, nox), environment_sensor, wifi_modem (connectivity, wifi_rssi as signal_strength), controller (boot_count), mains_power | out-of-range and stuck readings, weak WiFi (RSSI below -85 dBm), reboot storms (boot counter rising more than 2 per hour), data gaps on the WiFi link, mains power suspected when every dependent fails |
| `iqair_lowcost` | pm_sensor (pm2_5, pm10), gas_sensor (co2), environment_sensor, data_link, mains_power | out-of-range and stuck readings, data gaps |
| `metone_bam` | bam_sensor (pm2_5, realtime_conc, short_time_conc), environment_sensor (temperature, humidity, pressure, wind), data_link, mains_power | out-of-range and stuck concentrations, data gaps |
| `clarity_lowcost`, `kcca_lowcost`, `airbeam_lowcost` | generic single-PM model: pm_sensor, environment_sensor, data_link, mains_power | out-of-range and stuck readings, data gaps, once data flows |

Each model also sets a `reporting_interval` default (600 s for AirGradient,
whose pipeline readings arrive every 10 minutes; 3600 s for the others) so
outage detection uses a sensible gap threshold. Per-device overrides go
through the device's config values as for AirQo devices. The data-gap check
itself counts hours with no reading at all, so hourly live-feed samples do
not register as gaps.

What external devices cannot get: the two-sensor divergence check (one PM
sensor), and charge or solar analysis (mains powered). CO2, WiFi signal and
boot counter only reach beacon through the live feed or AirGradient's direct
history, not through the analytics fallback.

`GET /api/v1/networks/profiles` reports each manufacturer profile as the
engine sees it (diagnosable, components, warnings); the seed endpoint
returns the same readiness after attaching the models. The nightly daily
diagnostics job picks up external devices automatically once their profile
is diagnosable and a complete day of readings exists.

## 6. Later: manufacturer-aware operations

- Link `sync_network` to `vendor` so firmware, profiles and stock can be
  grouped by manufacturer.
- Surface per-manufacturer health in the fleet overview and cohort/grid
  summaries.
- Direct history sources for more manufacturers as their APIs allow, and a
  registry endpoint that hands beacon vendor credentials if holding them in
  config stops being acceptable.

## 7. Open questions

- The registry's `network=` filter treats a comma-separated value as one
  literal string unless every value is in its alias table, so Beacon passes
  the filter through unchanged and expects one network per request on the
  platform-backed device list.
- Several placeholder networks (airly, plumelabs, quant-aq) have no devices
  on staging and no adapter; they will list with zero devices.
