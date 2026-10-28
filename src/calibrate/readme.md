[//]: #TODO "Need to update ASAP. after models also developed"

# Calibrate microservice.

## To run in a virtual environment.

1. Add file `airqo-250220-5149c2aac8f2.json` to `jobs/`. Obtain from a team member or GCP.
1. Create a virtual environment
1. `pip install -r requirements.txt`
1. `flask run`

## To build and run with docker desktop.

(Uses "production" dockerfile.)

1. Add file `airqo-250220-5149c2aac8f2.json` to `jobs/`. Obtain from a team member or GCP.
1. `docker build --target=dev -t calibrate .`
1. `docker run -d -p 4001:4001 --env FLASK_APP=app.py --env FLASK_ENV=development --env MONGO_URI=mongodb://localhost:27017 calibrate`

It is implicit that `mongodb` should be installed and running.

## Calibrate Tool Endpoint

Make a `POST` request to http://localhost:4001/api/v2/calibrate/tool using form data: Form must contain:

- A csv file containing the data you want to calibrate.
- Mapping for `datetime`, `pm2_5`, `s2_pm2_5`, `pm10`, `s2_pm10`, `humidity`, `temperature`.

### Sample contents for csv file containing uncalibrated data

![Sample csv file](https://storage.googleapis.com/airqo_open_data/uncalibrated_data.png)

### [Link to the sample file](https://storage.googleapis.com/airqo_open_data/uncalibrated_data.csv)

### Sample form data

![Sample form data](https://storage.googleapis.com/airqo_open_data/calibrate_tool_request.png)

## V2 calibration tool

`POST /api/v2/calibrate/tool` accepts `multipart/form-data` with a CSV upload
named `file`. Required CSV headers are `datetime`, `pm2_5`, `pm10`, `humidity`,
and `temperature`. With these headers, only upload the file in Postman; no
mapping fields are needed. `s2_pm2_5` and `s2_pm10` are optional. Missing
secondary columns or blank secondary readings use the corresponding primary
reading (zero sensor difference). Invalid nonblank secondary values are rejected.
This fallback enables single-sensor input but its calibration accuracy still
needs validation against reference measurements.

CSV files must not exceed 20 MB (20 MiB / 20,971,520 bytes), on both V1 and V2.
Oversized uploads return HTTP 413 with a JSON error. The total multipart request
is capped at 21 MiB to allow up to 1 MiB of form fields and upload overhead.

For other CSV header names, supply optional form mappings such as
`datetime=timestamp` or `pm2_5=pm25_sensor1`. Each mapping value must name an
existing, distinct CSV column. Unspecified mappings default to the native names.

Example `measurements.csv`:

```csv
timestamp,pm25_sensor1,pm25_sensor2,pm10_sensor1,pm10_sensor2,temp,rh
2026-10-28T10:00:00Z,25,27,40,42,24,65
```

PowerShell request:

```powershell
curl.exe -X POST "http://localhost:4001/api/v2/calibrate/tool" `
  -F "file=@measurements.csv" `
  -F "datetime=timestamp" `
  -F "pm2_5=pm25_sensor1" `
  -F "s2_pm2_5=pm25_sensor2" `
  -F "pm10=pm10_sensor1" `
  -F "s2_pm10=pm10_sensor2" `
  -F "temperature=temp" `
  -F "humidity=rh" `
  --output calibrated_data.csv
```

On success (200), the CSV contains `avg_pm2_5`, `avg_pm10`, `datetime`,
`calibrated_pm2_5`, and `calibrated_pm10`, without an index column. Extra CSV
columns are ignored. Required values cannot be missing or nonfinite, PM values
must be nonnegative, humidity must be 0–100, and average PM10 must be positive
after rounding to two decimals. Timestamps are normalized to UTC; timestamps
without an offset are treated as UTC. The hour feature therefore uses UTC.
No hourly aggregation is performed.

Invalid input returns 400 JSON with `success: false` and `message`; the whole
upload is rejected rather than silently dropping rows. Unavailable models return
503; prediction failures return 500. Error responses are JSON, not CSV.

V2 `/tool` inference reuses the existing saved models and feature order. That
endpoint does not retrain or save models. The potential PM10 training/inference feature-order discrepancy
must be checked against the actual model artifacts before changing that order.
V1 remains available at `/api/v1/calibrate/tool` and
`/api/v1/calibrate/tool/train`. V2 adds the validated calibration tool alongside
those existing endpoints. V2 reference training uses the separate job endpoints
described below.

### V2 model storage

V2 loads `default_rf.pkl` (PM2.5) and `default_lasso.pkl` (PM10) from the
root of `FORECAST_MODELS_BUCKET`, defaulting to `airqo_prediction_bucket_dev`.
It uses the same joblib loader and ratio feature as workflow calibration
inference. These are legacy prediction models, not the newer training artifact
dictionaries in the `calibration/` folder. Each API worker caches one loaded pair
in memory. Concurrent requests in a worker share the models and a lock prevents
duplicate cold-start downloads. V1 local model loading is unchanged.

On the first request after `MODEL_REFRESH_INTERVAL_SECONDS` (default 3600), the
worker checks both GCS object generations. Unchanged objects are not downloaded
or deserialized again; changed objects are downloaded with a generation
precondition. The new pair is published only after both models validate. If a
refresh fails, that worker keeps its last working pair and retries after another
interval. A first-load failure still returns 503. Switching
`FORECAST_MODELS_BUCKET` requires loading that bucket's models; it never serves a
cached pair from a different bucket. Restarting a worker clears its memory cache.
Refresh checks are request-driven, not a background task or a disk cache. Each
worker owns its model memory, and refreshing a large model can temporarily retain
both old and new versions; size container memory accordingly.

Set this in `src/calibrate/.env` and restart the API:

```dotenv
FORECAST_MODELS_BUCKET=airqo_prediction_bucket_dev
```

The API needs Google Application Default Credentials with read access to these
objects. For local development, configure `gcloud auth application-default login`
or set `GOOGLE_APPLICATION_CREDENTIALS` to your existing service-account JSON.
`google-cloud-storage` is already in the service requirements; `gcsfs` is not
needed. V1 still uses local model paths.

### Local setup (V1 model paths)

From `src/calibrate`, use an environment with the service dependencies installed.
Obtain trusted existing model files and configure their absolute paths in `.env`:

```dotenv
RF_REG_MODEL=D:/models/rf_reg_model.pkl
LASSO_MODEL=D:/models/lasso_model.pkl
```

Then run:

```powershell
python -m flask --app app run --port 4001
python -m unittest discover -s tests -v
```

With the service running, use a second PowerShell terminal from `src/calibrate`
to generate and stream sample sensor readings directly to V2:

```powershell
.\tests\test_calibrate_v2.ps1
```

The script generates 24 hourly readings in memory, checks HTTP 200, CSV columns,
row count, sensor averages, and finite predictions, then previews five rows.
No input CSV file is required. Use `-RowCount 48` for more readings, or
`-OutputPath calibrated_data.csv` to save results. JSON errors are displayed.
To target another server, pass `-BaseUrl http://localhost:4002`.

CSV inference does not require MongoDB. V2 requires GCP credentials for model
downloads; V1 local inference does not. Docker uses Python 3.10. The numerical
stack matches workflow development pins (scikit-learn 1.2.2, NumPy 1.24.4,
SciPy 1.15.3, joblib 1.5.3). Saved model compatibility still needs verification
against the actual artifacts and their training environment. Tests use fake predictors with real feature processing;
they do not establish calibration accuracy with production models.

## V2 reference training jobs

Submit paired, collocated sensor/reference measurements to
`POST /api/v2/calibrate/tool/train`. Each submission creates its own UUID.
All training endpoints require the existing AirQo login JWT in
`Authorization: Bearer <token>` (the `JWT` scheme is also supported).
The API verifies HS256 signatures using the auth-service's `JWT_SECRET`, expiry,
and the signed user `_id`. Owner IDs in form fields or headers are never trusted.
Another user's job ID returns 404. JWT validation is local; account revocation
and other gateway access policies remain the auth-service/gateway's responsibility.

Required sensor CSV headers: `datetime`, `pm2_5`, `pm10`, `humidity`,
`temperature`. Secondary sensor columns are optional as in V2 inference.
Include `reference_pm2_5`, `reference_pm10`, or both. All readings on a row
must represent the same location and time; upload one collocated site per job.
Extra columns are ignored. Reference data alone cannot train a sensor calibration.
Use consistent sensor/reference units (PM in micrograms per cubic metre,
temperature in Celsius, humidity in percent). Example CSV headers:

```csv
datetime,pm2_5,pm10,humidity,temperature,reference_pm2_5,reference_pm10
2026-10-01T00:00:00Z,25,40,65,24,22,35
```

This single row illustrates the format; a training job needs at least 30 paired
timestamps after averaging.

Optional form fields:

| Field | Values / default |
| --- | --- |
| `pollutant` | `pm2_5`, `pm10`, `both`; inferred from available reference headers if omitted |
| `averaging_interval` | `1h` (default) or `raw` |
| Any sensor/reference header name | Mapping to a different CSV header, e.g. `reference_pm2_5=BAM_PM25` |

Timestamps are normalized to UTC. Hourly training averages paired measurements
in the same hour. Raw mode consolidates exact duplicate timestamps. No reference
interpolation is performed. Missing/invalid required values fail the job. At least
30 distinct paired timestamps must remain after averaging, with a default maximum
of 50,000. Thirty is an operational minimum, not evidence of scientific adequacy.
The CSV upload limit is still 20 MiB.

The earliest 80% of timestamps train the model; the latest 20% form the holdout.
PM2.5 uses a bounded random forest, PM10 uses Lasso. Results report MAE, RMSE,
R-squared (null for constant reference values), and uncalibrated-average MAE.
Compare calibrated MAE to raw MAE; improvement is not guaranteed. The downloadable
artifact contains the evaluated model(s), feature ordering, preprocessing metadata,
and library versions. It is not refit using holdout data. Its format is separate
from shared default models and is not automatically loaded by `/tool`.

### Run the API and worker

Install runtime requirements, then configure `.env`:

```dotenv
# Use the auth-service's existing secret, obtained securely from your deployment.
JWT_SECRET=<same-secret-as-auth-service>
MONGO_URI=mongodb://localhost:27017
CALIBRATION_JOB_DATABASE=calibration_jobs
CALIBRATION_JOB_RETENTION_HOURS=24
CALIBRATION_TRAIN_MAX_ROWS=50000
```

Start MongoDB, then run these in separate PowerShell terminals from `src/calibrate`:

```powershell
.\venv\Scripts\python.exe -m flask --app app run --port 4001
```

```powershell
.\venv\Scripts\python.exe training_worker.py
```

In Postman, select POST `/api/v2/calibrate/tool/train`, set your AirQo login token
under Authorization (Bearer Token), and add `file` under Body / form-data.
Native CSV headers require no mappings. A successful submission returns HTTP 202:

```json
{
  "success": true,
  "job_id": "a1c2864c-173f-4da8-9ac5-8f4422de0902",
  "status": "queued",
  "status_url": "/api/v2/calibrate/tool/train/a1c2864c-173f-4da8-9ac5-8f4422de0902"
}
```

Poll `status_url` with the same login token. Status progresses from `queued` to
`running`, then `completed` or `failed`. Completed jobs include metrics,
`result_url` (held-out predictions CSV), and `model_url` (joblib artifact).
Both downloads require that user's login token. Pending downloads return 409;
missing, expired, or other-user jobs return 404. Missing/invalid tokens return 401;
missing authentication configuration or an unavailable queue returns 503.
CSV content validation happens in the worker; invalid rows produce a failed job
with an explanatory message in its status response.

To generate 72 paired readings and submit/poll a job from PowerShell without an
input CSV file, set `AIRQO_LOGIN_TOKEN` securely in your terminal environment and run:

```powershell
.\tests\test_training_jobs.ps1
```

The script prints the job ID, progress, metrics, and private download URLs. It
times out after five minutes by default; use `-WaitSeconds` to change that. The
generated reference values are synthetic and only exercise the training flow.

Job metadata and temporary files use MongoDB/GridFS, not the API container's
filesystem or the shared prediction bucket. Input CSVs are deleted on completion
or failure. Jobs and downloadable artifacts expire 24 hours after submission by
default and are deleted by the worker's cleanup loop. Cleanup pauses if every
worker is stopped. Unlike synchronous inference, background training necessarily
retains the upload temporarily so another process can consume it.

### Multiple users and replicas

API replicas and worker processes must use the same MongoDB URI and job database.
Each worker runs one job at a time (`n_jobs=1`). Run additional worker processes
or replicas to increase capacity without blocking API requests. Claims are atomic;
workers renew a 120-second lease every 30 seconds. Crashed jobs can be reclaimed
up to three times, and a stale worker cannot overwrite a newer worker's result.
Use the `training-worker` Docker build target for worker deployment; it needs the
same database settings as the API. A running API alone does not execute queued jobs.

Training metrics and downloads are private to the verified user. Deployment still
needs the normal gateway access/rate limits, database backups, and resource sizing.
No shared default prediction model is overwritten.

### Training tests

```powershell
.\venv\Scripts\python.exe -m pip install -r tests/requirements.txt
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Queue tests use mongomock/GridFS with real training, artifact serialization, and
signed test JWTs. They check owner isolation, chronological validation, atomic
claims, stale leases, cleanup, and errors. Production MongoDB replication/failover
and real AirQo login tokens require a separate deployment integration check.
