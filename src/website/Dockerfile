# Use Python 3.9-slim as the base image
FROM python:3.9-slim

# Set build-time arguments
ARG DATABASE_URL
ARG CSRF_TRUSTED_ORIGINS
ARG CORS_ALLOWED_ORIGINS

# Set runtime environment variables
ENV DATABASE_URL=$DATABASE_URL \
    CSRF_TRUSTED_ORIGINS=$CSRF_TRUSTED_ORIGINS \
    CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && apt-get clean

# Copy requirements file and install dependencies
COPY requirements.txt ./ 
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code into the container
COPY . .

# Run Django migrations
RUN python manage.py migrate --noinput

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose the port the Django app will run on
EXPOSE 8000

# Start Gunicorn server to serve the Django application
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--log-level", "info"]
