# Use Python 3.11-slim as the base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    nginx \
    supervisor \
    && apt-get clean

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Make sure we have a directory for static files (to serve them via Nginx)
RUN mkdir -p /usr/share/nginx/html/static/

# Add execute permission to entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Default port for Cloud Run is 8080, ensure Nginx listens on this port
ENV PORT 8080
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
