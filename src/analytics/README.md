# ANALYTICS MICROSERVICE 

This microservice contains the back-end source code for the AirQo analytics & netmanager platforms.

## Steps to run 
clone project from GitHub.
- `git clone https://github.com/airqo-platform/AirQo-api.git`

change directory to the analytics microservice
- `cd src/analytics`

### Using Docker
#### Prerequisites

- Docker (>= 26.0.0)
- Docker compose (>= v2.26.1)
- `docker compose up`

#### Running locally
- create local python environment

windows

`python -m venv [local_env_name e.g env]`

linux/mac

`python3 -m venv [local_env_name e.g env]`

activate the environment
windows
- `[local_env_name]\Scripts\activate`

linux/mac
- source `[local_env_name]/bin/activate`

Install dependencies using the requirements.txt
- `pip install -r requirements.txt`

set environment variables

windows
- `set FLASK_APP=app.py`
- `set FLASK_ENV=development`

linux/mac
- `export FLASK_APP=manage.py`
- `export FLASK_ENV=development`


Run the Flask App
- `flask run`
