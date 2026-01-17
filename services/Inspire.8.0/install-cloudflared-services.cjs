/**
 * Inspire 8.0: Cloudflared Services - Windows Service Installer
 *
 * Manages Cloudflare tunnel as a Windows Service.
 *
 * Run with Administrator privileges: node install-cloudflared-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const SERVICE_CONFIG = {
  name: 'Inspire80CloudflaredServices',
  description: 'Inspire 8.0: Cloudflared Services - Manages Cloudflare tunnel for production traffic',
  script: path.join(__dirname, 'cloudflared-service-manager.cjs'),
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' }
  ],
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
};

const svc = new Service(SERVICE_CONFIG);

svc.on('install', function() {
  console.log('Inspire 8.0: Cloudflared Services installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Service started!');
  console.log('');
  console.log('Health endpoint: http://localhost:3903/health');
  console.log('');
  console.log('Commands:');
  console.log('  sc query inspire80cloudflaredservices.exe');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Installing Inspire 8.0: Cloudflared Services...');
svc.install();
