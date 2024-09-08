# syntax=docker/dockerfile:1

FROM python:3.10-slim-bullseye as base

WORKDIR /app/

COPY requirements.txt requirements.txt

RUN pip install --upgrade pip setuptools wheel
RUN pip3 install -r requirements.txt

COPY . /app/

ENV FLASK_APP=manage.py
EXPOSE 5000

FROM base as dev
ENV FLASK_ENV=development

CMD ["flask", "run", "--host=0.0.0.0"]

FROM base as staging
ENV FLASK_ENV=staging
CMD ["gunicorn", "--bind=0.0.0.0:5000", "manage:app"]

FROM base as production
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind=0.0.0.0:5000", "manage:app"]

FROM base as celery-beat
CMD celery -A celery_app.celery beat

FROM base as celery-worker
CMD celery -A celery_app.celery worker -Q analytics --loglevel=info

FROM base as devices-summary-job
CMD ["python", "devices_summary.py"]