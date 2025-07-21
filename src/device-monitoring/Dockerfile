# syntax=docker/dockerfile:1
FROM python:3.9-slim-buster as base

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
RUN pip3 install -r requirements.txt

ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001

EXPOSE 4001

FROM base as dev
ENV FLASK_ENV=development
CMD flask run --host=0.0.0.0

FROM base as staging
ENV FLASK_ENV=staging
CMD gunicorn --bind=0.0.0.0:4001 app:app

FROM base as production
ENV FLASK_ENV=production
CMD gunicorn --bind=0.0.0.0:4001 app:app

FROM base as celery-beat
CMD celery -A app.celery beat

FROM base as celery-worker
CMD celery -A app.celery worker -Q collocation --loglevel=info
