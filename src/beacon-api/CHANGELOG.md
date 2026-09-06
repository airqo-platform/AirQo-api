# AirQo Beacon API - Changelog

> **Note**: This changelog consolidates all improvements, features, database migrations, and bug fixes to the AirQo Beacon Service (Device Fleet Management, Diagnostics, WebRTC Remote Operations & Telemetry Sync API).

---

## Version 2.2.0
**Released:** September 6, 2026

### Feature: Visual Canvas Coordinates, Health Snapshots, Telemetry Stream Unpacking & Fleet Sync Hardening

Introduced visual canvas coordinates on hardware component definitions for device layout modeling, implemented device health snapshots and ground truth technician feedback logging, modularized the multi-stage diagnostic engine, propagated device numbers across fleet map and grid synchronization pipelines with connection pool optimizations, and added CSV-packed multi-sensor telemetry unpacking.

<details>
<summary><strong>Visual Canvas Coordinates for Hardware Component Modeling</strong></summary>

- **Database Migration (`alembic/versions/a1b2c3d4e5f6_add_coordinates_to_component_definitions.py`)**:
  - Added `x_coordinate` and `y_coordinate` (`Float`) columns to the `component_definitions` table.
  - Automated migration backfill extracting coordinates from existing `metadata` JSON objects (`metadata->>'x_coordinate'`, `metadata->>'y_coordinate'`).
- **Data Model & Schema Extensions (`app/models/device_schema.py`, `app/schemas/device_schema.py`)**:
  - Added `x_coordinate` and `y_coordinate` to `ComponentDefinition` SQLModel and `ComponentDefinitionBase` / `ComponentDefinitionUpdate` Pydantic schemas.
- **CRUD & REST API Support (`app/crud/crud_diagnostics.py`, `app/api/v1/diagnostics.py`)**:
  - Updated profile component creation and patch endpoints to persist visual placement coordinates.
  - Added automated test coverage in `tests/test_device_profiles_crud.py`.

</details>

<details>
<summary><strong>Device Health Snapshots & Field Technician Feedback Loop</strong></summary>

- **Database Models (`app/models/health.py`)**:
  - `DeviceHealthSnapshot`: Stores overall health score (0.0–100.0), lifecycle state (`HEALTHY`, `DEGRADING`, `SUSPICIOUS`, `LIKELY_FAILURE`, `FAILED`, `RECOVERING`), subsystem breakdown (`power`, `sensors`, `connectivity`), active evidence facts, detected symptoms, and ranked root cause diagnoses.
  - `DiagnosticFeedback`: Captures ground truth from field technicians during maintenance (confirmed cause code, prediction accuracy flag, actions taken, technician notes) for continuous model learning and weight calibration.
- **Diagnostics API Endpoints (`app/api/v1/diagnostics.py`)**:
  - `GET /api/v1/diagnostics/health/{device_id}` — Query the latest device health snapshot and historical lifecycle states.
  - `POST /api/v1/diagnostics/health/{device_id}/assess` — Trigger on-demand health assessment and snapshot generation.
  - `POST /api/v1/diagnostics/feedback` — Submit field technician maintenance verification feedback.

</details>

<details>
<summary><strong>Multi-Stage Diagnostic Engine Pipeline</strong></summary>

- **Structured Diagnostic Services (`app/services/diagnostics/`)**:
  - `evaluator.py`: Orchestrates multi-window telemetry evaluations and overall health scoring.
  - `evidence.py`: Evidence collector calculating operating boundaries, dual-sensor drift, ratio anomalies, and battery degradation.
  - `features.py`: Statistical and signal processing feature extractor over telemetry windows.
  - `reasoner.py`: Hypothesis rule evaluator ranking root causes with confidence percentages and maintenance recommendations.
  - `seeds.py`: Built-in seed templates for AirQo standard monitors (`AirQo-v5-DualPM`, `AirQo-v5-Gas`).
- **Comprehensive Test Suite (`tests/test_diagnostics_engine.py`, `thejson.json`)**:
  - Added end-to-end evaluation tests against real-world multi-channel telemetry fixture (`thejson.json`).

</details>

<details>
<summary><strong>Device Fleet & Maintenance Synchronization Hardening</strong></summary>

- **Device Number Propagation**:
  - Added `device_number` to `MapViewDeviceEntry` (`app/schemas/maintenance.py`) and `SyncedGridSiteDevice` (`app/schemas/grid.py`).
  - Propagated `device_number` through `_build_grid_site_devices` and `_build_mirror_cohort_from_grid` in `app/services/grid_sync_service.py`.
  - Propagated `device_number` through `_build_map_view_devices`, `_make_map_view_entry`, and SSE real-time stream events in `app/services/maintenance_service.py`.
