/**
 * API configuration — matches web frontend apiClient.ts endpoints exactly.
 * Base URLs sourced from environment or defaults.
 */
export const API = {
  // Local development (restore production URLs when deploying)
  // Production: 'https://inspirecontinuum.com/api'
  CONTINUUM_BASE_URL: 'http://192.168.1.52:4003/api',
  // Production: 'https://inspirecodex.com/api/v1'
  CODEX_BASE_URL: 'http://192.168.1.52:4001/api/v1',

  // Timeout in milliseconds
  REQUEST_TIMEOUT: 30_000,
  SYNC_TIMEOUT: 120_000,
  CONNECT_TIMEOUT: 60_000,

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // Sync interval in milliseconds (60 seconds, matching web)
  SYNC_INTERVAL: 60_000,
  SNOOZE_CHECK_INTERVAL: 60_000,
} as const;

/**
 * Storage keys — matches web localStorage keys.
 */
export const StorageKeys = {
  ACCESS_TOKEN: 'jubilee_access_token',
  REFRESH_TOKEN: 'jubilee_refresh_token',
  USER_ID: 'jubilee_user_id',
  SYNC_EMAIL: 'jubilee_sync_email',
  REMEMBER_EMAIL: 'jubilee_remember_email',
  REMEMBER_TOKEN: 'jubilee_remember_token',
  SIGNATURES: 'jubilee_email_signatures',
  ACTIVE_SIGNATURE_ID: 'jubilee_active_signature_id',
  RULES: 'jubilee_email_rules',
  TEMPLATES: 'jubilee_email_templates',
  SNOOZED_MESSAGES: 'jubilee_snoozed_messages',
  NOTIFICATIONS_ENABLED: 'jubilee_notifications_enabled',
} as const;
