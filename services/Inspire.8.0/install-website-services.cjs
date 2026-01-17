/**
 * Inspire 8.0: Website Services - Windows Service Installer
 *
 * Manages all 40 Jubilee Enterprise frontend websites as a single Windows Service.
 *
 * Run with Administrator privileges: node install-website-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const SERVICE_CONFIG = {
  name: 'Inspire80WebsiteServices',
  description: 'Inspire 8.0: Website Services - Manages all Jubilee Enterprise frontend websites',
  script: path.join(__dirname, 'inspire-service-manager.cjs'),
  scriptOptions: '--config=' + path.join(__dirname, 'websites-services.json'),
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
  console.log('Inspire 8.0: Website Services installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Service started!');
  console.log('');
  console.log('Health endpoint: http://localhost:3900/health');
  console.log('Reload services: touch .reload-trigger');
  console.log('');
  console.log('Commands:');
  console.log('  sc query inspire80websiteservices.exe');
  console.log('  sc stop inspire80websiteservices.exe');
  console.log('  sc start inspire80websiteservices.exe');
});

svc.on('alreadyinstalled', function() {
  console.log('Service is already installed.');
  console.log('To reinstall, run: node uninstall-website-services.cjs');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Installing Inspire 8.0: Website Services...');
console.log('Config:', path.join(__dirname, 'websites-services.json'));
svc.install();
