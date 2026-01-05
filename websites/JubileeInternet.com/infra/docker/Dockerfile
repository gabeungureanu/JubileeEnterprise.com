# =============================================================================
# Jubilee SSO Service - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal production image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY services/jubilee-sso/package*.json ./services/jubilee-sso/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspace=@jubilee/sso --workspace=@jubilee/shared

# Copy source code
COPY services/jubilee-sso ./services/jubilee-sso
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build packages
RUN npm run build --workspace=@jubilee/shared
RUN npm run build --workspace=@jubilee/sso

# Prune dev dependencies
RUN npm prune --production --workspace=@jubilee/sso --workspace=@jubilee/shared

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S jubilee && \
    adduser -S jubilee -u 1001 -G jubilee

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=jubilee:jubilee /app/node_modules ./node_modules
COPY --from=builder --chown=jubilee:jubilee /app/services/jubilee-sso/dist ./services/jubilee-sso/dist
COPY --from=builder --chown=jubilee:jubilee /app/services/jubilee-sso/node_modules ./services/jubilee-sso/node_modules
COPY --from=builder --chown=jubilee:jubilee /app/services/jubilee-sso/package.json ./services/jubilee-sso/
COPY --from=builder --chown=jubilee:jubilee /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=jubilee:jubilee /app/packages/shared/package.json ./packages/shared/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER jubilee

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start service
WORKDIR /app/services/jubilee-sso
CMD ["node", "dist/index.js"]
