import pino from 'pino';
import { getConfig, isDevelopment } from '../config/index.js';

let logger: pino.Logger | null = null;

export function createLogger(): pino.Logger {
  if (logger !== null) {
    return logger;
  }

  const config = getConfig();

  const options: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'passwordHash',
        'secret',
        'clientSecret',
        'clientSecretHash',
        'accessToken',
        'refreshToken',
        'idToken',
        'authorization',
        'cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
  };

  if (config.LOG_PRETTY || isDevelopment()) {
    logger = pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  } else {
    logger = pino(options);
  }

  return logger;
}

export function getLogger(): pino.Logger {
  if (logger === null) {
    throw new Error('Logger not initialized. Call createLogger() first.');
  }
  return logger;
}

export interface AuditLogData {
  eventType: string;
  userId?: string | null;
  clientId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export function auditLog(data: AuditLogData): void {
  const log = getLogger();

  const sanitizedMetadata = data.metadata !== undefined ? sanitizeMetadata(data.metadata) : {};

  log.info(
    {
      audit: true,
      eventType: data.eventType,
      userId: data.userId ?? null,
      clientId: data.clientId ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      success: data.success,
      ...sanitizedMetadata,
    },
    `AUDIT: ${data.eventType}`
  );
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'key',
    'authorization',
    'cookie',
    'credential',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some((sk) => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
