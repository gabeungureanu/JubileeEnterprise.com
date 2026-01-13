/**
 * Windows Service Installer
 *
 * TEMPLATE FILE - Copy to your application and modify as needed.
 *
 * Run with Administrator privileges: node install-service.js
 *
 * Prerequisites:
 *   npm install -g node-windows
 */
const path = require('path');

// Update this path if node-windows is installed elsewhere
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// ============== CONFIGURATION ==============
// Modify these for your application
const SERVICE_CONFIG = {
  name: 'MyNodeApp',                                    // <-- Change: Service name (no spaces)
  description: 'My Node.js Application Server',         // <-- Change: Service description
  script: path.join(__dirname, 'server-cluster.js'),   // Clustered server wrapper
  nodeOptions: [],
  workingDirectory: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PORT', value: '3000' }                    // <-- Change: Your port
  ],
  // Restart settings
  maxRestarts: 5,
  maxRetries: 3,
  wait: 2,
  grow: 0.5
};
// ===========================================

// Create service object
const svc = new Service(SERVICE_CONFIG);

// Listen for install event
svc.on('install', function() {
  console.log(`${SERVICE_CONFIG.name} service installed successfully!`);
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function() {
  console.log(`${SERVICE_CONFIG.name} service started!`);
  console.log('The service will now auto-start on Windows boot.');
  console.log('');
  console.log('Commands:');
  console.log('  Zero-downtime reload: node reload-service.js');
  console.log(`  Check status: sc query "${SERVICE_CONFIG.name.toLowerCase()}.exe"`);
  console.log(`  Stop service: sc stop "${SERVICE_CONFIG.name.toLowerCase()}.exe"`);
  console.log(`  Start service: sc start "${SERVICE_CONFIG.name.toLowerCase()}.exe"`);
});

svc.on('alreadyinstalled', function() {
  console.log(`${SERVICE_CONFIG.name} service is already installed.`);
  console.log('To reinstall, run: node uninstall-service.js first');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Install the service
console.log(`Installing ${SERVICE_CONFIG.name} as a Windows Service...`);
console.log('Script path:', SERVICE_CONFIG.script);
console.log('Working directory:', SERVICE_CONFIG.workingDirectory);
console.log('');
svc.install();
