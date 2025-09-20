#!/bin/sh

# Use POSIX shell for better compatibility
set -e

# Fix permissions for mounted volumes if needed (for Docker environments)
if [ -d "/app/staticfiles" ]; then
    chmod -R 755 /app/staticfiles 2>/dev/null || true
fi
if [ -d "/app/logs" ]; then
    chmod -R 755 /app/logs 2>/dev/null || true
fi

# Wait for database to be ready (optional, useful in docker-compose)
# Use bounded retries and configurable backoff to avoid infinite loops.
max_tries=${DB_WAIT_MAX_TRIES:-60}
sleep_seconds=${DB_WAIT_INTERVAL_SECONDS:-2}
for i in $(seq 1 "$max_tries"); do
  if python manage.py check --database default >/dev/null 2>&1; then
    break
  fi
  echo "Waiting for database... ($i/$max_tries)"
  sleep "$sleep_seconds"
done
if [ "$i" -eq "$max_tries" ]; then
  echo "Database not ready after $((max_tries*sleep_seconds))s. Exiting."
  exit 1
fi

# Run Django migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Collect static files. In production, fail fast if collectstatic fails.
echo "Collecting static files..."
if ! python manage.py collectstatic --noinput --clear; then
  # Allow continuing in DEBUG mode for local development convenience.
  if [ "${DEBUG:-false}" = "true" ]; then
    echo "Warning: collectstatic failed, continuing (DEBUG=true)..."
  else
    echo "collectstatic failed, exiting (DEBUG!=true)."
    exit 1
  fi
fi

# Start Gunicorn server optimized for production with large upload support
echo "Starting Gunicorn server..."
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --worker-class sync \
    --worker-connections 1000 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --timeout 300 \
    --keep-alive 5 \
    --limit-request-line 8192 \
    --limit-request-field_size 32768 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
