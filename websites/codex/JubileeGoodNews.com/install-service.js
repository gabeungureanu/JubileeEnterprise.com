const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'JubileeGoodNews',
  description: 'JubileeGoodNews.com Content Portal (Port 3107)',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3107' }
  ],
  grow: 0.5,
  wait: 2,
  maxRestarts: 5,
  maxRetries: 3,
  abortOnError: false
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('JubileeGoodNews service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('JubileeGoodNews service started!');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log('Installing JubileeGoodNews as Windows Service...');
svc.install();
