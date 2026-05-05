

## Running Locally

Create and activate a virtual environment.

Windows:

```powershell
python -m venv venv
venv\Scripts\activate
```

Linux/macOS:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
cd src/predict
pip install -r requirements.txt
```

Run the API:

```bash
cd api
flask run
```

## Docker

From `src/predict/api`, build and run the image:

```bash
docker build --target=dev --tag predict-api .
docker run -p 5000:5000 --env FLASK_ENV=development predict-api:latest
```


# Predict Microservice Guide

The predict microservice contains the Flask API and the jobs used to generate forecast and prediction data.

- `api/`: Predict API application.
- `jobs/forecast_training/`: Model training jobs for forecasts.
- `jobs/forecast/`: Forecast generation jobs.
- `jobs/predict_places_air_quality/`: Place-level air quality prediction jobs.

## API Base URL

All API routes are mounted under:

```text
/api/v2/predict
```

For local development, the base URL is usually:

```text
http://localhost:5000/api/v2/predict
```

## API Endpoints

### Faulty Devices

Returns faulty devices written by the AirQo fault detection workflow.

```http
GET /api/v2/predict/faulty-devices
```

Query parameters:

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `device_id` | No | Filter results to one device. | `690-g5137` |
| `explain` | No | Add human-readable fault explanations. Defaults to `false`. | `true` |

Examples:

```http
GET /api/v2/predict/faulty-devices
GET /api/v2/predict/faulty-devices?device_id=690-g5137
GET /api/v2/predict/faulty-devices?device_id=690-g5137&explain=true
```

Example response:

```json
{
  "message": "Faulty devices found",
  "success": true,
  "data": [
    {
      "_id": "69e3c8658036d7234f9e07b0",
      "device_id": "690-g5137",
      "device_name": "airqo-g5137",
      "fault_detected": 1,
      "fault_types": [
        "correlation_fault",
        "anomaly_percentage_fault"
      ],
      "correlation_fault": 1,
      "correlation_value": 0.8492728321091092,
      "anomaly_percentage_fault": 1,
      "anomaly_percentage": 100,
      "anomaly_count": 4,
      "observation_count": 4,
      "triggered_fault_count": 2
    }
  ],
  "total": 1
}
```

When `explain=true`, each device also includes `fault_explanations`:

```json
{
  "fault_explanations": [
    {
      "fault_type": "anomaly_percentage_fault",
      "message": "The ML model marked a high percentage of this device's recent observations as abnormal.",
      "evidence": {
        "anomaly_percentage": 100,
        "anomaly_count": 4,
        "observation_count": 4,
        "threshold": 45
      }
    }
  ]
}
```

Empty response:

```json
{
  "message": "No faulty devices found",
  "success": true,
  "data": [],
  "total": 0
}
```

Error response:

```json
{
  "message": "Error fetching faulty devices",
  "success": false,
  "data": null,
  "error": "Failed to connect to the faulty devices database."
}
```

Fault detection environment variables:

```env
MONGO_URI=mongodb://localhost:27017/airqo_netmanager
MONGO_DATABASE_NAME=airqo_netmanager
MONGO_FAULTY_DEVICES_COLLECTION=faulty_devices_1
```

### Site Daily Forecasts

Returns grouped 7-day forecasts for all sites or one site. When `site_id` is provided, the response keeps the same outer structure but returns one site group in `data.forecasts`.

```http
GET /api/v2/predict/daily-forecasting
```

Query parameters:

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `site_id` | No | Filter to one site. | `640f19699b912345` |

Examples:

```http
GET /api/v2/predict/daily-forecasting
GET /api/v2/predict/daily-forecasting?site_id=640f19699b912345
```

Response shape:

```json
{
  "success": true,
  "data": {
    "start_date": "2026-05-05",
    "end_date": "2026-05-11",
    "days": 7,
    "total": 1,
    "units": {
      "pm2_5": "ug/m3",
      "air_temperature": "degC",
      "relative_humidity": "%",
      "air_pressure_at_sea_level": "hPa",
      "precipitation_amount": "mm",
      "cloud_area_fraction": "%",
      "wind_speed": "m/s",
      "wind_from_direction": "degrees",
      "forecast_confidence": "%"
    },
    "descriptions": {
      "pm2_5_mean": "Predicted average PM2.5 concentration.",
      "pm2_5_low": "Lower PM2.5 forecast estimate.",
      "pm2_5_high": "Upper PM2.5 forecast estimate.",
      "pm2_5_min": "Minimum predicted PM2.5.",
      "pm2_5_max": "Maximum predicted PM2.5.",
      "forecast_confidence": "Confidence level of the forecast."
    },
    "forecasts": [
      {
        "site_details": {
          "site_id": "6964bc5bb5a37a00148521df",
          "site_name": "Collins Owhondah Dr",
          "site_latitude": 4.785747,
          "site_longitude": 6.97383
        },
        "start_date": "2026-05-05",
        "end_date": "2026-05-11",
        "days": 7,
        "total": 7,
        "forecasts": [
          {
            "date": "2026-05-05",
            "forecast": {
              "pm2_5_mean": 14.5,
              "pm2_5_low": 10.8,
              "pm2_5_high": 18.7,
              "pm2_5_min": 9.3,
              "pm2_5_max": 33.3,
              "forecast_confidence": 79.0
            },
            "aqi": {
              "aqi_value": 14.5,
              "aqi_category": "Moderate",
              "aqi_color_name": "Yellow",
              "aqi_color": "#FFFF00"
            },
            "met": {
              "air_temperature": 27.3,
              "relative_humidity": 85.2,
              "air_pressure_at_sea_level": 1010.0,
              "precipitation_amount": 9.2,
              "cloud_area_fraction": 89.7,
              "wind_speed": 1.9,
              "wind_from_direction": 191.9,
              "wind_direction_compass": "SSW"
            },
            "created_at": "2026-05-05T03:00:56.215000"
          }
        ]
      }
    ]
  }
}
```

Important response fields:

| Field | Description |
| --- | --- |
| `data.start_date` | First forecast date in the response. |
| `data.end_date` | Last forecast date in the response. |
| `data.days` | Expected forecast window length. |
| `data.total` | Number of site groups returned. |
| `data.units` | Units for forecast and meteorology values. |
| `data.descriptions` | Human-readable descriptions for forecast fields. |
| `data.forecasts[].site_details` | Site metadata for each forecast group. |
| `data.forecasts[].forecasts[]` | Daily forecast rows for the site. |
| `forecast.pm2_5_mean` | Predicted average PM2.5 concentration. |
| `forecast.pm2_5_low` / `forecast.pm2_5_high` | Lower and upper PM2.5 forecast estimates. |
| `forecast.pm2_5_min` / `forecast.pm2_5_max` | Minimum and maximum predicted PM2.5 values. |
| `forecast.forecast_confidence` | Forecast confidence percentage. |
| `aqi` | AQI category, value, and display color derived from `pm2_5_mean`. |
| `met` | Meteorological forecast values used alongside the PM2.5 forecast. |
| `created_at` | Time when the forecast document was generated. |

### Next 24-Hour Forecast

Returns the next 24 hourly PM2.5 forecasts for a matching location.

```http
GET /api/v2/predict/hourly-forecast
```

At least one location query parameter is required.

| Parameter | Required | Description |
| --- | --- | --- |
| `site_id` | No | Site identifier. |
| `site_name` | No | Site name. |
| `parish` | No | Parish name. |
| `county` | No | County name. |
| `city` | No | City name. |
| `district` | No | District name. |
| `region` | No | Region name. |
| `language` | No | Language for health tips. |

Example:

```http
GET /api/v2/predict/hourly-forecast?site_id=640f19699b912345
```

### Next 7-Day Forecast

Returns the next 7 daily PM2.5 forecasts for a matching location.

```http
GET /api/v2/predict/daily-forecast
```

At least one location query parameter is required.

| Parameter | Required | Description |
| --- | --- | --- |
| `device_id` | No | Device identifier. |
| `site_id` | No | Site identifier. |
| `site_name` | No | Site name. |
| `parish` | No | Parish name. |
| `county` | No | County name. |
| `city` | No | City name. |
| `district` | No | District name. |
| `region` | No | Region name. |
| `language` | No | Language for health tips. |

Example:

```http
GET /api/v2/predict/daily-forecast?device_id=690-g5137
```

### All Hourly Forecasts

Returns all available hourly forecasts.

```http
GET /api/v2/predict/hourly-forecasts
```

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `language` | No | Language for health tips. |

### All Daily Forecasts

Returns all available daily forecasts.

```http
GET /api/v2/predict/daily-forecasts
```

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `language` | No | Language for health tips. |

### Heatmap Predictions

Returns prediction data formatted as GeoJSON for heatmap rendering.

```http
GET /api/v2/predict/heatmap
```

Query parameters:

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `airqloud` | No | None | Filter by AirQloud. |
| `page` | No | `1` | Page number. |
| `limit` | No | `1000` | Number of records per page. |

Example:

```http
GET /api/v2/predict/heatmap?page=1&limit=1000
```

### Search Predictions

Returns the nearest prediction for provided coordinates.

```http
GET /api/v2/predict/search
```

Query parameters:

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `latitude` | Yes | None | Latitude. |
| `longitude` | Yes | None | Longitude. |
| `source` | No | `parishes` | Source to search. Use `parishes` for parish predictions. |
| `distance` | No | `100` | Search distance in metres when source is not `parishes`. |

Example:

```http
GET /api/v2/predict/search?latitude=0.3476&longitude=32.5825
```

### Parish Predictions

Returns paginated parish-level predictions.

```http
GET /api/v2/predict/parishes
```

Query parameters:

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `page` | No | `1` | Page number. |
| `page_size` | No | `10` | Records per page. Capped by `PARISH_PREDICTIONS_QUERY_LIMIT`. |
| `parish` | No | None | Filter by parish. |
| `district` | No | None | Filter by district. |

Example:

```http
GET /api/v2/predict/parishes?page=1&page_size=10&district=Kampala
```

## Fault Fields

Fault records may contain both rule-based and ML-based fault fields.

Rule-based faults:

| Field | Meaning |
| --- | --- |
| `correlation_fault` | The two PM2.5 sensor channels are weakly correlated. |
| `missing_data_fault` | The device has sustained missing PM2.5 readings. |
| `sensor_disagreement_fault` | The PM2.5 sensor channels disagree significantly. |
| `constant_value_fault` | The device reports repeated constant values. |
| `battery_fault` | The device has sustained low battery readings. |
| `range_fault` | The device reports values outside expected valid ranges. |

ML-based faults:

| Field | Meaning |
| --- | --- |
| `anomaly_percentage_fault` | More than 45% of recent observations were marked anomalous by the trained model. |
| `anomaly_sequence_fault` | The trained model found a long consecutive sequence of anomalous observations. |
| `anomaly_percentage` | Percentage of observations marked anomalous. |
| `anomaly_count` | Number of observations marked anomalous. |
| `observation_count` | Number of observations checked. |
| `fault_count` | Longest consecutive anomaly count used for sequence faults. |

## Environment Files

Runtime configuration is loaded from `api/.env` and actual environment variables.

`api/.env.local` is a reference file only. It is intended to show developers what values to request or provide after forking the repository. The API does not load `.env.local` automatically.

Important variables:

```env
FLASK_APP=app.py
FLASK_ENV=development
FLASK_RUN_PORT=5000

POSTGRES_CONNECTION_URL=postgresql://postgres:postgres@localhost:5432/airqo

MONGO_GCE_URI=mongodb://localhost:27017/airqo_netmanager
MONGO_URI=mongodb://localhost:27017/airqo_netmanager
DB_NAME=airqo_netmanager
MONGO_DATABASE_NAME=airqo_netmanager
MONGO_SITE_DAILY_FORECAST_COLLECTION=test_7_days_site_daily_forecast
MONGO_FAULTY_DEVICES_COLLECTION=faulty_devices_1

REDIS_SERVER=localhost
REDIS_PORT=6379
CACHE_TIMEOUT=3600

GOOGLE_APPLICATION_CREDENTIALS=google_application_credentials.json
BIGQUERY_MEASUREMENTS_PREDICTIONS=airqo-250220.averaged_data.predictions
BIGQUERY_PLACES_PREDICTIONS=airqo-250220.averaged_data.places_predictions

AIRQO_BASE_URL=https://platform.airqo.net
AIRQO_API_AUTH_TOKEN=
```
