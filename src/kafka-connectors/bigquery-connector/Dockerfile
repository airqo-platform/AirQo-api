# syntax=docker/dockerfile:1

FROM python:3.9-slim-buster as base
ARG PROJECT_DIR=/app

WORKDIR $PROJECT_DIR/

COPY requirements.txt $PROJECT_DIR/
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

COPY . $PROJECT_DIR/

FROM base as sites-source-connector
CMD ["python", "main.py", "--target=sites-source-connector"]

FROM base as devices-source-connector
CMD ["python", "main.py", "--target=devices-source-connector"]

FROM base as airqlouds-source-connector
CMD ["python", "main.py", "--target=airqlouds-source-connector"]
