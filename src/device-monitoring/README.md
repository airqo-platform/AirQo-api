clone project from github.
- `git clone https://github.com/airqo-platform/AirQo-api.git`

change directory to the analytics micro-service
- `cd src/device-monitoring`

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

set environment variables in the `.env file`
* required keys
    * **FLASK_APP** e.g `app.py`
    * **FLASK_ENV**
    * **FLASK_RUN_PORT**
    * **MONGO_GCE_URI**
    * **MONGO_DEV_URI**
    * **DB_NAME_DEV**
    * **DB_NAME_PROD**
    * **DB_NAME_STAGE**
    * **REDIS_URL_PROD**
    * **REDIS_URL_DEV**
    * **REDIS_URL_STAGE**
    * **SECRET_KEY**


Run the Flask App
- `flask run`
