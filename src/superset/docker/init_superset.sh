#!/bin/bash
set -ae

# Load env vars
if [ -f /app/.env ]; then
  # For local development if using docker build
  source /app/.env
else
  echo "⚠️  No .env file found at /app/.env. Assuming env vars are set via Docker or Compose."
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
