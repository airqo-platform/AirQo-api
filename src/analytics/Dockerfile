# syntax=docker/dockerfile:1

FROM python:3.10-slim-bullseye as base

WORKDIR /app/

COPY requirements.txt requirements.txt

RUN pip install --upgrade pip setuptools wheel
RUN pip3 install -r requirements.txt

COPY . /app/

# Matches the Service targetPort in k8s/analytics/values-{stage,prod}.yaml.
EXPOSE 5000

FROM base as dev
ENV APP_ENV=development
CMD ["uvicorn", "main:app", "--host=0.0.0.0", "--port=5000", "--reload"]

FROM redis:7.2-bookworm as redis
USER root
CMD ["redis-server"]

# Worker count is read from WEB_CONCURRENCY (gunicorn honours it natively), so
# it can be tuned from the configmap without a rebuild. Keep it in step with
# the CPU limit in values-*.yaml — 4 workers against a 250m limit thrashes.
FROM base as staging
ENV APP_ENV=staging
ENV WEB_CONCURRENCY=2
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind=0.0.0.0:5000"]

FROM base as production
ENV APP_ENV=production
ENV WEB_CONCURRENCY=2
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind=0.0.0.0:5000"]

FROM base as celery-beat
CMD ["celery", "-A", "celery_app.celery", "beat"]

FROM base as celery-worker
CMD ["celery", "-A", "celery_app.celery", "worker", "-Q", "analytics", "--loglevel=info"]

FROM base as devices-summary-job
CMD ["python", "devices_summary.py"]
