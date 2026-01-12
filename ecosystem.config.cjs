/**
 * PM2 Ecosystem Configuration
 *
 * Manages all Jubilee Enterprise services with auto-restart,
 * monitoring, and log management.
 *
 * Commands:
 *   pm2 start ecosystem.config.js      - Start all services
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
    // JubileeVerse disabled - has PostgreSQL connection issues
    // {
    //   name: 'JubileeVerse',
    //   script: 'server.js',
    //   cwd: 'C:/data/JubileeEnterprise.com/websites/codex/JubileeVerse.com',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3000
    //   },
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '500M',
    //   restart_delay: 5000,
    //   max_restarts: 10,
    //   min_uptime: '10s',
    //   error_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-verse-error.log',
    //   out_file: 'C:/data/JubileeEnterprise.com/logs/jubilee-verse-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   kill_timeout: 5000
    // }
  ]
};
