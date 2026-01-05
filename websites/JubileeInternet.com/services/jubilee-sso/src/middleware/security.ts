import type { Context, Next } from 'hono';
import { getConfig } from '../config/index.js';

export async function securityHeaders(c: Context, next: Next): Promise<void> {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');

  if (c.req.url.startsWith('https://')) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  await next();
}

export async function corsMiddleware(c: Context, next: Next): Promise<Response | void> {
  const config = getConfig();
  const origin = c.req.header('origin');

  if (origin !== undefined && (config.CORS_ORIGINS.length === 0 || config.CORS_ORIGINS.includes(origin))) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
}

export async function rateLimitCheck(c: Context, next: Next): Promise<void> {
  await next();
}
