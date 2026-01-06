import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { getLogger } from '../utils/logger.js';
import { isProduction } from '../config/index.js';

export async function errorHandler(c: Context, next: Next): Promise<Response> {
  try {
    await next();
  } catch (error) {
    const logger = getLogger();

    if (error instanceof HTTPException) {
      logger.warn(
        {
          status: error.status,
          message: error.message,
          path: c.req.path,
        },
        'HTTP exception'
      );

      return c.json(
        {
          error: getErrorCode(error.status),
          error_description: error.message,
        },
        error.status
      );
    }

    if (error instanceof ZodError) {
      logger.warn(
        {
          errors: error.errors,
          path: c.req.path,
        },
        'Validation error'
      );

      return c.json(
        {
          error: 'invalid_request',
          error_description: 'Request validation failed',
          details: isProduction() ? undefined : error.errors,
        },
        400
      );
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: c.req.path,
      },
      'Unhandled error'
    );

    return c.json(
      {
        error: 'server_error',
        error_description: isProduction() ? 'Internal server error' : String(error),
      },
      500
    );
  }

  return c.res;
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'invalid_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'access_denied';
    case 404:
      return 'not_found';
    case 405:
      return 'method_not_allowed';
    case 429:
      return 'too_many_requests';
    default:
      return 'server_error';
  }
}
