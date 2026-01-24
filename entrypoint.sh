#!/bin/bash

set -e

# Wait for Redis
echo "Waiting for Redis..."
until redis-cli -h redis ping | grep -q PONG; do
  sleep 2
done
echo "Redis is ready."

# Wait for Postgres
echo "Waiting for Postgres..."
until pg_isready -h postgres -U postgres -d homematch; do
  sleep 2
done
echo "Postgres is ready."

# Push schema to database if drizzle config exists
if [ -f "/app/drizzle.config.ts" ]; then
  echo "Running database schema push..."
  if bunx drizzle-kit push --config drizzle.config.ts; then
    echo "Database schema push completed."
  else
    echo "Warning: drizzle-kit push failed. Continuing without blocking startup."
  fi
else
  echo "Warning: /app/drizzle.config.ts not found. Skipping database schema push."
fi

# Execute the main command
exec "$@"
