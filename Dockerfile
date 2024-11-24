# Build stage
FROM node:20-alpine as builder

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

# Install production dependencies only
RUN npm ci --only=production

# Create volume mount points
VOLUME ["/data", "/repos"]

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/server/index.js"]
