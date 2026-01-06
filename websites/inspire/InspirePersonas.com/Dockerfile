# JubileePersonas.com - Production Dockerfile
# Build: docker build -t jubilee-personas .
# Run: docker run -p 3006:3006 --env-file .env jubilee-personas

FROM node:20-alpine AS production

LABEL maintainer="Jubilee Solutions"
LABEL description="Jubilee Personas - AI Persona Management"

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

COPY . .

RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=3006

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3006/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