- **Database Session Reuse & Connection Resilience**:
  - Passed active database session (`db`) into map view generation and streaming helpers (`_build_map_view_devices`, `_override_last_active_from_local`, `_resolve_stream_last_active`) to eliminate redundant connection pool checkouts.
  - Added synchronization test suites: `tests/test_maintenance_synced.py` and `tests/test_grid_synced.py`.

</details>

<details>
<summary><strong>Telemetry Normalization & CSV Stream Unpacking</strong></summary>

- **Updated `app/utils/field_mappings.py`**:
  - `normalize_and_unpack_record`: Normalizes `field_N` keys to `fieldN` and unpacks CSV-encoded sensor streams (e.g. `field8` containing comma-separated sensor readings) into discrete slots (`field8`..`field22`).
  - `map_record_from_profile`: Dynamic telemetry mapping supporting both human-readable labels and semantic key output (`use_keys=True`).
  - Expanded static fallback `FIELD_MAPPINGS` dictionaries for `lowcost`, `lowcost_gas`, and `bam`.

</details>

**Files changed:**
- `alembic/versions/a1b2c3d4e5f6_add_coordinates_to_component_definitions.py` [NEW] — Migration adding coordinates to component definitions
- `app/models/health.py` [NEW] — Device health snapshot and technician feedback models
- `app/schemas/device_schema.py` [NEW] — Pydantic schemas for device profiles, components, and coordinates
- `app/schemas/diagnostics.py` [NEW] — Schemas for diagnostics evaluation and feedback
- `app/crud/crud_diagnostics.py` [NEW] — CRUD operations for profiles, components, snapshots, and feedback
- `app/api/v1/diagnostics.py` [NEW] — REST API router for diagnostics and health assessments
- `app/models/device_schema.py` [NEW] — Component definition and profile SQLModel entities
- `app/models/diagnostics.py` [NEW] — Diagnostic template and hypothesis rule models
- `app/services/diagnostics/` [NEW] — Diagnostic evaluator, evidence collector, feature extractor, and reasoner
- `app/services/maintenance_service.py` — Propagated `device_number` and reused db session across map views
- `app/services/grid_sync_service.py` — Propagated `device_number` across grid site devices
- `app/schemas/maintenance.py` — Added `device_number` to `MapViewDeviceEntry`
- `app/schemas/grid.py` — Added `device_number` to `SyncedGridSiteDevice`
- `app/utils/field_mappings.py` — Added CSV-stream unpacking, key normalization, and profile-based mapping
- `README.md` — Added changelog documentation reference
- `tests/test_device_profiles_crud.py` [NEW] — Tests for profile and component CRUD
- `tests/test_diagnostics_engine.py` [NEW] — Tests for diagnostic engine evaluation
- `tests/test_grid_synced.py` [NEW] — Tests for grid sync and device number propagation
- `tests/test_maintenance_synced.py` [NEW] — Tests for maintenance map view and stream events
- `thejson.json` [NEW] — Telemetry fixture for end-to-end drift evaluation

---

## Version 2.1.0
**Released:** September 4, 2026

### Feature: Dynamic Device Profiles, Vendor Management Architecture & Multi-Format Firmware Distribution

Refactored Beacon's rigid single-table category schema into an extensible, multi-tenant hardware architecture. Replaced the legacy `Category` model with dynamic `DeviceProfile` entities, introduced a dedicated `Vendor` entity model to organize hardware manufacturers, added JSONB dynamic telemetry, metadata, and config field mapping dictionaries, and extended firmware management to support multi-artifact downloads (`.bin`, `.hex`, bootloaders) filtered by vendor and version.

<details>
<summary><strong>Vendor Entity & Hardware Manufacturer Management</strong></summary>

- **Created `app/models/vendor.py`**:
  - Implemented the `Vendor` SQLModel/SQLAlchemy model (`id`, `name`, `description`, `created_at`, `updated_at`).
  - Added one-to-many relationship with `DeviceProfile` (`device_profiles`) and `Firmware` (`firmwares`) with foreign key constraints (`ondelete="SET NULL"`).
- **Created `app/schemas/vendor.py`**:
  - Defined `VendorBase`, `VendorCreate`, `VendorUpdate`, `VendorResponse`, and `VendorListResponse` Pydantic schemas.
- **Created `app/crud/crud_vendor.py`**:
  - Implemented `CRUDVendor` with case-insensitive name lookups (`get_by_name`), paginated listing, creation, updates, and cascading-safe deletions.
- **Created `app/api/v1/vendor.py` & Registered in `app/api/api.py`**:
  - `POST /api/v1/vendors/` — Create new hardware vendor.
  - `GET /api/v1/vendors/` — List all vendors with pagination.
  - `GET /api/v1/vendors/{vendor_id}` — Get vendor details with associated device profiles and firmware builds.
  - `PATCH /api/v1/vendors/{vendor_id}` — Update vendor metadata.
  - `DELETE /api/v1/vendors/{vendor_id}` — Remove vendor record with relational protection.

