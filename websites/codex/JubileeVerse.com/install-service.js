/**
 * Windows Service Installer for JubileeVerse
 * Run with Administrator privileges: node install-service.js
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'JubileeVerse',
  description: 'JubileeVerse Production Server (Clustered with Zero-Downtime Reload)',
  script: path.join(__dirname, 'server-cluster.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3000' }
  ],
  // Increase max restarts for clustered mode
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
});

// Listen for install event
svc.on('install', function() {
  console.log('JubileeVerse service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('JubileeVerse service started!');
  console.log('The service will now auto-start on Windows boot.');
  console.log('');
  console.log('Zero-downtime reload: node reload-service.js');
});

svc.on('alreadyinstalled', function() {
  console.log('JubileeVerse service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing JubileeVerse as a Windows Service (Clustered)...');
console.log('Script path:', path.join(__dirname, 'server-cluster.js'));
svc.install();
