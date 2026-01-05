import { z } from 'zod';

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1),

  // SSO Integration
  SSO_ISSUER_URL: z.string().url(),
  SSO_JWKS_URL: z.string().url().optional(),
  SSO_CLIENT_ID: z.string().min(1),
  SSO_CLIENT_SECRET: z.string().optional(),

  // Domain Registry
  DEFAULT_DOMAIN_PRICE_CENTS: z.coerce.number().default(300), // $3.00
  DOMAIN_REGISTRATION_YEARS_DEFAULT: z.coerce.number().default(1),
  DOMAIN_REGISTRATION_YEARS_MAX: z.coerce.number().default(10),

  // Payment (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Frontend URL
  FRONTEND_URL: z.string().url().default('http://localhost:3002'),

  // Session
  SESSION_SECRET: z.string().min(32),

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

// Jubilee TLD Configuration
export const JUBILEE_TLDS = {
  // Restricted - Official Jubilee Use Only
  inspire: {
    displayName: '.inspire',
    description: 'Reserved for official Jubilee personas and system entities',
    isRestricted: true,
    requiresVerification: true,
  },

  // Open Registration TLDs
  apostle: {
    displayName: '.apostle',
    description: 'For apostolic ministries and leaders',
    isRestricted: false,
    requiresVerification: false,
  },
  prophet: {
    displayName: '.prophet',
    description: 'For prophetic ministries and voices',
    isRestricted: false,
    requiresVerification: false,
  },
  evangelist: {
    displayName: '.evangelist',
    description: 'For evangelistic outreach and ministries',
    isRestricted: false,
    requiresVerification: false,
  },
  shepherd: {
    displayName: '.shepherd',
    description: 'For pastoral care and shepherding ministries',
    isRestricted: false,
    requiresVerification: false,
  },
  teacher: {
    displayName: '.teacher',
    description: 'For teaching ministries and educators',
    isRestricted: false,
    requiresVerification: false,
  },
  community: {
    displayName: '.community',
    description: 'For faith communities and groups',
    isRestricted: false,
    requiresVerification: false,
  },
  church: {
    displayName: '.church',
    description: 'For churches and congregations',
    isRestricted: false,
    requiresVerification: false,
  },
  faith: {
    displayName: '.faith',
    description: 'For faith-based initiatives and personal ministries',
    isRestricted: false,
    requiresVerification: false,
  },
  ministry: {
    displayName: '.ministry',
    description: 'For all types of ministry work',
    isRestricted: false,
    requiresVerification: false,
  },
  worship: {
    displayName: '.worship',
    description: 'For worship ministries and music',
    isRestricted: false,
    requiresVerification: false,
  },
  prayer: {
    displayName: '.prayer',
    description: 'For prayer ministries and intercessors',
    isRestricted: false,
    requiresVerification: false,
  },
} as const;

export type JubileeTLDKey = keyof typeof JUBILEE_TLDS;
