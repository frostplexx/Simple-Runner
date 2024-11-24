# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache bash git sqlite

WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create app directories
RUN mkdir -p /app/data /app/repos \
    && chown -R node:node /app

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
