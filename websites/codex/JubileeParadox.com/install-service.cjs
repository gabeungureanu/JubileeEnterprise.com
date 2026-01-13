/**
 * Windows Service Installer for JubileeParadox.com
 * Run with Administrator privileges: node install-service.cjs
 *
 * PRODUCTION PORT: 3009 (Cloudflare Tunnel Requirement)
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'JubileeParadox',
  description: 'JubileeParadox.com Production Server (Clustered with Zero-Downtime Reload)',
  script: path.join(__dirname, 'server-cluster.cjs'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3009' }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
});

// Listen for install event
svc.on('install', function() {
  console.log('JubileeParadox service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('JubileeParadox service started!');
  console.log('The service will now auto-start on Windows boot.');
  console.log('');
  console.log('Port: 3009 (Cloudflare Tunnel)');
  console.log('Zero-downtime reload: node reload-service.cjs');
});

svc.on('alreadyinstalled', function() {
  console.log('JubileeParadox service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing JubileeParadox as a Windows Service (Clustered)...');
console.log('Script path:', path.join(__dirname, 'server-cluster.cjs'));
console.log('Port: 3009 (Cloudflare Tunnel)');
svc.install();
