#!/bin/bash
set -a

# Load env vars
if [ -f /app/.env ]; then
  source /app/.env
fi
set +a

# Upgrade DB and init Superset
superset db upgrade
superset init

# Run the web server
superset run -h 0.0.0