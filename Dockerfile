# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Create necessary directories
RUN mkdir -p public dist

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code, excluding things in .dockerignore
COPY . .

# Ensure public directory exists with content
COPY src/public/ ./public/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache bash git sqlite

WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/data /app/repos /app/public /app/dist \
    && chown -R node:node /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Install production dependencies
RUN npm ci --omit=dev

# Create volume mount points
VOLUME ["/app/data", "/app/repos"]

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/server/index.js"]
