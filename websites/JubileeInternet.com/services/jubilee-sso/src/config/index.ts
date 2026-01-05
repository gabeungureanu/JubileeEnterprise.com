import { z } from 'zod';

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // JWT
  JWT_SIGNING_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ALGORITHM: z.enum(['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']).default('RS256'),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().default(900), // 15 minutes
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().default(604800), // 7 days
  JWT_ID_TOKEN_TTL: z.coerce.number().default(3600), // 1 hour

  // Issuer
  ISSUER_URL: z.string().url(),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL: z.coerce.number().default(86400), // 24 hours

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION: z.coerce.number().default(900), // 15 minutes
  AUTH_CODE_TTL: z.coerce.number().default(600), // 10 minutes

  // CORS
  CORS_ORIGINS: z.string().default('').transform((val) => val.split(',').filter(Boolean)),

  // TLS (for local development)
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config !== null) {
    return config;
  }

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  config = result.data;
  return config;
}

export function getConfig(): Config {
  if (config === null) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return config;
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}
