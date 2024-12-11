#!/bin/sh

# Exit on error
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Supervisor (which runs Nginx and Gunicorn)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
