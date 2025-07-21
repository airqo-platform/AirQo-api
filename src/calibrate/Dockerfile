FROM python:3.7-slim as builder
COPY . /app/
WORKDIR /app/
# RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN pip install -r requirements.txt
ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as production
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind=0.0.0.0:4001", "app:app"]

FROM builder as staging
ENV FLASK_ENV=staging
CMD ["gunicorn", "--bind=0.0.0.0:4001", "app:app"]

FROM builder as dev
ENV FLASK_ENV=development
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as pickle-file
CMD ["python", "jobs/regression.py"]
