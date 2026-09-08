# ==========================================
# Mehar DVR Frontend - Production Dockerfile
# ==========================================

# Stage 1: Build stage (Node 22 required for TanStack React Start)
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy package configurations
COPY package*.json ./

# Install dependencies cleanly with legacy peer deps compatibility
RUN npm install --legacy-peer-deps

# Copy source code and build production assets
COPY . ./
RUN npm run build

# Stage 2: High-performance Nginx production server
FROM nginx:alpine AS runner

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
