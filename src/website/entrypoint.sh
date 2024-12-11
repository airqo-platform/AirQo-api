#!/bin/sh

# Exit on error
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Move collected static files to the Nginx static directory
echo "Moving static files to Nginx directory..."
cp -r /app/staticfiles/* /usr/share/nginx/html/static/

# Substitute environment variables in nginx.conf.template and generate nginx.conf
echo "Configuring Nginx to listen on PORT=${PORT}..."
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "Starting Supervisor (which runs Nginx and Gunicorn)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
