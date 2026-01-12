/**
 * PM2 Ecosystem Configuration - PRODUCTION
 *
 * ============================================================================
 * WARNING: PRODUCTION CONFIGURATION - DO NOT MODIFY PORT ASSIGNMENTS
 * ============================================================================
 *
 * All ports are LOCKED to match Cloudflare tunnel configuration.
 * Changing ports will break public website access.
 *
 * Port Registry (Cloudflare Tunnel Mapped):
 *   3000  - JubileeVerse.com      (AI chatbot advanced)
 *   3001  - JubileeInspire.com    (AI chatbot simple)
 *   3008  - JubileeWebsites.com   (AI website generator)
 *   3009  - JubileeParadox.com    (Book/Movie site)
 *   3100  - InspireCodex.com      (Codex API)
 *   3101  - InspireContinuum.com  (Continuum API)
 *   3200  - JubileeBrowser.com    (Browser downloads)
 *   3300  - CelestialPaths.com    (Domain registrar)
 *   3847  - wwBibleweb.com        (Webspace hosting)
 *
 * Commands:
 *   pm2 start ecosystem.config.cjs     - Start all services
 *   pm2 stop all                       - Stop all services
 *   pm2 restart all                    - Restart all services
 *   pm2 status                         - View status
 *   pm2 logs                           - View logs
 *   pm2 monit                          - Real-time monitoring dashboard
 *   pm2 save                           - Save current process list
 *   pm2-startup install                - Enable Windows startup
 */

'use strict';

// ============================================================================
// PORT REGISTRY - LOCKED CONFIGURATION
// DO NOT MODIFY THESE VALUES
// ============================================================================
const PORTS = Object.freeze({
  JUBILEE_VERSE:      3000,
  JUBILEE_INSPIRE:    3001,
  JUBILEE_WEBSITES:   3008,
  JUBILEE_PARADOX:    3009,
  INSPIRE_CODEX:      3100,
  INSPIRE_CONTINUUM:  3101,
  JUBILEE_BROWSER:    3200,
  CELESTIAL_PATHS:    3300,
  WW_BIBLEWEB:        3847
});

// Base paths
const BASE_PATH = 'C:/data/JubileeEnterprise.com';
const CODEX_PATH = `${BASE_PATH}/websites/codex`;
const LOGS_PATH = `${BASE_PATH}/logs`;

// Common production settings
const PRODUCTION_DEFAULTS = {
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  watch: false,
  max_memory_restart: '500M',
  restart_delay: 3000,
  max_restarts: 50,        // High restart limit for 24/7 operation
  min_uptime: '10s',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  kill_timeout: 10000,
  listen_timeout: 10000,
  shutdown_with_message: true,
  wait_ready: false,
  exp_backoff_restart_delay: 100  // Exponential backoff for restarts
};

module.exports = {
  apps: [
    // ===========================================
    // CORE AI SERVICES
    // ===========================================
    {
      name: 'JubileeVerse',
      script: 'server.js',
      cwd: `${CODEX_PATH}/JubileeVerse.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.JUBILEE_VERSE,
        DB_MOCK: 'true'
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/jubilee-verse-error.log`,
      out_file: `${LOGS_PATH}/jubilee-verse-out.log`
    },
    {
      name: 'JubileeInspire',
      script: 'server.js',
      cwd: `${CODEX_PATH}/JubileeInspire.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.JUBILEE_INSPIRE
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/jubilee-inspire-error.log`,
      out_file: `${LOGS_PATH}/jubilee-inspire-out.log`
    },

    // ===========================================
    // API SERVICES
    // ===========================================
    {
      name: 'InspireCodex',
      script: 'server.js',
      cwd: `${CODEX_PATH}/InspireCodex.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.INSPIRE_CODEX
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/inspire-codex-error.log`,
      out_file: `${LOGS_PATH}/inspire-codex-out.log`
    },
    {
      name: 'InspireContinuum',
      script: 'server.js',
      cwd: `${CODEX_PATH}/InspireContinuum.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.INSPIRE_CONTINUUM
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/inspire-continuum-error.log`,
      out_file: `${LOGS_PATH}/inspire-continuum-out.log`
    },

    // ===========================================
    // WEBSITE SERVICES
    // ===========================================
    {
      name: 'wwBibleweb',
      script: 'server.js',
      cwd: `${CODEX_PATH}/wwBibleweb.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.WW_BIBLEWEB
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/wwbibleweb-error.log`,
      out_file: `${LOGS_PATH}/wwbibleweb-out.log`
    },
    {
      name: 'JubileeBrowser',
      script: 'server.cjs',
      cwd: `${CODEX_PATH}/JubileeBrowser.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.JUBILEE_BROWSER
      },
      ...PRODUCTION_DEFAULTS,
      max_memory_restart: '200M',
      error_file: `${LOGS_PATH}/jubilee-browser-error.log`,
      out_file: `${LOGS_PATH}/jubilee-browser-out.log`
    },
    {
      name: 'CelestialPaths',
      script: 'server.cjs',
      cwd: `${CODEX_PATH}/CelestialPaths.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.CELESTIAL_PATHS
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/celestial-paths-error.log`,
      out_file: `${LOGS_PATH}/celestial-paths-out.log`
    },
    {
      name: 'JubileeWebsites',
      script: 'server.js',
      cwd: `${CODEX_PATH}/JubileeWebsites.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.JUBILEE_WEBSITES
      },
      ...PRODUCTION_DEFAULTS,
      error_file: `${LOGS_PATH}/jubilee-websites-error.log`,
      out_file: `${LOGS_PATH}/jubilee-websites-out.log`
    },
    {
      name: 'JubileeParadox',
      script: 'server.cjs',
      cwd: `${CODEX_PATH}/JubileeParadox.com`,
      env: {
        NODE_ENV: 'production',
        PORT: PORTS.JUBILEE_PARADOX
      },
      ...PRODUCTION_DEFAULTS,
      max_memory_restart: '200M',
      error_file: `${LOGS_PATH}/jubilee-paradox-error.log`,
      out_file: `${LOGS_PATH}/jubilee-paradox-out.log`
    }
  ]
};
