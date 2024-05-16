FROM python:3.10.14-slim-bullseye as base

WORKDIR /app/

COPY requirements.txt requirements.txt

RUN pip install --upgrade pip setuptools wheel --no-cache-dir
RUN pip install -r requirements.txt --no-cache-dir

COPY . /app/

EXPOSE 5000

FROM base as dev
ENV FLASK_ENV=development

CMD ["flask", "run",  "--host=0.0.0.0"]

FROM base as staging
ENV FLASK_ENV=staging
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:flask_app"]

FROM base as production
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:flask_app"]

FROM base as celery
CMD ["celery", "-A", "app", "worker", "--loglevel=info"]

FROM base as devices-summary-job
CMD ["python", "devices_summary.py"]