#!/bin/sh

# Use POSIX shell for better compatibility
set -e

# Wait for database to be ready (optional, useful in docker-compose)
until python manage.py check --database default; do
  echo "Waiting for database..."
  sleep 2
done

# Run Django migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Collect static files (skip on permission errors, continue with server)
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || {
    echo "Warning: Static files collection had issues, continuing..."
}

# Start Gunicorn server optimized for production
echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --worker-class sync \
    --worker-connections 1000 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --timeout 120 \
    --keep-alive 2 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
