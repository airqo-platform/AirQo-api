FROM python:3.8-slim-buster

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
COPY requirements.txt requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN python -m pip install -e "git+https://github.com/airqo-platform/AirQo-api.git/#egg=airqo_etl_utils&subdirectory=src/airflow/airqo_etl_utils"


CMD [ "python", "main.py", "--task=stream-purple-air-data"]
