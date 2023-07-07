FROM python:3.9.16-slim as base

RUN apt update
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Production - daily forecasts
FROM base as production_daily
ENV ENV=production
CMD ["python", "daily_forecasts.py"]

# Production - hourly forecasts
FROM base as production_hourly
ENV ENV=production
CMD ["python", "hourly_forecasts.py"]

# Staging - daily forecasts
FROM base as staging_daily
ENV ENV=staging
CMD ["python", "daily_forecasts.py"]
# Staging - hourly forecasts
FROM base as staging_hourly
ENV ENV=staging
CMD ["python", "hourly_forecasts.py"]

# Development - daily forecasts
FROM base as development_daily
ENV ENV=development
CMD ["python", "daily_forecasts.py"]
# Development - hourly forecasts
FROM base as development_hourly
ENV ENV=development
CMD ["python", "hourly_forecasts.py"]