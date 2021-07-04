# Inherit from the Python Docker image
FROM python:3.7-slim

ARG BOOTSTRAP_SERVERS=127.0.0.1:9092
ARG SCHEMA_REGISTRY=http://127.0.0.1:8081

# Copy the source code to app folder
COPY . /app/

# Change the working directory
WORKDIR /app/

# Install and cache requirements via pip,
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

ENV SCHEMA_REGISTRY_URL=$SCHEMA_REGISTRY \
    BOOTSTRAP_SERVERS=$BOOTSTRAP_SERVERS

# Run the application
CMD ["python", "controllers/kafka.py"]
