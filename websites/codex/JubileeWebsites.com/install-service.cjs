/**
 * Windows Service Installer for JubileeWebsites.com
 * Service Name: Inspire Web Server
 * Run with Administrator privileges: node install-service.cjs
 *
 * PRODUCTION PORT: 3008 (LOCKED)
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'InspireWebServer',
  description: 'Inspire Web Server - JubileeWebsites.com Production (Clustered with Zero-Downtime Reload)',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3008' }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
});

// Listen for install event
svc.on('install', function() {
  console.log('Inspire Web Server service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Inspire Web Server started!');
  console.log('The service will now auto-start on Windows boot.');
  console.log('');
  console.log('Port: 3008');
  console.log('Zero-downtime reload: node reload-service.cjs');
});

svc.on('alreadyinstalled', function() {
  console.log('Inspire Web Server service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing Inspire Web Server as a Windows Service...');
console.log('Script path:', path.join(__dirname, 'server.js'));
console.log('Port: 3008');
svc.install();
