# Use the official Python image as a base image
FROM python:3.9-slim-buster as base

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
ENV FLASK_ENV=development
CMD flask run --host=0.0.0.0

FROM base as staging
ENV FLASK_ENV=staging
CMD gunicorn --bind=0.0.0.0:5000 app:app

FROM base as production
ENV FLASK_ENV=production
CMD gunicorn --bind=0.0.0.0:5000 app:app
