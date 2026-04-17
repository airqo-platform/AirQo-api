#!/bin/bash
set -e

echo "==> Checking Alembic migration status..."

# Get the current database revision (returns empty if no version table exists yet)
CURRENT=$(alembic current 2>/dev/null | grep -oE '^[a-f0-9]+' || true)

# Get the latest head revision from the migration files
HEAD=$(alembic heads 2>/dev/null | grep -oE '^[a-f0-9]+' || true)

if [ -z "$HEAD" ]; then
    echo "==> WARNING: No Alembic head revision found. Skipping migrations."
elif [ "$CURRENT" = "$HEAD" ]; then
    echo "==> Database is up to date (revision: $CURRENT). No migration needed."
else
    if [ -z "$CURRENT" ]; then
        echo "==> No current revision detected. Running initial migration..."
    else
        echo "==> Database is behind (current: $CURRENT, head: $HEAD). Upgrading..."
    fi
    alembic upgrade head
    echo "==> Migration complete."
fi

echo "==> Starting application..."
exec "$@"