</details>

<details>
<summary><strong>Dynamic Device Profiles & Migration away from Rigid Categories</strong></summary>

- **Database Migration (`alembic/versions/9c3d0e1f2a4b_drop_category_table_and_link_sync_device_to_profiles.py`)**:
  - Added `profile_id` foreign key column to `sync_device` referencing `device_profiles(id)` on delete set null.
  - Backfilled historical `sync_device` rows by mapping legacy category strings (`'lowcost'` -> `lowcost`, `'gas'`/`'lowcost_gas'` -> `lowcost_gas`, `'bam'` -> `bam`).
  - Deprecated and safely dropped the legacy flat `category` table.
- **Alembic Migration (`alembic/versions/e7f8a9b0c1d2_add_vendor_table_and_update_device_profiles_and_firmware.py`)**:
  - Created `vendor` table and added `vendor_id` FK columns to `device_profiles` and `sync_firmware`.
- **Backward-Compatible Category Adapter (`app/crud/crud_category.py`)**:
  - Redirected existing `/api/v1/categories/` endpoints to read from and write to `DeviceProfile` without breaking legacy client integrations.
  - Seamlessly translates `level` <-> `category` and maps legacy column attributes (`config1`–`config10`, `metadata1`–`metadata15`) into the profile's dynamic JSONB dictionaries.
- **Device Service Modernization (`app/services/device_service.py`)**:
  - Rewrote `get_device_metadata`, `get_device_configdata`, `create_device_metadata`, and `create_device_configdata` to inspect `DeviceProfile` mappings.
  - Added case-insensitive name matching with automatic alias resolution (`"gas"` -> `"lowcost_gas"`).

</details>

<details>
<summary><strong>Dynamic Telemetry, Metadata & Config Field Mappings</strong></summary>

- **Updated `app/utils/field_mappings.py`**:
  - Transitioned from static hardcoded dictionary lookups to profile-aware dynamic mapping extractors (`get_field_mapping`, `get_readable_field_label`, `map_feed_fields`).
  - Queries active `DeviceProfile.telemetry_mappings` directly from PostgreSQL JSONB columns with resilient fallback to default presets (`lowcost`, `lowcost_gas`, `bam`).
- **Pydantic Schema Alignment (`app/schemas/firmware.py`, `app/schemas/device.py`, `app/schemas/grid.py`)**:
  - Added `vendor_id` and `file_type` fields to firmware creation and response schemas.
  - Updated device schemas to expose resolved profile names, vendor identifiers, and mapped config values.

</details>

<details>
<summary><strong>Multi-Artifact Firmware Distribution (Bin, Hex & Bootloader)</strong></summary>

- **Updated `app/crud/crud_firmware.py` & `app/api/v1/firmware.py`**:
  - Added support for uploading and downloading distinct firmware artifact types: `bin` (application binary), `hex` (flash hex image), and `bootloader`.
  - Added `download_firmware_file_by_version` with support for HTTP Range requests (`bytes=start-end`) for reliable OTA streaming over cellular IoT links.
  - Added filtering by `vendor_id` on `GET /api/v1/firmware/` and `GET /api/v1/firmware/latest`.

</details>

**Files changed:**
- `app/models/vendor.py` [NEW] — Hardware Vendor database model and relationships
- `app/schemas/vendor.py` [NEW] — Pydantic schemas for vendor lifecycle
- `app/crud/crud_vendor.py` [NEW] — CRUD operations for vendor entities
- `app/api/v1/vendor.py` [NEW] — REST API router for vendor management
- `alembic/versions/e7f8a9b0c1d2_add_vendor_table_and_update_device_profiles_and_firmware.py` [NEW] — Migration for vendor table and FKs
- `alembic/versions/9c3d0e1f2a4b_drop_category_table_and_link_sync_device_to_profiles.py` [NEW] — Migration linking devices to profiles and dropping legacy category table
- `app/api/api.py` — Registered `/vendors` route in central API router
- `app/crud/crud_category.py` — Legacy category CRUD adapter redirecting to `DeviceProfile`
- `app/crud/crud_firmware.py` — Multi-artifact firmware upload and version-based streaming
- `app/api/v1/firmware.py` — Added `file_type` and `vendor_id` parameters to firmware endpoints
- `app/models/__init__.py` — Model registry exports for Vendor and DeviceProfile
- `app/models/firmware.py` — Added `vendor_id` and `file_type` fields
- `app/models/sync.py` — Added `profile_id` FK and relationship to `DeviceProfile`
- `app/schemas/device.py` — Added profile and vendor metadata fields
- `app/schemas/firmware.py` — Added vendor ID and multi-format file types
- `app/services/device_service.py` — Migrated metadata and config persistence to `DeviceProfile`
- `app/utils/field_mappings.py` — Dynamic JSONB field mapping resolution
- `tests/test_vendor_and_profile_firmware_integration.py` [NEW] — Integration test suite verifying vendor, profile, and firmware operations

