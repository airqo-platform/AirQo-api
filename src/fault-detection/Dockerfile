# Inherit from the Python Docker image
FROM python:3.7-slim as builder

# Copy the source code to app folder
COPY . /app/
# Change the working directory
WORKDIR /app/

# Install the Flask package via pip
# RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN pip install -r requirements.txt
# Set "python" as the entry point
# Set environment variables
ENV FLASK_APP=app.py

# Expose the application's port, default is 5000 for python flask
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as production
ENV FLASK_ENV=production
# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as staging
ENV FLASK_ENV=staging
# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as dev
ENV FLASK_ENV=development
# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as pickle-file
CMD ["python", "jobs/regression.py"]