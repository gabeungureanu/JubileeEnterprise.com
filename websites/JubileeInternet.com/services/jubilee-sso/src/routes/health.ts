import { Hono } from 'hono';
import { healthCheck as dbHealthCheck } from '../services/database.js';

const health = new Hono();

health.get('/health', async (c) => {
  const dbHealthy = await dbHealthCheck();

  const status = {
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? 'ok' : 'error',
    },
  };

  return c.json(status, dbHealthy ? 200 : 503);
});

health.get('/ready', async (c) => {
  const dbHealthy = await dbHealthCheck();

  if (!dbHealthy) {
    return c.json({ ready: false, reason: 'database not available' }, 503);
  }

  return c.json({ ready: true });
});

health.get('/live', (c) => {
  return c.json({ alive: true });
});

export { health };
