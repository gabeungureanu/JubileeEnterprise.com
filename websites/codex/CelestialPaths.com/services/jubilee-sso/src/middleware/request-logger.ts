import type { Context, Next } from 'hono';
import { getLogger } from '../utils/logger.js';

export async function requestLogger(c: Context, next: Next): Promise<void> {
  const logger = getLogger();
  const start = Date.now();

  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header('user-agent'),
      ip: getClientIp(c),
    },
    'Request started'
  );

  await next();

  const duration = Date.now() - start;

  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
    },
    'Request completed'
  );
}

export function getClientIp(c: Context): string | null {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined) {
    const ips = forwarded.split(',');
    const firstIp = ips[0];
    return firstIp?.trim() ?? null;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp !== undefined) {
    return realIp;
  }

  return null;
}
