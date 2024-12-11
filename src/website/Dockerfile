# Use Python 3.11-slim as the base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies, including nginx, supervisor, and gettext for envsubst
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    nginx \
    supervisor \
    gettext \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . .

# Remove default Nginx configuration if it exists
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration template
COPY nginx.conf /etc/nginx/nginx.conf.template

# Ensure staticfiles directory exists for Nginx
RUN mkdir -p /usr/share/nginx/html/static/

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Make entrypoint.sh executable
RUN chmod +x /app/entrypoint.sh

# Set the PORT environment variable (Cloud Run uses 8080 by default)
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
