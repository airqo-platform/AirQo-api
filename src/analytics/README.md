fetch branch from github.
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

| collection | description |
| --- | --- |
| candidates | |
| colabs | |
| defaults | |
| device_daily_exceedences | |
| device_daily_historical_averages | |
| device_daily_measurements | |
| device_hourly_measurements | |
| device_raw_measurements | |
| devices | |
| monitoring_site | |
| pm25_location_categorycount | |
| report_template | |
| sessions | |
| users | |