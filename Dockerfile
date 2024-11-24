# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Create necessary directories
RUN mkdir -p src/public dist

# Copy package files
COPY package*.json ./

# Install dependencies including devDependencies
RUN npm install

RUN npm update

# Copy source code
COPY . .

# Build TypeScript and copy files
RUN npm run build:ts && \
    cp -r src/public dist/

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache bash git sqlite

WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/repos /app/dist \
    && chown -R node:node /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Copy built files and public directory
COPY --from=builder /app/dist ./dist/
RUN chown -R node:node ./dist

# Install production dependencies
RUN npm ci --omit=dev

# Create volume mount points
VOLUME ["/app/data", "/app/repos"]

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start command
CMD ["node", "dist/server/index.js"]
