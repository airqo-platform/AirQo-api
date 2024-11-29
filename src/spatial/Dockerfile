# Use the official Python image as a base image
FROM python:3.10-slim-bullseye as base

# Install system dependencies for GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    libgomp1 \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    proj-bin \
    && rm -rf /var/lib/apt/lists/*
# Set the working directory inside the container
WORKDIR /app/

# Set environment variable for GDAL version
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

#install tensorflow
#RUN pip install tensorflow==2.11.1 --no-deps
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
ENV FLASK_ENV=development
CMD flask run --host=0.0.0.0

FROM base as staging
ENV FLASK_ENV=staging
CMD gunicorn --bind=0.0.0.0:5000 app:app

FROM base as production
ENV FLASK_ENV=production
CMD gunicorn --bind=0.0.0.0:5000 app:app
