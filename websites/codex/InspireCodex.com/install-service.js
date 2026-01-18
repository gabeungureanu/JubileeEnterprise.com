const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'InspireCodex',
  description: 'InspireCodex.com API Server (Port 3100)',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3100' }
  ],
  grow: 0.5,
  wait: 2,
  maxRestarts: 5,
  maxRetries: 3,
  abortOnError: false
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('InspireCodex service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('InspireCodex service started!');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing InspireCodex as Windows Service...');
svc.install();
