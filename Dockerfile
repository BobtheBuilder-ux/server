# Use the official Bun image
FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with minification
RUN bun install --frozen-lockfile --minify

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and environment
COPY . .
COPY .env* ./

# Build the application with minification
ENV NODE_ENV=production
RUN bun run build

# Production image
FROM base AS runner
LABEL name="homematch-server"
LABEL version="1.0.0"
WORKDIR /app

# Install redis-tools, curl, and postgresql-client for health checks and migrations
RUN apt-get update && apt-get install -y redis-tools curl postgresql-client \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 homematch

# Copy the built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/.env* ./
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db ./src/db

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create necessary directories
RUN mkdir -p uploads logs
RUN chown -R homematch:nodejs uploads logs /usr/local/bin/entrypoint.sh

# Switch to non-root user
USER homematch

# Expose the port
EXPOSE 3031

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3031/health || exit 1

# Use ENTRYPOINT for entrypoint script, CMD for the actual command
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "dist/index.js"]
