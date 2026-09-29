# Production Dockerfile for Cloud Notes Backup System
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Set environment variables and metadata
ARG GIT_SHA=local
ENV GIT_SHA=$GIT_SHA \
    PORT=3000 \
    NODE_ENV=production

# Security: run as unprivileged node user
USER node

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
