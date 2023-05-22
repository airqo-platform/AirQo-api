FROM python:3.9.16-slim as base

RUN apt update
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Production
FROM base as production
ENV ENV=production
CMD ["python", "daily_forecasts.py"]

# Staging
FROM base as staging
ENV ENV=staging
CMD ["python", "daily_forecasts.py"]

# Development
FROM base as development
ENV ENV=development
CMD ["python", "daily_forecasts.py"]