---

## Version 2.0.0
**Released:** August 28, 2026

### Feature: IoT Diagnostics Engine & WebRTC Remote Diagnostics Signaling

Introduced a comprehensive IoT diagnostics and automated self-test evaluation engine for edge monitoring devices, alongside WebRTC signaling controllers for real-time remote hardware debugging.

<details>
<summary><strong>Dynamic IoT Component Definitions & Threshold Rule Engine</strong></summary>

- **Created `app/models/device_schema.py`**:
  - `DeviceProfile`: Archetype defining hardware family, category, and JSONB mapping tables.
  - `ComponentDefinition`: Subsystems within a device (`battery`, `pm25_sensor_1`, `pm10_sensor_1`, `solar_panel`, `gsm_modem`, `intake_fan`).
  - `MetricDefinition`: Measurable telemetry attributes with min/max operational ranges and rate-of-change boundaries.
  - `ComponentRelationship`: Dependency graphs between hardware components (`powers`, `samples_for`, `controls`).
- **Created `app/services/diagnostics/engine.py` & `seeds.py`**:
  - Diagnostic evaluation engine analyzing incoming device telemetry payloads against defined metric boundaries.
  - Computes sub-component and overall device health states: `healthy`, `degraded`, `failing`, `critical`.
  - Added automated default seed templates for AirQo standard monitors (`AirQo-v5-DualPM`, `AirQo-v5-Gas`).
- **Created `app/api/v1/diagnostics.py` & `app/crud/crud_diagnostics.py`**:
  - `POST /api/v1/diagnostics/log` — Ingest raw diagnostic self-test logs from hardware devices.
  - `GET /api/v1/diagnostics/logs/{device_id}` — Query historical diagnostic logs with status filtering.
  - `POST /api/v1/diagnostics/evaluate-payload` — Run ad-hoc diagnostic evaluations against a profile schema.
  - `POST /api/v1/diagnostics/profiles` — Create customized hardware profiles.

</details>

<details>
<summary><strong>WebRTC Signaling Controllers for Remote Diagnostics</strong></summary>

- **Created `app/models/webrtc.py` & Alembic Migration `c70962eb7ba9`**:
  - Tables for WebRTC diagnostic sessions (`webrtc_sessions`) and ICE/SDP signaling envelopes (`signaling`).
- **Created `app/api/v1/webrtc/` Controller Suite**:
  - `signaling_controller.py`: Endpoints for SDP Offer, SDP Answer, and ICE Candidate exchange between remote diagnostics clients and field hardware gateways.
  - `session_controller.py`: Lifecycle management for WebRTC diagnostic sessions (initiate, heartbeat, terminate).
  - `participant_controller.py`: Role-based participant management for shared multi-engineer diagnostic sessions.
- **Created WebRTC Services (`app/services/webrtc/`)**:
  - `session_service.py`: Session timeout enforcement, state management, and active session registry.
  - `signaling_service.py`: In-memory and database buffering of signaling envelopes.
  - `permission_service.py`: Verification of user permissions before granting remote diagnostic channel access.

</details>

**Files changed:**
- `app/models/device_schema.py` [NEW] — Component, metric, and profile models
- `app/models/diagnostics.py` [NEW] — Diagnostic self-test log models
- `app/models/webrtc.py` [NEW] — WebRTC session and signaling models
- `alembic/versions/7a1e8c9d4b2f_add_iot_diagnostics_and_device_schema_tables.py` [NEW]
- `alembic/versions/8b2f9c0d1e3a_add_profile_field_mappings_and_seed_defaults.py` [NEW]
- `alembic/versions/c70962eb7ba9_add_webrtc_sessions_and_signaling_tables.py` [NEW]
- `app/api/v1/diagnostics.py` [NEW] — REST API router for diagnostics
- `app/api/v1/webrtc/signaling_controller.py` [NEW] — WebRTC signaling endpoints
- `app/api/v1/webrtc/session_controller.py` [NEW] — WebRTC session lifecycle
- `app/api/v1/webrtc/participant_controller.py` [NEW] — Participant controls
- `app/services/diagnostics/engine.py` [NEW] — Diagnostic evaluation engine
- `app/services/diagnostics/seeds.py` [NEW] — Default hardware seed templates
- `tests/test_diagnostics_engine.py` [NEW] — Unit tests for diagnostic evaluation rules

---

## Version 1.9.0
**Released:** July 8, 2026

