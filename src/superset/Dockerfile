FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y libpq-dev gcc build-essential \
    libssl-dev libffi-dev python3-dev python3-pip \
    libsasl2-dev libldap2-dev default-libmysqlclient-dev \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Superset and Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install apache-superset

# Copy config
COPY --chown=superset superset_config.py /app/superset_config.py
ENV SUPERSET_CONFIG_PATH=/app/superset_config.py

COPY .env /app/.env

# Create entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8088

CMD ["/app/entrypoint.sh"]
