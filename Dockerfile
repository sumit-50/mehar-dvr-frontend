# ==========================================
# Mehar DVR Frontend - Production Dockerfile
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

# Copy source code and build production bundle
COPY . ./
RUN npm run build

# Stage 2: High-efficiency Node.js production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy built distribution, server runner and package file
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prod-server.js ./prod-server.js
COPY --from=builder /app/package*.json ./

# Expose production HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start production server
CMD ["node", "prod-server.js"]