### Feature: Device Operations Platform, Web Serial Console & WebSocket Streaming

Built the real-time Device Operations Platform enabling remote command dispatching, asynchronous task tracking, and multi-user Web Serial console streaming over WebSockets.

<details>
<summary><strong>Device Operations Framework (Commands, Jobs, Logs & Sessions)</strong></summary>

- **Database Models (`app/models/operations.py`) & Alembic Migration `e49d4549c299`**:
  - `DeviceOperationJob`: Asynchronous device operational jobs with state tracking (`pending`, `running`, `completed`, `failed`).
  - `DeviceOperationCommand`: Individual hardware commands queued for transmission to edge devices.
  - `DeviceOperationLog`: Real-time execution output logs captured during operational sessions.
  - `DeviceOperationSession`: Interactive shell and serial console session records with participant rosters.
- **REST Endpoints (`app/api/v1/operations.py`)**:
  - `POST /api/v1/operations/jobs` — Dispatch operational jobs to devices.
  - `GET /api/v1/operations/jobs/{job_id}` — Query job execution status and step progress.
  - `POST /api/v1/operations/sessions` — Initialize interactive device session.
  - `GET /api/v1/operations/sessions/{session_id}/logs` — Retrieve streaming log records.

</details>

<details>
<summary><strong>WebSocket Web Serial Console & Redis Pub/Sub Streaming</strong></summary>

- **WebSocket Routing & Connection Manager (`app/websockets/routing.py`, `app/websockets/manager.py`)**:
  - Implemented `/ws/devices/{device_id}/serial` providing bi-directional serial terminal streaming.
  - Added token-based single-writer arbitration preventing conflicting commands during multi-user sessions.
- **Redis Service Integration (`app/services/redis_service.py`)**:
  - Leveraged Redis Pub/Sub channels (`device:serial:{device_id}`) for horizontal scaling across multi-worker deployments.
- **Slack Alerting Integration (`app/utils/slack_handler.py`)**:
  - Added automated Slack webhook reporting for critical background exceptions and failed jobs.

</details>

**Files changed:**
- `app/models/operations.py` [NEW] — Operation jobs, commands, logs, and sessions
- `alembic/versions/e49d4549c299_add_device_operations_platform_tables.py` [NEW]
- `app/api/v1/operations.py` [NEW] — Operations REST API router
- `app/services/command.py` [NEW] — Command dispatching and payload formatting
- `app/services/job.py` [NEW] — Asynchronous job orchestrator
- `app/services/log.py` [NEW] — Operational log ingestion service
- `app/services/session.py` [NEW] — Interactive session management
- `app/services/redis_service.py` [NEW] — Redis pub/sub and distributed lock client
- `app/websockets/manager.py` [NEW] — WebSocket connection manager
- `app/websockets/routing.py` [NEW] — Serial terminal WebSocket endpoint
- `app/utils/slack_handler.py` [NEW] — Centralized Slack alerting handler

---

## Version 1.8.0
**Released:** May 28, 2026

### Feature: BAM Reference Device Health, Coordinates Synchronization & Data Caching

Added health status parsing for BAM (Beta Attenuation Monitor) reference devices, added geospatial coordinate propagation across device entities, and optimized local device data caching.

<details>
<summary><strong>BAM Status Health & Telemetry Parsing</strong></summary>

- Extended `app/services/device_service.py` to parse BAM-specific status flags and operational codes (`ConcRT`, `ConcHR`, error conditions).
- Added `bam` field mapping preset in `app/utils/field_mappings.py` for standard BAM 1020/1022 data outputs.
- Updated collocation service to support reference BAM monitors alongside low-cost sensors.

</details>

<details>
<summary><strong>Geospatial Latitude & Longitude Synchronization</strong></summary>

- Propagated latitude and longitude coordinates across `SyncDevice`, `SyncCohort`, and `SyncGrid` schemas.
- Synchronized coordinates from external metadata APIs to ensure accurate placement on fleet maps.

</details>

**Files changed:**
- `app/schemas/device.py` — Added BAM health flags and coordinate fields
- `app/schemas/collocation.py` — Collocation parameters for BAM integration
- `app/services/device_service.py` — BAM health interpretation and local data caching
- `app/services/collocation_service.py` — Reference station integration
- `app/utils/field_mappings.py` — Added BAM field mappings

---

## Version 1.7.0
**Released:** May 12, 2026

### Feature: Multi-Tenant Group Sync Architecture

Introduced automatic synchronization of organization groups from the AirQo Platform API, enabling multi-tenant isolation and group-scoped device fleet management.

<details>
<summary><strong>Group Sync Model & Startup Synchronization Hook</strong></summary>

- **Database Model (`app/models/sync.py`) & Alembic Migration `f6a2b3c4d5e6`**:
  - Added `sync_group` table (`_id`, `name`, `created_at`, `updated_at`).
