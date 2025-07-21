# syntax=docker/dockerfile:1

FROM python:3.9-slim-buster as base

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

FROM base as staging
ENV ENV=staging
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as production
ENV ENV=production
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as uptime
CMD ["python", "uptime.py"]
