/**
 * PM2 Ecosystem Configuration
 * Jubilee Enterprise - All Production Websites
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 */

module.exports = {
  apps: [
    // =====================================================
    // CORE PLATFORM SERVICES (APIs)
    // =====================================================
    {
      name: 'InspireCodex',
      cwd: './websites/codex/InspireCodex.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/inspirecodex-error.log',
      out_file: './logs/inspirecodex-out.log'
    },
    {
      name: 'InspireContinuum',
      cwd: './websites/codex/InspireContinuum.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3101
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/inspirecontinuum-error.log',
      out_file: './logs/inspirecontinuum-out.log'
    },

    // =====================================================
    // PRIMARY WEBSITES
    // =====================================================
    {
      name: 'JubileeVerse',
      cwd: './websites/codex/JubileeVerse.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/jubileeverse-error.log',
      out_file: './logs/jubileeverse-out.log'
    },
    {
      name: 'JubileeInspire',
      cwd: './websites/codex/JubileeInspire.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/jubileeinspire-error.log',
      out_file: './logs/jubileeinspire-out.log'
    },
    {
      name: 'JubileeBrowser',
      cwd: './websites/codex/JubileeBrowser.com',
      script: 'server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3200
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/jubileebrowser-error.log',
      out_file: './logs/jubileebrowser-out.log'
    },
    {
      name: 'wwBibleweb',
      cwd: './websites/codex/wwBibleweb.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3847
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/wwbibleweb-error.log',
      out_file: './logs/wwbibleweb-out.log'
    },

    // =====================================================
    // SECONDARY WEBSITES
    // =====================================================
    {
      name: 'JubileeWebsites',
      cwd: './websites/codex/JubileeWebsites.com',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3008
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/jubileewebsites-error.log',
      out_file: './logs/jubileewebsites-out.log'
    },
    {
      name: 'JubileeParadox',
      cwd: './websites/codex/JubileeParadox.com',
      script: 'server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3009
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/jubileeparadox-error.log',
      out_file: './logs/jubileeparadox-out.log'
    },
    {
      name: 'CelestialPaths',
      cwd: './websites/codex/CelestialPaths.com',
      script: 'server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3300
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/celestialpaths-error.log',
      out_file: './logs/celestialpaths-out.log'
    }
  ]
};
