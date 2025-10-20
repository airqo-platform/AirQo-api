FROM python:3.9-slim AS superset

# Install system dependencies
RUN apt-get update && \
    apt-get install -y libpq-dev gcc build-essential \
    libssl-dev libffi-dev python3-dev python3-pip \
    libsasl2-dev libldap2-dev default-libmysqlclient-dev \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install requirements
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY docker /app/docker
RUN chmod +x /app/docker/*.sh

# Uncomment if you are using docker build
# COPY .env /app/.env

# Custom config to use in place of default config
COPY superset_config.py /app/superset_config.py
ENV SUPERSET_CONFIG_PATH=/app/superset_config.py

EXPOSE 8088

ENTRYPOINT ["/app/docker/start_superset.sh"]

# Initialization stage
FROM superset as init-superset
ENTRYPOINT ["/app/docker/init_superset.sh"]

# Redis image
FROM redis:7.2-bookworm as redis
USER root
CMD ["redis-server"]
