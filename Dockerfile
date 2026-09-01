# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files and compile frontend
COPY . .
RUN npm run build

# ==============================================================================
# Stage 2: Production Container (Fastify API + React Static Assets)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy built frontend static assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server source and configuration
COPY server ./server
COPY tsconfig.json ./

# Expose port (default 3001)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start Fastify server (automatically runs DB migrations on boot & serves both API and React SPA)
CMD ["npx", "tsx", "server/src/index.ts"]
