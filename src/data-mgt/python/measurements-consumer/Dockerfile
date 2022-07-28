FROM python:3.8-slim-buster as base

COPY . /app/

WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt
RUN python -m pip install -e "git+https://github.com/airqo-platform/AirQo-api.git/#egg=airqo_etl_utils&subdirectory=src/airflow/airqo_etl_utils"

FROM base as process-purple-air-data
CMD [ "python", "main.py", "--task=stream-purple-air-data"]
