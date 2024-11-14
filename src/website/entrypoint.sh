#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Run Django migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Collect static files (ensure the static files directory exists)
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start Gunicorn server to serve the Django application
echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --log-level info
