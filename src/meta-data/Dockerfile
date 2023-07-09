# syntax=docker/dockerfile:1

FROM python:3.9-slim-buster as builder
ARG PROJECT_DIR=/app

RUN apt-get update && apt-get install -y \
  binutils \
  gdal-bin \
  python-gdal \
  libspatialindex-dev

WORKDIR /app/

COPY requirements.txt $PROJECT_DIR/
RUN pip install -r requirements.txt

COPY . $PROJECT_DIR/

ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as development
ENV FLASK_DEBUG=1
CMD flask run --host=0.0.0.0

FROM builder as api
ENV FLASK_DEBUG=0
CMD gunicorn --bind=0.0.0.0:4001 app:app

FROM builder as sites-consumer
CMD ["python", "message-broker.py", "--target=sites-consumer"]
