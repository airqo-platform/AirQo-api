#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Function to handle signals and gracefully shut down Gunicorn
_term() {
  echo "Caught SIGTERM signal! Shutting down Gunicorn..."
  kill -TERM "$child" 2>/dev/null
}

# Trap SIGTERM signal
trap _term SIGTERM

# Run Django migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Pre-create logs directory if not exists
echo "Ensuring log directory exists..."
mkdir -p /app/logs

# Start Gunicorn server to serve the Django application
echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application \
  --bind 0.0.0.0:8000 \
  --timeout 600 \
  --log-level info \
  --workers "${GUNICORN_WORKERS:-3}" \
  --access-logfile '-' \
  --error-logfile '-'
