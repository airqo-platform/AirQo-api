clone project from github.
- `git clone https://github.com/airqo-platform/AirQo-api.git`

change directory to the analytics micro-service
- `cd src/analytics`
- `git fetch origin <branch-name>`
- `git checkout <branch-name>`

create local python environment

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
- `export FLASK_APP=app.py`
- `export FLASK_ENV=development`


Run the Flask App
- `flask run`

# Data sources

The anlytics microservice uses data from the `airqo_analytics` `mongodb` database. The collections in this database are:

| collection | data from | used for |
| --- | --- | --- |
| candidates | | Not currently used. (Transitioned to other databases for different organisations (AirQo and KCCA)) |
| colabs | | Not currently used. (Transitioned to other databases for different organisations (AirQo and KCCA)) |
| defaults | | Not currently used. (Transitioned to other databases for different organisations (AirQo and KCCA)) |
| device_daily_exceedences | From (externally triggered) "cloud function". | |
| device_daily_historical_averages | From (externally triggered) "cloud function". | |
| device_daily_measurements | From "Clarity API". | |
| device_hourly_measurements | From "Clarity API". | |
| device_raw_measurements | From "Clarity API". | |
| devices | | |
| monitoring_site | | |
| pm25_location_categorycount | From (externally triggered) "cloud function". | |
| report_template | Manually entered. | Reporting API. |
| sessions | No data. | Not currently used. |
| users | Manually entered. | Not currently used. (Transitioned to other databases for different organisations (AirQo and KCCA)) |

Cloud functions path: `src\analytics\helpers`
