# Use Node.js 20 LTS as base image (NestJS 11 requires Node 20+)
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies needed for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Copy settings folder for configuration (will be overridden by environment)
COPY .settings.dev ./.settings.dev

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy settings folder for configuration
COPY --from=builder /app/.settings.dev ./.settings.dev

# Expose port (Cloud Run will inject PORT env variable)
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Start the application
CMD ["node", "dist/main"]