- **Startup Sync Hook (`main.py: _startup_sync_groups_if_needed`)**:
  - Automatically queries the AirQo Platform API on application startup to seed or update active organization groups.
  - Gracefully skips synchronization if groups already exist or if authentication tokens are unavailable.
- **Group-Scoped API (`app/api/v1/group.py`, `app/services/group_sync_service.py`)**:
  - Endpoints to trigger manual group resynchronization and list registered tenant groups.

</details>

**Files changed:**
- `alembic/versions/f6a2b3c4d5e6_add_sync_groups.py` [NEW] — Migration creating `sync_group`
- `app/models/sync.py` — Added `SyncGroup` model
- `app/services/group_sync_service.py` [NEW] — Group synchronization logic
- `main.py` — Added `_startup_sync_groups_if_needed` hook on application startup

---

## Version 1.6.0
**Released:** May 7, 2026

### Feature: In-Lab Batch Testing & Collocation Lifecycle

Implemented comprehensive batch management for in-lab device testing, sensor calibration, and pre-deployment collocation verification.

<details>
<summary><strong>In-Lab Batch Workflow & Constraints</strong></summary>

- **Database Models (`app/models/sync.py`) & Migrations `a3d0ced5c059`, `d4e7c92f1a85`**:
  - `InlabBatch`: Represents testing batches with status (`active`, `completed`, `cancelled`), target baseline site, and dates.
  - `InlabBatchDevice`: Links devices to batches with snapshot of firmware version at time of addition.
  - Added unique constraint ensuring a device can only be in one active in-lab batch at any time.
- **Batch Management API (`app/api/v1/inlab_batch.py`, `app/services/inlab_batch_service.py`)**:
  - `POST /api/v1/collocation/inlab-batches` — Create new testing batch.
  - `POST /api/v1/collocation/inlab-batches/{batch_id}/devices` — Add devices to batch with firmware snapshots.
  - `DELETE /api/v1/collocation/inlab-batches/{batch_id}/devices/{device_id}` — Remove device from batch.
  - `PATCH /api/v1/collocation/inlab-batches/{batch_id}/complete` — Finalize testing batch.

</details>

**Files changed:**
- `alembic/versions/a3d0ced5c059_add_inlab_batch_tables.py` [NEW]
- `alembic/versions/d4e7c92f1a85_inlab_batch_device_unique_active.py` [NEW]
- `app/models/sync.py` — Added `InlabBatch` and `InlabBatchDevice`
- `app/services/inlab_batch_service.py` [NEW] — In-lab batch business logic
- `app/api/v1/inlab_batch.py` [NEW] — REST endpoints for in-lab batch management

---

## Version 1.5.0
**Released:** May 8, 2026

### Feature: Grid-Based Spatial Air Quality Analysis

Added spatial grid modeling and synchronization, allowing air quality performance analysis aggregated across geographical administrative and custom boundaries.

<details>
<summary><strong>Grid Synchronization & Spatial Analytics</strong></summary>

- **Database Model (`app/models/sync.py`) & Migration `3410806a12d5`**:
  - Added `sync_grid` table storing grid IDs, names, admin levels, and shapefile boundary metadata.
- **Grid Sync Service (`app/services/grid_sync_service.py`)**:
  - Syncs grid definitions from the AirQo Meta-Data Service.
  - Computes spatial device membership based on device latitude/longitude coordinates.
- **Grid REST API (`app/api/v1/grid.py`)**:
  - Endpoints to list grids, fetch devices within a grid, and compute grid-level aggregate performance metrics.

</details>

**Files changed:**
- `alembic/versions/3410806a12d5_add_grids.py` [NEW] — Grid synchronization table migration
- `app/models/sync.py` — Added `SyncGrid` model
- `app/schemas/grid.py` [NEW] — Pydantic schemas for grid entities
- `app/services/grid_sync_service.py` [NEW] — Grid synchronization service
- `app/api/v1/grid.py` [NEW] — Grid REST endpoints
- `tests/test_grid_synced.py` [NEW] — Grid sync validation test suite

---

## Version 1.4.0
**Released:** April 30, 2026

### Feature: High-Throughput ThingSpeak Telemetry Sync Engine

Engineered high-throughput background synchronization pipelines to ingest raw sensor data from ThingSpeak IoT channels into localized PostgreSQL tables with incremental fetching.

<details>
<summary><strong>ThingSpeak Data Sync Architecture</strong></summary>

- **Database Models (`app/models/device_data.py`) & Migration `fe1be7bd352d`**:
  - `SyncDeviceData`: Raw telemetry storage with timestamp indexing.
  - `SyncMetadataValues`: Dynamic metadata values per device.
  - `SyncConfigValues`: Tunable hardware configurations.
  - `SyncFieldValues`: High-resolution channel field values.
