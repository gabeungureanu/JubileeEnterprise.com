/**
 * Windows Service Installer for InspireContinuum API
 * Run with Administrator privileges: node install-service.cjs
 *
 * PRODUCTION PORT: 3101 (API Server)
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'InspireContinuumAPI',
  description: 'InspireContinuum API Server (Clustered with Zero-Downtime Reload)',
  script: path.join(__dirname, 'server-cluster.cjs'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3101' }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
});

// Listen for install event
svc.on('install', function() {
  console.log('InspireContinuum API service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('InspireContinuum API service started!');
  console.log('The service will now auto-start on Windows boot.');
  console.log('');
  console.log('Port: 3101 (API Server)');
  console.log('Zero-downtime reload: node reload-service.cjs');
});

svc.on('alreadyinstalled', function() {
  console.log('InspireContinuum API service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing InspireContinuum API as a Windows Service (Clustered)...');
console.log('Script path:', path.join(__dirname, 'server-cluster.cjs'));
console.log('Port: 3101 (API Server)');
svc.install();
