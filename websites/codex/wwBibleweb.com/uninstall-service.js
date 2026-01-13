/**
 * Windows Service Uninstaller for wwBibleweb.com
 * Run with Administrator privileges: node uninstall-service.js
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'wwBibleweb',
  script: path.join(__dirname, 'server-cluster.js')
});

// Listen for uninstall event
svc.on('uninstall', function() {
  console.log('wwBibleweb service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Uninstall the service
console.log('Uninstalling wwBibleweb Windows Service...');
svc.uninstall();
