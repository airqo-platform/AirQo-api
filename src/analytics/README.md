clone project from github.
- `git clone https://github.com/airqo-platform/AirQo-api.git`

change directory to the analytics micro-service
- `cd src/analytics`

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
- `set FLASK_APP=manage.py`
- `set FLASK_ENV=development`

linux/mac
- `export FLASK_APP=manage.py`
- `export FLASK_ENV=development`


Run the Flask App
- `flask run`
