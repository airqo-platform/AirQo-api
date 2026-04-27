# Air Quality Spatial Analysis API

Flask service for spatial air-quality analytics used by the AirQo platform. It exposes site categorization, sensor placement, heatmaps, source metadata, and satellite-derived PM2.5.

## Prerequisites
- Python 3.11 and `pip`.
- Copernicus Atmosphere Monitoring Service (CAMS) / Atmosphere Data Store access for source metadata satellite evidence.
- Google Cloud service account JSON is only required for legacy BigQuery/GCS-backed endpoints, not for source metadata CAMS evidence.
- AirQo API token for upstream data access.
- Redis (optional but recommended) for caching heatmap responses.

## Setup
1. From the repository root: `cd src/spatial`.
2. Create and activate a virtual environment:
   - Linux/macOS: `python3.11 -m venv venv && source venv/bin/activate`
   - Windows: `py -3.11 -m venv venv && venv\Scripts\activate`
3. Install dependencies:  
   `python -m pip install --upgrade pip && pip install -r requirements.txt`
4. Create a `.env` in `src/spatial` (example values below). Configure CAMS values for source metadata satellite evidence.

```
AIRQO_API_TOKEN=your-platform-token
AIRQO_API_BASE_URL=https://api.airqo.net
GRID_URL_ID=your-grid-endpoint-or-id
GOOGLE_APPLICATION_CREDENTIALS=./google_application_credentials.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS_EMAIL=service-account@project.iam.gserviceaccount.com
PROJECT_BUCKET=your-gcs-bucket
SPATIAL_PROJECT_BUCKET=your-spatial-gcs-bucket
BIGQUERY_HOURLY_CONSOLIDATED=project.dataset.hourly_consolidated
BIGQUERY_SATELLITE_MODEL_PREDICTIONS=project.dataset.satellite_predictions
SOURCE_METADATA_SATELLITE_PROVIDER=cams
SOURCE_METADATA_SATELLITE_DEFAULT=false
CAMS_BASE_URL=https://atmosphere.copernicus.eu
CAMS_ADS_API_URL=https://ads.atmosphere.copernicus.eu/api
CAMS_DATASET=cams-global-atmospheric-composition-forecasts
CAMS_VARIABLES=nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone,methane,formaldehyde,aerosol_optical_depth_550nm,dust_aerosol_optical_depth_550nm
CAMS_POINT_DATA_URL=
CAMS_API_KEY=
CAMS_TIMEOUT_SECONDS=20
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
REDIS_CACHE_TTL=3600
MODEL_DIR_FILE=./models
OSMNX_CACHE_MAX_FILES=100
OSMNX_CACHE_MAX_AGE_HOURS=168
```

## Start the microservice

After completing setup and activating your virtual environment, run the service from `src/spatial`.

### 1. Development mode (recommended locally)
- Linux/macOS:
```bash
export FLASK_APP=app:app
export APP_ENV=development
export FLASK_DEBUG=1
python -m flask run --host 0.0.0.0 --port 5000
```
- Windows (PowerShell):
```powershell
$env:FLASK_APP="app:app"
$env:APP_ENV="development"
$env:FLASK_DEBUG="1"
python -m flask run --host 0.0.0.0 --port 5000
```

### 2. Alternative local start
- Cross-platform:
```bash
python app.py
```

### 3. Production-like start (Gunicorn)
- Linux/macOS:
```bash
gunicorn --bind 0.0.0.0:5000 app:app
```
- Windows:
  - Gunicorn is not supported natively on Windows. Use `python app.py` locally, or run Gunicorn in Linux/WSL/container environments.

### 4. Verify the service is running
- Base URL: `http://127.0.0.1:5000/api/v2/spatial`
- Health check: `http://127.0.0.1:5000/health`
- Test route: `http://127.0.0.1:5000/test`
- Quick check:
```bash
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps
```
If this returns JSON (or a validation error JSON), the microservice is running.

## Run with Docker locally

From `src/spatial`, build the image:

```bash
docker build -t airqo-spatial .
```

By default, this builds the final `production` stage from the multi-stage Dockerfile. To build the Flask development image instead, use:

```bash
docker build --target dev -t airqo-spatial-dev .
```

Run the container with your local `.env`:

```bash
docker run --rm -p 5000:5000 --env-file .env airqo-spatial
```

