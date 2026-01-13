/**
 * Windows Service Installer for Jubilee Unified Service Manager
 * Run with Administrator privileges: node install-service.cjs
 *
 * This single Windows Service manages ALL Jubilee websites and APIs.
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'JubileeServices',
  description: 'Jubilee Enterprise Unified Service Manager - Manages all websites and APIs',
  script: path.join(__dirname, 'jubilee-services.cjs'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
});

// Listen for install event
svc.on('install', function() {
  console.log('');
  console.log('Jubilee Services installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Jubilee Services Started!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  The service will now auto-start on Windows boot.');
  console.log('');
  console.log('  Health Check: http://localhost:3999/health');
  console.log('  Reload:       node reload-service.cjs');
  console.log('  Logs:         ./logs/');
  console.log('');
  console.log('═'.repeat(60));
});

svc.on('alreadyinstalled', function() {
  console.log('Jubilee Services is already installed.');
  console.log('Use uninstall-service.cjs first if you want to reinstall.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('');
console.log('═'.repeat(60));
console.log('  Installing Jubilee Unified Service Manager');
console.log('═'.repeat(60));
console.log('');
console.log('  Script:', path.join(__dirname, 'jubilee-services.cjs'));
console.log('  Config:', path.join(__dirname, 'services.json'));
console.log('');
svc.install();
