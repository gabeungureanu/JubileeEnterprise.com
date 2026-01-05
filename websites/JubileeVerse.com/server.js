/**
 * JubileeVerse - Server Entry Point
 *
 * Minimal bootstrap file responsible only for:
 * - Loading configuration
 * - Initializing cache (Redis)
 * - Initializing database connections
 * - Creating the Express application
 * - Starting the HTTP server
 * - Graceful shutdown handling
 */

const config = require('./src/config');
const logger = require('./src/utils/logger');
const database = require('./src/database');
const { RedisClient } = require('./src/cache');
const { QueueManager, WebSocketService, AIResponseProcessor } = require('./src/queue');
const { AttachmentCleanupJob, MonthlyAnalyticsAggregationJob } = require('./src/jobs');
const { setPgPool } = require('./src/middleware');
const createApp = require('./src/app');

/**
 * Bootstrap and start the server
 */
async function start() {
  try {
    // Initialize Redis cache first (sessions depend on it)
    await RedisClient.initialize();
    logger.info('Cache initialized', { mock: RedisClient.isMock() });

    // Initialize database connections
    await database.initialize();

    // Set PostgreSQL pool for session store (allows sessions to persist across restarts)
    const pgPool = database.getPostgres();
    if (pgPool && !pgPool.mock) {
      setPgPool(pgPool);
      logger.info('Session store configured with PostgreSQL');
    }

    // Create Express application
    const app = createApp();

    // Start HTTP server
    const PORT = config.server.port;
    const HOST = config.server.host;

    const server = app.listen(PORT, HOST, () => {
      logger.info('JubileeVerse server running', {
        host: HOST,
        port: PORT,
        env: config.server.env
      });
      logger.info(`Open http://${HOST}:${PORT} in your browser`);
    });

    // Initialize WebSocket server
    WebSocketService.initialize(server, { path: '/ws' });
    logger.info('WebSocket server initialized');

    // Initialize queue workers
    AIResponseProcessor.initializeWorker({
      concurrency: config.queue?.concurrency || 10,
      rateLimit: config.queue?.rateLimit || 50
    });
    logger.info('Queue workers initialized');

    // Start scheduled jobs
    AttachmentCleanupJob.start();
    logger.info('Attachment cleanup job started');

    MonthlyAnalyticsAggregationJob.start();
    logger.info('Monthly analytics aggregation job started');

    // Graceful shutdown handling
    setupGracefulShutdown(server);

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Stop scheduled jobs
        AttachmentCleanupJob.stop();
        MonthlyAnalyticsAggregationJob.stop();
        logger.info('Scheduled jobs stopped');

        // Shutdown WebSocket server
        await WebSocketService.shutdown();
        logger.info('WebSocket server closed');

        // Shutdown queue workers and connections
        await QueueManager.shutdown();
        logger.info('Queue workers closed');

        // Shutdown database and cache
        await database.shutdown();
        await RedisClient.shutdown();
        logger.info('Database and cache connections closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Check if running under IISNode
if (process.env.IISNODE_VERSION) {
  // Running under IISNode - need to start listening on the named pipe
  logger.info('Starting JubileeVerse under IISNode');

  // Initialize and start listening asynchronously
  (async () => {
    try {
      // Initialize services first
      await RedisClient.initialize();
      logger.info('Cache initialized', { mock: RedisClient.isMock() });

      await database.initialize();
      logger.info('Database initialized');

      const pgPool = database.getPostgres();
      if (pgPool && !pgPool.mock) {
        setPgPool(pgPool);
        logger.info('Session store configured with PostgreSQL');
      }

      // Create and start the app
      const app = createApp();

      // IISNode provides the port via process.env.PORT (named pipe)
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        logger.info('JubileeVerse listening for IISNode', { port: PORT });
      });

      // Initialize background workers
      AIResponseProcessor.initializeWorker({
        concurrency: config.queue?.concurrency || 10,
        rateLimit: config.queue?.rateLimit || 50
      });
      logger.info('Queue workers initialized');

      AttachmentCleanupJob.start();
      MonthlyAnalyticsAggregationJob.start();
      logger.info('Background jobs started');

      logger.info('JubileeVerse fully initialized for IISNode');
    } catch (error) {
      logger.error('IISNode initialization error', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  })();
} else {
  // Running standalone - start the server normally
  start();
  module.exports = { start };
}
