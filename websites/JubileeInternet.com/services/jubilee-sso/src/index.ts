import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadConfig, getConfig } from './config/index.js';
import { createLogger, getLogger } from './utils/logger.js';
import { getDatabase, closeDatabase } from './services/database.js';
import { initializeKeys } from './services/jwt.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { securityHeaders, corsMiddleware } from './middleware/security.js';
import { health } from './routes/health.js';
import { wellKnown } from './routes/well-known.js';
import { oauth } from './routes/oauth.js';

async function main(): Promise<void> {
  loadConfig();
  const config = getConfig();

  createLogger();
  const logger = getLogger();

  logger.info('Starting Jubilee SSO service...');

  getDatabase();

  await initializeKeys();
  logger.info('JWT keys initialized');

  const app = new Hono();

  app.use('*', errorHandler);
  app.use('*', requestLogger);
  app.use('*', securityHeaders);
  app.use('*', corsMiddleware);

  app.route('/', health);
  app.route('/', wellKnown);
  app.route('/', oauth);

  app.notFound((c) => {
    return c.json({ error: 'not_found', error_description: 'Endpoint not found' }, 404);
  });

  const server = serve({
    fetch: app.fetch,
    port: config.PORT,
    hostname: config.HOST,
  });

  logger.info({ port: config.PORT, host: config.HOST }, 'Jubilee SSO service started');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close();
    await closeDatabase();

    logger.info('Jubilee SSO service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  const logger = getLogger();
  logger.fatal({ error }, 'Failed to start Jubilee SSO service');
  process.exit(1);
});
