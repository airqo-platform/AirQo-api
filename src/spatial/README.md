# Air Quality Spatial Analysis API

Flask service for spatial air-quality analytics used by the AirQo platform. It exposes hotspot detection (Getis-Ord and Local Moran's I), site categorization, sensor placement, heatmaps, satellite-derived PM2.5, and reporting endpoints.

## Prerequisites
- Python 3.10+ and `pip`.
- Google Cloud/Earth Engine service account JSON with access to BigQuery and Storage (`GOOGLE_APPLICATION_CREDENTIALS`).
- AirQo API token for upstream data access.
- Redis (optional but recommended) for caching heatmap responses.

## Setup
1. From the repository root: `cd src/spatial`.
2. Create and activate a virtual environment:
   - Linux/macOS: `python -m venv venv && source venv/bin/activate`
   - Windows: `python -m venv venv && venv\Scripts\activate`
3. Install dependencies:  
   `python -m pip install --upgrade pip && pip install -r requirements.txt`
4. Create a `.env` in `src/spatial` (example values below) and place your Google credentials JSON where `GOOGLE_APPLICATION_CREDENTIALS` points.

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
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
REDIS_CACHE_TTL=3600
MODEL_DIR_FILE=./models
```

## Running locally
- Base URL: `http://127.0.0.1:5000/api/v2/spatial`
- Quick start:  
  - Linux/macOS: `FLASK_APP=app.py FLASK_ENV=development flask run --port 5000`  
  - Windows (PowerShell): `set FLASK_APP=app.py; set FLASK_ENV=development; flask run --port 5000`  
  - Or simply: `python app.py`

## API authentication
Requests to this service are not authenticated by default, but the service itself uses `AIRQO_API_TOKEN` to pull upstream data. Protect deployments behind your API gateway or add middleware if you need request-level auth.

## Endpoint quick reference
All routes are prefixed with `/api/v2/spatial`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/getisord` | POST | Getis-Ord hotspot/coldspot analysis for a grid and time window. |
| `/getisord_confidence` | POST | Getis-Ord with confidence reporting. |
| `/localmoran` | POST | Local Moran's I cluster/outlier analysis. |
| `/site_location` | POST | ML-driven sensor placement inside a polygon. |
| `/categorize_site` | GET | Classify a site by latitude/longitude. |
| `/source_metadata` | GET | Infer likely air-pollution source metadata for a point. |
| `/source_metadata/batch` | POST | Infer source metadata for multiple points in one request. |
| `/derived_pm2_5` | GET | Derived PM2.5 from satellite AOD for a point and date range (JSON body). |
| `/derived_pm2_5_daily` | GET | Daily MODIS AOD data for a point and date range (JSON body). |
| `/satellite_prediction` | POST | Predict PM2.5 from satellite features at a point. |
| `/heatmaps` | GET | Generate and return base64 PNG AQI heatmaps for all cities. |
| `/heatmaps/<id>` | GET | Heatmap for a specific city id. |
| `/air_quality_report` | POST | LLM-generated air quality report. |
| `/rulebase_air_quality_report` | POST | Rule-based air quality report. |
| `/air_quality_report_with_customised_prompt` | POST | LLM report with a custom prompt. |

## Example requests
Hotspot analysis (Getis-Ord):
```sh
curl -X POST http://127.0.0.1:5000/api/v2/spatial/getisord \
  -H "Content-Type: application/json" \
  -d '{
    "grid_id": "64b7f325d7249f0029fed743",
    "start_time": "2024-01-01T00:00:00",
    "end_time": "2024-01-27T00:00:00"
  }'
```

Local Moran's I:
```sh
curl -X POST http://127.0.0.1:5000/api/v2/spatial/localmoran \
  -H "Content-Type: application/json" \
  -d '{
    "grid_id": "64b7f325d7249f0029fed743",
    "start_time": "2024-01-01T00:00:00",
    "end_time": "2024-01-27T00:00:00"
  }'
```

Sensor placement inside a polygon:
```sh
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

Site categorization:
```sh
curl "http://127.0.0.1:5000/api/v2/spatial/categorize_site?latitude=0.322502&longitude=32.584726"
```

Source metadata (single point):
```sh
curl "http://127.0.0.1:5000/api/v2/spatial/source_metadata?latitude=0.322502&longitude=32.584726&include_satellite=false"
```

Source metadata (batch):
```sh
curl -X POST http://127.0.0.1:5000/api/v2/spatial/source_metadata/batch \
  -H "Content-Type: application/json" \
  -d '{
    "include_satellite": false,
    "items": [
      {"id": "site-1", "latitude": 0.322502, "longitude": 32.584726},
      {"id": "site-2", "latitude": 0.347596, "longitude": 32.582520}
    ]
  }'
```

Derived PM2.5 (GET with JSON body):
```sh
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
```sh
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps
curl http://127.0.0.1:5000/api/v2/spatial/heatmaps/123   # by city id
```

## Notes and troubleshooting
- Timestamps must be ISO 8601 (`YYYY-MM-DDTHH:MM:SS`); the analysis endpoints reject identical start/end times and ranges longer than 12 months.
- `must_have_locations` must fall inside the supplied polygon for site selection.
- BigQuery/Earth Engine operations require valid service account credentials and access to the configured datasets and buckets.
- Redis is optional; if unavailable the heatmap endpoints still work but skip caching.
