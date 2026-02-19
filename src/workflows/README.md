# Workflows

This folder contains functionality for running various AirQo workflow scripts using Apache Airflow framework, an open-source workflow management platform for data engineering pipelines.

## Environment Setup

- Add the `.env` file to this directory. Preferred: obtain from secret manager (`workflows-env-file`). Alternative: copy `env.sample` to `.env` and fill in required values.
- Add the following files to `meta_data/` in this directory (create the folder if it does not exist):
  - `google_application_credentials.json` (`workflows-google-application-credentials`)
  - `plume_labs_metadata.json` (`airflow-plume-labs-metadata`)
  - (Optional) `airnow_countries_metadata.json` (`airflow-airnow-countries-metadata`) if you have DAGs/utilities that reference it
- (Optional) Configure Slack notifications (for DAG success/failure alerts):
  - Preferred: create an Airflow connection with conn id `slack` (or set `AIRFLOW_SLACK_CONN_ID` to another conn id).
  - Alternative: set `SLACK_WEBHOOK_URL` (full incoming webhook URL) or `SLACK_WEBHOOK_TOKEN`.

## 1. Running the utility functions locally

Follow these steps if you wish to run the various scripts locally without entirely launching Airflow; otherwise, we recommend running using Docker.

### Create a virtual environment

```bash
python3 -m venv venv
```

### Activate your environment

#### Linux or MacOS

```bash
source venv/bin/activate
```

#### Windows

```bash
# PowerShell
.\venv\Scripts\Activate.ps1

# cmd.exe
venv\Scripts\activate.bat

# Git Bash
source venv/Scripts/activate
```

### Install requirements

```bash
pip install -r dev-requirements.txt
```

## 2. Running using Docker

### Prerequisites

- Docker
- Docker Compose v2 (recommended): `docker compose version`
- You have set up your environment following the [Environment Setup](#environment-setup) instructions.

### Ensure Docker is running

- Windows/macOS: start Docker Desktop, then verify with `docker version`.
- Linux: ensure the daemon is running (for example `sudo systemctl start docker`), then verify with `docker version`.

### Starting all containers

```bash
sh run.sh
```

### Running workflows only

```bash
sh run-workflows-only.sh
```

**Windows note:** the `*.sh` scripts require a POSIX shell (WSL, Git Bash, or similar). If you prefer PowerShell, use Docker Compose directly:

```powershell
docker compose -f docker-compose.yaml up --build
```

`run-workflows-only.sh` starts the core Airflow services (including `redis` + `airflow-worker` for `CeleryExecutor`) but does not start Kafka.

Wait for the webserver to be available by checking its status at <http://localhost:8080/health>. Visit the admin web ui at <http://localhost:8080/home>. Use `airflow` for username and password.

### Interacting with kafka

#### Accessing the container

```bash
docker exec -it message-broker bash
```

#### Viewing messages

```bash
kafka/bin/kafka-console-consumer.sh --topic <topic> --from-beginning --bootstrap-server localhost:9092
```

Replace `<topic>` with the topic you want to listen to. For example `hourly-measurements-topic`.

**Tip:** from your host machine (not inside the container), Kafka is exposed on port `9093` (see `docker-compose.yaml`), so your bootstrap server would be `localhost:9093`.

### Stop containers

```bash
Ctrl + c
```

### Cleanup

```bash
sh clean.sh
```

### Reclaiming disk space (Docker + WSL2)

The commands below are safe to run but destructive (they remove stopped containers, unused images, unused volumes, and build cache).

```bash
# Stop this stack (adjust if you used a different compose file)
docker compose -f docker-compose.yaml down --volumes

# Remove unused docker artifacts
docker system prune -a --volumes
docker builder prune -a
```

If you are on Windows + WSL2 and Docker Desktop space is not reclaimed immediately:

```powershell
wsl --shutdown
```

## Troubleshooting

### Forecast training DAG timeouts

If `AirQo-forecast-models-training-job` fails with a `TimeoutError` while saving/logging (often during MLflow logging or model upload), you can:

- Increase resilience via retries (enabled in `src/workflows/dags/forecast_training_jobs.py`).
- (Optional) Skip MLflow logging if the tracking server is flaky:

```bash
export SKIP_MLFLOW_ON_ERROR=true
```

- Tune GCS upload retries/backoff (defaults: 3 retries, 5s backoff):

```bash
export GCS_UPLOAD_MAX_RETRIES=5
export GCS_UPLOAD_BACKOFF_SECONDS=10
```

### Forecast training DAG uses a lot of disk locally

The forecast training DAG can generate very large intermediate pandas DataFrames. If these are returned from TaskFlow tasks, Airflow stores them as XComs. With the current setup, the XCom backend writes XCom payloads to disk under the mounted `./airflow_xcom` folder, which can easily grow to tens of GB.

Mitigations:

- Avoid returning large DataFrames from tasks (this DAG has been refactored to keep transformations within a single task per frequency).
- For summary forecast model training, reduce BigQuery training lookback with:
  - `HOURLY_SUMMARY_FORECAST_TRAINING_JOB_SCOPE`
  - `DAILY_SUMMARY_FORECAST_TRAINING_JOB_SCOPE`
- Clean up local XCom payloads if they have already accumulated:

```bash
rm -rf airflow_xcom/*
```

## 3. Running on GCP Cloud Shell

You can access the GCP cloud shell on your browser. Follow this guide <https://cloud.google.com/shell/docs/launching-cloud-shell>

### Zip and Upload Workflows Folder

- After making your changes, zip your workflows folder, and upload it onto the cloud shell terminal.
- Unzip it using the command `unzip workflows.zip`.
- cd into the workflows folder.

### Running workflows only

Run this command.

```bash
sh run-workflows-only.sh
```

Note: You may need to run this command to initialize your Cloud shell if you haven't already or if you're facing authentication errors: `export LD_LIBRARY_PATH=/usr/local/lib`

### Access Preview

Access the web preview in your Browser by clicking on the web preview button and proceed to login.

### TODO

Update documentation on docker compose and kubernetes configurations