- **Sync Pipeline (`app/services/thingspeak_sync_service.py`)**:
  - Incremental chunked fetching prevents HTTP timeouts during backfills spanning multiple months.
  - Handles rate limiting, channel error codes, and automatic retry with exponential backoff.
- **Data Sync Endpoints (`app/api/v1/data_sync.py`)**:
  - Trigger ad-hoc or scheduled synchronizations per device or cohort.

</details>

**Files changed:**
- `alembic/versions/fe1be7bd352d_add_thingspeak_data_sync_tables.py` [NEW]
- `app/models/device_data.py` [NEW] — Telemetry and sync value models
- `app/schemas/data_sync.py` [NEW] — Schemas for sync triggers and status
- `app/services/thingspeak_sync_service.py` [NEW] — ThingSpeak channel sync engine
- `app/api/v1/data_sync.py` [NEW] — Data sync REST API
- `app/crud/crud_device_data.py` [NEW] — Optimized batch insertion methods

---

## Version 1.3.0
**Released:** April 11, 2026

### Fix & Chore: Dual Routing Architecture & Database Connection Resilience

Resolved routing incompatibilities across disparate frontend clients by introducing dual router mounting, and hardened PostgreSQL connection pooling against unexpected server-side drops.

<details>
<summary><strong>Dual Routing Mounting</strong></summary>

- Mounted routers under both `/api/v1` and the root path (`""`) in `main.py`.
- Ensures full backward compatibility with legacy frontends calling `/devices` directly and newer clients calling `/api/v1/devices`.

</details>

<details>
<summary><strong>Connection Pool Stability</strong></summary>

- Configured SQLAlchemy engine with connection recycling (`pool_recycle=1800`), pre-ping validation (`pool_pre_ping=True`), and optimized pool sizing.
- Eliminated intermittent `"server closed the connection unexpectedly"` errors during long-running background tasks.

</details>

**Files changed:**
- `main.py` — Dual router inclusion (`/api/v1` and root prefix)
- `app/db/session.py` — Connection pool hardening
- `README.md` — Updated API routing documentation

---

## Version 1.2.0
**Released:** April 7, 2026

### Feature: Field Collocation Analysis & Entity Synchronization

Introduced Pearson correlation matrix computations for field-collocated monitors and established cohort and site synchronization entities.

<details>
<summary><strong>Collocation Statistical Analysis</strong></summary>

- Computes Pearson correlation coefficients ($r$) and data completeness percentages across collocated device pairs for PM2.5 and PM10.
- Classifies sensor agreement into performance tiers (`good`, `moderate`, `poor`).
- Automated reporting for inter-sensor drift detection.

</details>

<details>
<summary><strong>Cohort & Site Sync Entities</strong></summary>

- Added `sync_cohort` and `sync_site` models (`1b049c103707_add_cohort_site_sync_tables.py`) to maintain local replicas of platform entities for sub-millisecond query latency.

</details>

**Files changed:**
- `alembic/versions/1b049c103707_add_cohort_site_sync_tables.py` [NEW]
- `app/services/collocation_service.py` — Correlation matrix and data completeness calculations
- `app/api/v1/collocation.py` — Collocation REST endpoints
- `app/services/cohort_service.py` — Cohort assignment and sync
- `app/services/site_service.py` — Site metadata synchronization

---

## Version 1.1.0
**Released:** January 20, 2026

### Feature: Maintenance Logging & Inventory Stock Management

Added lifecycle maintenance logs for hardware field interventions and warehouse inventory stock tracking.

<details>
<summary><strong>Maintenance & Stock Capabilities</strong></summary>

- `POST /api/v1/maintenance/` — Record field technician interventions, component replacements, and calibration logs.
- `GET /api/v1/items-stock/` — Real-time inventory tracking for sensors, solar panels, batteries, and enclosures.
- Historical stock movement auditing with balance updates.

</details>

**Files changed:**
- `app/api/v1/maintenance.py` — Maintenance log routes
- `app/api/v1/stock.py` — Inventory tracking endpoints
- `app/services/maintenance_service.py` — Maintenance business logic
- `app/crud/crud_stock.py` — Stock movements and audit tracking

---

## Version 1.0.0
**Released:** December 5, 2025

### Initial Release: The Beacon Service Microservice

First production release of the Beacon Service — a high-performance FastAPI and SQLModel microservice dedicated to AirQo's hardware fleet management, firmware distribution, and telemetry analytics.

<details>
<summary><strong>Core Architecture & Features</strong></summary>