If your `.env` points to a Google service account file, mount it into the container and make sure `GOOGLE_APPLICATION_CREDENTIALS` resolves to `/app/google_application_credentials.json`:

- Linux/macOS:
```bash
docker run --rm -p 5000:5000 \
  --env-file .env \
  -v "$(pwd)/google_application_credentials.json:/app/google_application_credentials.json" \
  airqo-spatial
```

- Windows (PowerShell):
```powershell
docker run --rm -p 5000:5000 `
  --env-file .env `
  -v "${PWD}\google_application_credentials.json:/app/google_application_credentials.json" `
  airqo-spatial
```

Verify the container is healthy:

```bash
curl http://127.0.0.1:5000/health
```

If you are running the build from the repository root instead of `src/spatial`, use:

```bash
docker build -t airqo-spatial ./src/spatial
docker run --rm -p 5000:5000 --env-file ./src/spatial/.env airqo-spatial
```

## Test the Docker container

After `docker build -t airqo-spatial .`, start the container and keep that terminal open.

### 1. Run the container

- Linux/macOS:
```bash
docker run --rm --name airqo-spatial-test \
  -p 5000:5000 \
  --env-file .env \
  -v "$(pwd)/google_application_credentials.json:/app/google_application_credentials.json" \
  airqo-spatial
```

- Windows (PowerShell):
```powershell
docker run --rm --name airqo-spatial-test `
  -p 5000:5000 `
  --env-file .env `
  -v "${PWD}\google_application_credentials.json:/app/google_application_credentials.json" `
  airqo-spatial
```

If you built from the repository root instead of `src/spatial`, point `--env-file` and the credentials mount to `./src/spatial/...`.

### 2. Check container health

In a second terminal:

```bash
curl http://127.0.0.1:5000/health
```

Expected result:

```json
{"environment":"production","service":"spatial-api","status":"ok"}
```

If you build with `--target dev` or `--target staging`, the `environment` field will reflect that stage instead.

You can also verify Docker's health status directly:

```bash
docker inspect --format='{{json .State.Health}}' airqo-spatial-test
```

### 3. Smoke-test key endpoints

Site categorization:

```bash
curl "http://127.0.0.1:5000/api/v2/spatial/categorize_site?latitude=0.322502&longitude=32.584726"
```

Source metadata without satellite lookup:

```bash
curl "http://127.0.0.1:5000/api/v2/spatial/source_metadata?latitude=0.322502&longitude=32.584726&satellite=false"
```

Heatmaps:

```bash
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps
```

If the service is running correctly, each command should return JSON. Some endpoints may return validation or upstream-service errors if credentials or dependent services are unavailable, but the HTTP server itself should still respond.

### 4. Inspect logs if a test fails

```bash
docker logs -f airqo-spatial-test
```

Useful checks:

```bash
docker ps
docker inspect airqo-spatial-test
```

### 5. Common Docker test issues

- `curl` cannot connect: confirm the container is running and port `5000` is published.
- Health check fails: inspect container logs and confirm the Flask app started successfully.
- Google credential errors on legacy BigQuery/GCS endpoints: verify that `GOOGLE_APPLICATION_CREDENTIALS` in `.env` points to `/app/google_application_credentials.json` and that the file is mounted into the container. Source metadata CAMS evidence does not require Google credentials.
- OSM or Overpass errors such as `Server load too high`: this is an upstream OpenStreetMap service issue; retry later or use a different Overpass endpoint if needed.

## API authentication
Requests to this service are not authenticated by default, but the service itself uses `AIRQO_API_TOKEN` to pull upstream data. Protect deployments behind your API gateway or add middleware if you need request-level auth.

## Endpoint quick reference
All routes are prefixed with `/api/v2/spatial`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/site_location` | POST | Legacy sensor placement endpoint using a `polygon` request body. |
| `/polygon_site_location` | POST | Polygon-based sensor optimization using a GeoJSON-style `geometry` request body. |
| `/categorize_site` | GET | Classify a site by latitude/longitude. |
| `/source_metadata` | GET | Infer likely air-pollution source metadata for a point, optionally using CAMS atmospheric evidence from Copernicus Atmosphere. |
| `/source_metadata/batch` | POST | Infer source metadata for multiple points in one request. |
| `/derived_pm2_5` | GET | Derived PM2.5 from satellite AOD for a point and date range (JSON body). |
| `/derived_pm2_5_daily` | GET | Daily MODIS AOD data for a point and date range (JSON body). |
| `/satellite_data` | GET | Retrieve satellite pollutant data. |
| `/sentinel5p` | GET | Retrieve Sentinel-5P pollutant data. |
| `/satellite_prediction` | POST | Predict PM2.5 from satellite features at a point. |
| `/heatmaps` | GET | Generate and return base64 PNG AQI heatmaps for all cities. |
| `/heatmaps/<id>` | GET | Heatmap for a specific city id. |

