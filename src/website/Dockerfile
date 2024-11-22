# Use Python 3.9-slim as the base image
FROM python:3.9-slim

# Set runtime environment variables to suppress bytecode and buffering
ENV PYTHONDONTWRITEBYTECODE=1 \
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

# Use a wait-for-it script to ensure the database is ready before running migrations
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Run Django migrations (database must be ready)
RUN /wait-for-it.sh db:2023 -- python manage.py migrate --noinput

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose the port the Django app will run on
EXPOSE 8000

# Start Gunicorn server to serve the Django application
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--log-level", "info"]
