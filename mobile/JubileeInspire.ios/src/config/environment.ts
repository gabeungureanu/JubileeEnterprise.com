/**
 * Jubilee Inspire - Environment Configuration
 *
 * Loads configuration from environment variables.
 * Uses .env file for local development.
 */

import { EnvironmentConfig } from '../types';

// Default configuration values (development)
const defaultConfig: EnvironmentConfig = {
  apiBaseUrl: 'https://api.jubileeverse.com',
  codexApiUrl: 'https://codex.jubileeverse.com/api',
  inspireApiUrl: 'https://inspire.jubileeverse.com/api',
  continuumApiUrl: 'https://continuum.jubileeverse.com/api',
  environment: 'development',
};

// Load environment variables with fallbacks
export const config: EnvironmentConfig = {
  apiBaseUrl: process.env.API_BASE_URL || defaultConfig.apiBaseUrl,
  codexApiUrl: process.env.CODEX_API_URL || defaultConfig.codexApiUrl,
  inspireApiUrl: process.env.INSPIRE_API_URL || defaultConfig.inspireApiUrl,
  continuumApiUrl: process.env.CONTINUUM_API_URL || defaultConfig.continuumApiUrl,
  environment: (process.env.ENVIRONMENT as EnvironmentConfig['environment']) || defaultConfig.environment,
};

// Helper to check if running in development
export const isDevelopment = (): boolean => config.environment === 'development';

// Helper to check if running in production
export const isProduction = (): boolean => config.environment === 'production';

// Export default config
export default config;
