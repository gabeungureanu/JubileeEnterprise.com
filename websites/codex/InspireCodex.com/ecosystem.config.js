module.exports = {
  apps: [{
    name: 'inspirecodex-api',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 3100
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    // Restart if app crashes
    exp_backoff_restart_delay: 100,
    // Max restarts within a time window before stopping
    max_restarts: 10,
    min_uptime: '10s',
    // Graceful shutdown
    kill_timeout: 5000,
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Merge logs from all instances
    merge_logs: true
  }]
};
