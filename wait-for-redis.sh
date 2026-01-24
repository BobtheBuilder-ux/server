#!/bin/bash

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."

# Default Redis host and port
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

# Maximum number of attempts
MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT: Checking Redis connection..."

    # Try to ping Redis
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &>/dev/null; then
        echo "✅ Redis is ready!"
        break
    else
        echo "❌ Redis not ready, waiting..."
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Failed to connect to Redis after $MAX_ATTEMPTS attempts"
    exit 1
fi

# Execute the main command
echo "🚀 Starting application..."
exec "$@"