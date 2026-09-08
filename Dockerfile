# ==========================================
# Mehar DVR Frontend - Production Dockerfile
# TanStack Start SSR & Client Runtime
# ==========================================

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy package configurations
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code and build production server & client bundle
COPY . ./
RUN npm run build

# Stage 2: High-efficiency Node.js production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Copy built server output and assets from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package*.json ./

# Expose TanStack Start SSR port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Launch TanStack Start server
CMD ["node", ".output/server/index.mjs"]
