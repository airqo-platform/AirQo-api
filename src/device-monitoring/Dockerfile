# Inherit from the Python Docker image
FROM python:3.7-slim as base

# Copy the source code to app folder
COPY . /app/
# Change the working directory
WORKDIR /app/

# Install the Flask package via pip
RUN pip install -r requirements.txt
# Set "python" as the entry point
# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001

# Expose the application's port, default is 5000 for python flask
EXPOSE 4001

FROM base as dev
ENV FLASK_ENV=development

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM base as staging
ENV FLASK_ENV=staging

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM base as production
ENV FLASK_ENV=production

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]
