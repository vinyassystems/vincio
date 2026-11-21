# ==============================================================
# Vincio Studio - Production Multi-Stage Dockerfile
# Real-Time Collaborative Workspace, Terminal & Local AI Hub
# ==============================================================

FROM node:20-bookworm-slim AS base

# Install system dependencies required for node-pty and system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    bash \
    tar \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for cached layer installation
COPY package*.json ./
RUN npm install --omit=dev

# Copy application sources
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=8000

# Expose default HTTP port
EXPOSE 8000

# Start server
CMD ["node", "server.js"]
