/**
 * Inspire 8.0: Docker Services - Windows Service Installer
 *
 * Manages Docker containers (Qdrant, Redis, pgAdmin) as a Windows Service.
 *
 * Run with Administrator privileges: node install-docker-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const SERVICE_CONFIG = {
  name: 'Inspire80DockerServices',
  description: 'Inspire 8.0: Docker Services - Manages Docker containers for infrastructure',
  script: path.join(__dirname, 'docker-service-manager.cjs'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'SERVICE_CONFIG', value: path.join(__dirname, 'docker-services.json') }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
};

const svc = new Service(SERVICE_CONFIG);

svc.on('install', function() {
  console.log('Inspire 8.0: Docker Services installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Service started!');
  console.log('');
  console.log('Health endpoint: http://localhost:3902/health');
  console.log('');
  console.log('Commands:');
  console.log('  sc query inspire80dockerservices.exe');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Installing Inspire 8.0: Docker Services...');
svc.install();
