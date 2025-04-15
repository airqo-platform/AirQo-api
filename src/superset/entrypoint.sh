#!/bin/bash
set -aex

# Load env vars
if [ -f /app/.env ]; then
  source /app/.env
else
  echo "⚠️  No .env file found at /app/.env"
fi
set +a

echo "🚀 Running DB upgrade..."
superset db upgrade

echo "👤 Creating admin user..."
superset fab create-admin \
  --username "$SUPERSET_ADMIN_USERNAME" \
  --firstname "$SUPERSET_ADMIN_FIRSTNAME" \
  --lastname "$SUPERSET_ADMIN_LASTNAME" \
  --email "$SUPERSET_ADMIN_EMAIL" \
  --password "$SUPERSET_ADMIN_PASSWORD"

echo "🎨 Initializing Superset..."
superset init

echo "🖥️  Starting Superset server on 0.0.0.0:8088..."
superset run -h 0.0.0.0 -p 8088
