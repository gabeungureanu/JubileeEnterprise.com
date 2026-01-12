/**
 * PM2 Ecosystem Configuration
 *
 * Manages all Jubilee Enterprise services with auto-restart,
 * monitoring, and log management.
 *
 * Commands:
 *   pm2 start ecosystem.config.cjs     - Start all services
 *   pm2 stop all                       - Stop all services
 *   pm2 restart all                    - Restart all services
 *   pm2 status                         - View status
 *   pm2 logs                           - View logs
 *   pm2 monit                          - Real-time monitoring dashboard
 *   pm2 save                           - Save current process list
 *   pm2 startup                        - Generate startup script
 */

module.exports = {
  apps: [
    // ===========================================
    // CORE SERVICES
    // ===========================================
    {
      name: 'JubileeInspire',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeInspire.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-inspire-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-inspire-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'JubileeVerse',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeVerse.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_MOCK: 'true'  // Use mock mode until PostgreSQL is configured
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-verse-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-verse-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },

    // ===========================================
    // API SERVICES
    // ===========================================
    {
      name: 'InspireCodex',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/InspireCodex.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/inspire-codex-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/inspire-codex-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'InspireContinuum',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/InspireContinuum.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3101
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/inspire-continuum-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/inspire-continuum-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },

    // ===========================================
    // WEBSITE SERVICES
    // ===========================================
    {
      name: 'wwBibleweb',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/wwBibleweb.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3847
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/wwbibleweb-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/wwbibleweb-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'JubileeBrowser',
      script: 'server.cjs',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeBrowser.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3200
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-browser-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-browser-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'CelestialPaths',
      script: 'server.cjs',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/CelestialPaths.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3300
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/celestial-paths-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/celestial-paths-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'JubileeWebsites',
      script: 'server.js',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeWebsites.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3008
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-websites-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-websites-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    },
    {
      name: 'JubileeParadox',
      script: 'server.cjs',
      cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeParadox.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3009
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-paradox-error.log',
      out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-paradox-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    }
  ]
};
