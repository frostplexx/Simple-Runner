# Build stage
FROM node:20-bookworm-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    git \
    build-essential \
    curl \
    wget \
    vim \
    nano \
    net-tools \
    iputils-ping \
    dnsutils \
    netcat-traditional \
    valgrind \
    procps \
    && rm -rf /var/lib/apt/lists/*

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
FROM node:20-bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    bash \
    git \
    sqlite3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

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