## `/polygon_site_location` API

Use `/polygon_site_location` for the newer polygon optimizer. It accepts GeoJSON-style geometry and returns selected locations, candidate sites, grid metrics, sensor counts, and spatial metrics.

### Request format

- Method: `POST`
- Content type: `application/json`
- Required field: `geometry`
- Supported geometry types: `Polygon`, `MultiPolygon`
- Coordinate order: GeoJSON order `[longitude, latitude]`

Minimal request body:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [32.575107, 0.305577],
        [32.575364, 0.319138],
        [32.597337, 0.320340],
        [32.607894, 0.312787],
        [32.608752, 0.297509],
        [32.599225, 0.292102],
        [32.580342, 0.291845],
        [32.574334, 0.296994],
        [32.575107, 0.305577]
      ]
    ]
  }
}
```

Optional `config` values can override the optimizer defaults. The payload is passed as nested keyword arguments to the optimizer, so the supported top-level sections are:

- `grid`
- `distance`
- `weights`
- `sensor_density`

The optimizer's weak labeling logic for site categories and internal ranking is
kept separately in [`polygon_sensor_labels.py`](./models/polygon_sensor_labels.py).

Notable config fields:

- `distance.min_sensor_distance`: minimum spacing between selected sensors, in meters
- `distance.enforce_method`: one of `hybrid`, `post-process`, or the fallback spacing selector
- `sensor_density.max_sensors`: hard upper bound on returned sensor count
- `sensor_density.recommended_fraction`: fraction of candidate grid cells to target before final capping

Example with config:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [32.575107, 0.305577],
        [32.575364, 0.319138],
        [32.597337, 0.320340],
        [32.607894, 0.312787],
        [32.608752, 0.297509],
        [32.599225, 0.292102],
        [32.580342, 0.291845],
        [32.574334, 0.296994],
        [32.575107, 0.305577]
      ]
    ]
  },
  "config": {
    "distance": {
      "min_sensor_distance": 500,
      "enforce_method": "hybrid"
    },
    "sensor_density": {
      "max_sensors": 50,
      "recommended_fraction": 0.15
    }
  }
}
```

Optional `response_options` can be used to control response size:

- `include_candidate_sites`: include the scored candidate-site list in the API response. Default: `false`
- `candidate_site_limit`: maximum number of candidate sites to return when `include_candidate_sites` is enabled. `0` means no limit

Example with response options:

```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [32.575107, 0.305577],
        [32.575364, 0.319138],
        [32.597337, 0.320340],
        [32.607894, 0.312787],
        [32.608752, 0.297509],
        [32.599225, 0.292102],
        [32.580342, 0.291845],
        [32.574334, 0.296994],
        [32.575107, 0.305577]
      ]
    ]
  },
  "response_options": {
    "include_candidate_sites": true,
    "candidate_site_limit": 100
  }
}
```

### Response shape

Successful responses include:

- `grid_metrics`: grid size, cell dimensions, total cells, and covered area
- `sensor_counts`: maximum, minimum, recommended, and actual selected sensors
- `candidate_site_count`: total number of scored candidate points considered by the optimizer
- `site_category_counts`: counts for `Commercial`, `Urban Background`, `Background`, and `Rural`
- `locations`: selected sensor locations with reasons and warnings
- `candidate_sites`: optional scored candidate points list, included only when requested
- `config`: applied minimum-distance settings
- `spatial_metrics`: nearest-neighbor distance summary when more than one sensor is selected

Representative response excerpt:

```json
{
  "grid_metrics": {
    "grid_size": 120,
    "cell_width": 0.0012,
    "cell_height": 0.0011,
    "total_cells": 98,
    "area_covered": 3.74
  },
  "sensor_counts": {
    "maximum_sensors": 50,
    "minimum_sensors": 4,
    "recommended_sensors": 14,
    "actual_sensors": 14
  },
  "candidate_site_count": 98,
  "locations": [
    {
      "latitude": 0.311234,
      "longitude": 32.587654,
      "site_category": "Urban Background",
      "cluster_id": 3,
      "primary_reason": "Strong urban influence with moderate transport exposure"
    }
  ]
}
```

