module.exports = {
  apps: [
    // ===========================================
    // STATIC SITES (using serve)
    // ===========================================
    {
      name: 'jubileeverse.com',
      script: 'server.js',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/JubileeVerse.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'jubileeinspire.com',
      script: 'C:/Users/elian/AppData/Roaming/npm/node_modules/serve/build/main.js',
      args: '-l 3001 -s .',
      cwd: 'c:/data/JubileeEnterprise.com/websites/inspire/JubileeInspire.com',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'jubileebrowser.com',
      script: 'C:/Users/elian/AppData/Roaming/npm/node_modules/serve/build/main.js',
      args: '-l 3200 -s .',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/JubileeBrowser.com',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'wwbibleweb.com',
      script: 'C:/Users/elian/AppData/Roaming/npm/node_modules/serve/build/main.js',
      args: '-l 3847 -s .',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/wwBibleweb.com',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    // ===========================================
    // NEXT.JS APPLICATIONS
    // ===========================================
    {
      name: 'celestialpaths.com',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3300 website/frontend',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/CelestialPaths.com',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3300
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },

    // ===========================================
    // NODE.JS API SERVERS
    // ===========================================
    {
      name: 'inspirecodex-api',
      script: 'server.js',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/InspireCodex.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'inspirecontinuum-api',
      script: 'server.js',
      cwd: 'c:/data/JubileeEnterprise.com/websites/codex/InspireContinuum.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3101
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
