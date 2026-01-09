import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { loadConfig, getConfig } from './config/index.js';
import { getDatabase, closeDatabase } from './db/database.js';
import { health } from './routes/health.js';
import { domains } from './routes/domains.js';
import { webhooks } from './routes/webhooks.js';

async function main(): Promise<void> {
  loadConfig();
  const config = getConfig();

  console.log('Starting Inspire Web Spaces Backend...');

  // Initialize database connection
  getDatabase();

  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }));

  // Security headers
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    await next();
  });

  // Routes
  app.route('/', health);
  app.route('/api/domains', domains);
  app.route('/webhooks', webhooks);

  // Root endpoint - HTML welcome page
  app.get('/', (c) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspire Web Spaces Portal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(90deg, #e94560, #f39c12);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      color: #a0a0a0;
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }
    .description {
      color: #ccc;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .links {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    a {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #e94560;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s, background 0.2s;
    }
    a:hover {
      background: #d63850;
      transform: translateY(-2px);
    }
    a.secondary {
      background: transparent;
      border: 2px solid #e94560;
    }
    a.secondary:hover {
      background: #e94560;
    }
    .note {
      margin-top: 2rem;
      padding: 1rem;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      font-size: 0.9rem;
      color: #a0a0a0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Inspire Web Spaces Portal</h1>
    <p class="subtitle">SSO & Web Space Registry</p>
    <p class="description">
      Welcome to Inspire Web Spaces. This is the central authentication
      and web space registration service for the Jubilee ecosystem, including
      Jubilee Browser, Jubilee Bible, and JubileeVerse.
    </p>
    <div class="links">
      <a href="http://localhost:3003">Open Portal</a>
      <a href="/api" class="secondary">API Documentation</a>
      <a href="/health" class="secondary">Health Check</a>
    </div>
    <p class="note">
      This backend API server is running. For the full web experience,
      visit the frontend at <a href="http://localhost:3003" style="background:none;padding:0;color:#e94560;">localhost:3003</a>
    </p>
  </div>
</body>
</html>`;
    return c.html(html);
  });

  // API info
  app.get('/api', (c) => {
    return c.json({
      name: 'Inspire Web Spaces API',
      version: '0.1.0',
      description: 'SSO Portal & Web Space Registry for Inspire Web Spaces',
      endpoints: {
        domains: '/api/domains',
        tlds: '/api/domains/tlds',
        health: '/health',
      },
      documentation: 'https://inspirewebspaces.com/docs/api',
      note: 'This web space registry operates within the Worldwide Bible Web namespace only. Web spaces registered here do not exist on the public Internet/ICANN DNS.',
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: 'not_found', error_description: 'Endpoint not found' }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500);
  });

  const server = serve({
    fetch: app.fetch,
    port: config.PORT,
    hostname: config.HOST,
  });

  console.log(`Inspire Web Spaces Backend running on http://${config.HOST}:${config.PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down...`);
    server.close();
    await closeDatabase();
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