### Error responses

The endpoint returns `400` for invalid JSON, invalid or empty geometry, unsupported geometry types, or invalid `config` payloads. It returns `500` only for unexpected server-side failures.

## Example requests
Legacy sensor placement:
```bash
curl -X POST http://127.0.0.1:5000/api/v2/spatial/site_location \
  -H "Content-Type: application/json" \
  -d '{
    "polygon": {
      "coordinates": [
        [[32.575107,0.305577],[32.575364,0.319138],[32.597337,0.32034],[32.607894,0.312787],[32.608752,0.297509],[32.599225,0.292102],[32.580342,0.291845],[32.574334,0.296994],[32.575107,0.305577]]
      ]
    },
    "must_have_locations": [[0.324256, 32.581227]],
    "min_distance_km": 2.5,
    "num_sensors": 3
  }'
```

Polygon optimizer, fast default response:
```bash
curl -X POST http://127.0.0.1:5000/api/v2/spatial/polygon_site_location \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [[32.575107,0.305577],[32.575364,0.319138],[32.597337,0.320340],[32.607894,0.312787],[32.608752,0.297509],[32.599225,0.292102],[32.580342,0.291845],[32.574334,0.296994],[32.575107,0.305577]]
      ]
    },
    "config": {
      "distance": {
        "min_sensor_distance": 500,
        "enforce_method": "hybrid"
      },
      "sensor_density": {
        "max_sensors": 50,
        "recommended_fraction": 0.15
      }
    }
  }'
```

Polygon optimizer with candidate sites included:
```bash
curl -X POST http://127.0.0.1:5000/api/v2/spatial/polygon_site_location \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [[32.575107,0.305577],[32.575364,0.319138],[32.597337,0.320340],[32.607894,0.312787],[32.608752,0.297509],[32.599225,0.292102],[32.580342,0.291845],[32.574334,0.296994],[32.575107,0.305577]]
      ]
    },
    "response_options": {
      "include_candidate_sites": true,
      "candidate_site_limit": 100
    }
  }'
```

Site categorization:
```bash
curl "http://127.0.0.1:5000/api/v2/spatial/categorize_site?latitude=0.322502&longitude=32.584726"
```

Source metadata (single point):
```bash
curl "http://127.0.0.1:5000/api/v2/spatial/source_metadata?latitude=0.322502&longitude=32.584726&satellite=true"
```

When `satellite=true`, source metadata uses Copernicus Atmosphere Monitoring
Service (CAMS) atmospheric composition fields for pollutant evidence. This
endpoint does not use Google Earth Engine. The public Atmosphere Data Store is
free, but it is file/job based, so configure `CAMS_POINT_DATA_URL` to an
AirQo-hosted preprocessed CAMS point-summary service for low-latency API
requests. If that provider is unavailable, the request still succeeds with
`satellite_metadata.status` set to `unavailable`.

Source metadata (batch):
```bash
curl -X POST http://127.0.0.1:5000/api/v2/spatial/source_metadata/batch \
  -H "Content-Type: application/json" \
  -d '{
    "satellite": false,
    "buffer_radius_m": 1000,
    "items": [
      {"id": "site-1", "latitude": 0.322502, "longitude": 32.584726},
      {"id": "site-2", "latitude": 0.347596, "longitude": 32.582520}
    ]
  }'
```

Derived PM2.5 (GET with JSON body):
```bash
curl -X GET http://127.0.0.1:5000/api/v2/spatial/derived_pm2_5 \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 0.322502,
    "longitude": 32.584726,
    "start_date": "2024-01-01",
    "end_date": "2024-01-07"
  }'
```

Heatmaps:
```bash
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps/123   # by city id
```

## Notes and troubleshooting
- `must_have_locations` must fall inside the supplied polygon for site selection.
- Legacy BigQuery/GCS operations require valid service account credentials and access to the configured datasets and buckets. Source metadata satellite evidence uses CAMS configuration instead.
- Redis is optional; if unavailable the heatmap endpoints still work but skip caching.
- OSMnx request cache files are stored in `src/spatial/cache`. Old cache files are pruned automatically based on `OSMNX_CACHE_MAX_FILES` and `OSMNX_CACHE_MAX_AGE_HOURS`.
