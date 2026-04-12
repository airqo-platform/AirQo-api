# Use the official Python image as a base image
FROM python:3.11-slim-bullseye AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_APP=app:app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*
# Set the working directory inside the container
WORKDIR /app/

# Copy the dependencies file to the working directory
COPY requirements.txt requirements.txt

# Install Flask and other dependencies
RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -r requirements.txt

# Copy the entire project directory into the container
COPY . .

RUN adduser --disabled-password --gecos "" --home /app appuser \
    && chown -R appuser:appuser /app

USER appuser

# Expose the port Flask will run on
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)" || exit 1

# Command to run the Flask application
FROM base AS dev
ENV APP_ENV=development
ENV FLASK_DEBUG=1
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]

FROM base AS staging
ENV APP_ENV=staging
ENV FLASK_DEBUG=0
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:app"]

FROM base AS production
ENV APP_ENV=production
ENV FLASK_DEBUG=0
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:app"]
