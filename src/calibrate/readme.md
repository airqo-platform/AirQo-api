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

Make a `POST` request to `http://localhost:4001/api/v1/calibrate/tool` using
`multipart/form-data`. The endpoint returns the calibrated data as a CSV download.
The deployed training artifacts currently produce calibrated PM2.5 values.

The form must contain:

- `file`: a non-empty CSV file no larger than 20 MB.
- `country` (optional): country model name, such as `kenya`. This loads
  `gs://calibration_training_bucket/calibration/<country>_pm2_5_cal_model.pkl`.
  When omitted, the service uses the Uganda model.
- A column-name mapping for `datetime`, `pm10`, `s2_pm10`, `humidity`,
  and `temperature`.
- PM2.5 mapped in either of these formats:
  - `pm2_5` and `s2_pm2_5` for separate sensor readings.
  - `avg_pm2_5` for one pre-averaged PM2.5 column. In this format, the
    unavailable sensor-pair error feature is treated as `0`.

Each mapping value must be the name of a distinct column in the uploaded CSV.

Example:

```bash
curl --request POST http://localhost:4001/api/v1/calibrate/tool \
  --form "file=@uncalibrated_data.csv;type=text/csv" \
  --form "country=uganda" \
  --form "datetime=created_at" \
  --form "pm2_5=pm2_5" \
  --form "s2_pm2_5=s2_pm2_5" \
  --form "pm10=pm10" \
  --form "s2_pm10=s2_pm10" \
  --form "humidity=humidity" \
  --form "temperature=temperature" \
  --output calibrated_data.csv
```

The service uses Google Application Default Credentials. Its runtime service
account needs `storage.objects.get` access to `calibration_training_bucket`.
The bucket, prefix, project, or a single fixed model can be overridden with:

- `CALIBRATION_MODELS_BUCKET` (default: `calibration_training_bucket`)
- `CALIBRATION_MODEL_PREFIX` (default: `calibration`)
- `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT_ID`
- `CALIBRATION_MODEL_BLOB` for a fixed blob path
- `CALIBRATION_MODEL_COUNTRY` to override the default country (`uganda`)

### Sample contents for csv file containing uncalibrated data

![Sample csv file](https://storage.googleapis.com/airqo_open_data/uncalibrated_data.png)

### [Link to the sample file](https://storage.googleapis.com/airqo_open_data/uncalibrated_data.csv)

### Sample form data

![Sample form data](https://storage.googleapis.com/airqo_open_data/calibrate_tool_request.png)