- **Framework**: FastAPI 0.105 with Python 3.11 asynchronous execution.
- **ORM & Database**: SQLModel and SQLAlchemy over PostgreSQL 13+ with Alembic migrations (`c1348ae3eeff`).
- **Fleet Management**: Device inventory tracking, online/offline status resolution, and location mapping.
- **AirQloud Clusters**: Device grouping and aggregate air quality performance scoring.
- **Firmware OTA**: Google Cloud Storage-backed binary distribution with organization-level access tokens.
- **Scheduled Background Jobs**: APScheduler integration for daily 4:00 AM data collection and performance metric compilation.
- **Documentation**: Auto-generated interactive Swagger UI (`/docs`), ReDoc (`/redoc`), and OpenAPI schema (`/openapi.json`).

</details>

**Files created:**
- `main.py` — FastAPI application entry point
- `app/core/config.py` — Pydantic Settings management
- `app/db/session.py` — Database engine and session factory
- `alembic.ini` & `alembic/versions/c1348ae3eeff_initial_tables.py` — Initial migration
- `scheduler.py` & `app/services/scheduler_service.py` — APScheduler service
- `Dockerfile` — Multi-stage production container build
- `requirements.txt` — Python dependencies

---

## Documentation Index

Consolidated reference to architectural guides, data models, and service interfaces:

### Device Fleet & Profiles
- **Dynamic Device Profiles & Canvas Coordinates**: See Version 2.1.0 & 2.2.0 (`app/models/device_schema.py`)
- **Vendor Management**: See Version 2.1.0 (`app/models/vendor.py`)
- **IoT Diagnostics Engine & Health Snapshots**: See Version 2.0.0 & 2.2.0 (`app/services/diagnostics/`, `app/models/health.py`)
- **ThingSpeak Field Mappings & Stream Unpacking**: See [FIELD_MAPPINGS.md](docs/FIELD_MAPPINGS.md), Version 1.4.0 & Version 2.2.0

### Real-Time Operations & WebRTC
- **WebRTC Signaling & Sessions**: See Version 2.0.0 (`app/api/v1/webrtc/`)
- **Device Operations & Web Serial**: See Version 1.9.0 (`app/websockets/routing.py`)
- **Redis Pub/Sub Event Streaming**: See Version 1.9.0 (`app/services/redis_service.py`)

### Testing, Collocation & Analytics
- **In-Lab Batch Calibration**: See Version 1.6.0 (`app/services/inlab_batch_service.py`)
- **Spatial Grids & Device Number Propagation**: See Version 1.5.0 & 2.2.0 (`app/services/grid_sync_service.py`)
- **Collocation Pearson Correlation**: See Version 1.2.0 (`app/services/collocation_service.py`)

---

## Summary Statistics

### Total Releases: **13**
- Major Versions: 2 (`v1.0.0`, `v2.0.0`)
- Minor Feature Releases: 11 (`v1.1.0` through `v2.2.0`)

### Database Evolution
- **Alembic Revisions**: 16 migration versions
- **Active Core Tables**: 26 tables across fleet management, operations, diagnostics, health snapshots, and telemetry

### API Endpoints
- **REST Routers**: 16 feature routers under `/api/v1` and root prefix
- **Real-Time Channels**: WebSockets (`/ws/devices/{device_id}/serial`) and WebRTC P2P signaling

---

## Breaking Changes

- **Version 2.1.0**: The legacy flat SQL table `category` was dropped and superseded by `device_profiles`. The `/api/v1/categories` endpoints are preserved via a dynamic compatibility adapter in `app/crud/crud_category.py`. External API consumers should migrate to `/api/v1/diagnostics/profiles` and `/api/v1/vendors`.
- **Version 2.0.0**: WebRTC signaling payload structures require standardized JSON formatting containing explicit session IDs and candidate descriptions.

---

## Migration Guide

### Upgrading to Version 2.1.0
1. Ensure the PostgreSQL database instance has the `uuid-ossp` or `pgcrypto` extension enabled.
2. Run database migrations:
   ```bash
   alembic upgrade head
   ```
3. Default device profiles (`lowcost`, `lowcost_gas`, `bam`) will be verified and mapped to existing devices automatically.
4. Verify service health:
   ```bash
   curl -f http://localhost:8000/health
   curl -f http://localhost:8000/api/v1/vendors/
   ```

---

## Contributors

- AirQo Hardware & Software Engineering Team
- Last Updated: September 6, 2026

---

## Support

For technical assistance or questions:
1. Review the endpoint documentation in [README.md](README.md) or via interactive Swagger UI (`/docs`).
2. Consult component documentation in `docs/` and inline module docstrings.
3. Contact the AirQo Hardware & Backend Engineering team.

---

**Legend**:
- 🎯 **Improvements**: Operational enhancements and reliability fixes
- 🔧 **Technical Changes**: Schema, ORM, and low-level architectural modifications
- 📁 **Files**: Created, modified, or deleted files
- ✨ **Features**: New endpoints, services, or protocols added
