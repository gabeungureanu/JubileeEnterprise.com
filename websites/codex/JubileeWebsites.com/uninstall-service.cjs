/**
 * Windows Service Uninstaller for Inspire Web Server (JubileeWebsites.com)
 * Run with Administrator privileges: node uninstall-service.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'InspireWebServer',
  script: path.join(__dirname, 'server.js')
});

// Listen for uninstall event
svc.on('uninstall', function() {
  console.log('Inspire Web Server service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Uninstall the service
console.log('Uninstalling Inspire Web Server Windows Service...');
svc.uninstall();
