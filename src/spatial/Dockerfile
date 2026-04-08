# Use the official Python image as a base image
FROM python:3.11-slim-bullseye as base

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*
# Set the working directory inside the container
WORKDIR /app/

# Copy the dependencies file to the working directory
COPY requirements.txt requirements.txt

# Install Flask and other dependencies
RUN pip install --upgrade pip setuptools wheel
RUN pip3 install -r requirements.txt

# Copy the entire project directory into the container
COPY . /app/

# Expose the port Flask will run on
ENV FLASK_APP=app.py
EXPOSE 5000

# Command to run the Flask application
FROM base as dev
ENV APP_ENV=development
ENV FLASK_DEBUG=1
CMD flask run --host=0.0.0.0

FROM base as staging
ENV APP_ENV=staging
ENV FLASK_DEBUG=0
CMD gunicorn --bind=0.0.0.0:5000 app:app

FROM base as production
ENV APP_ENV=production
ENV FLASK_DEBUG=0
CMD gunicorn --bind=0.0.0.0:5000 app:app
