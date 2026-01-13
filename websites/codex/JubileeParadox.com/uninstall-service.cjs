/**
 * Windows Service Uninstaller for JubileeParadox.com
 * Run with Administrator privileges: node uninstall-service.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'JubileeParadox',
  script: path.join(__dirname, 'server-cluster.cjs')
});

// Listen for uninstall event
svc.on('uninstall', function() {
  console.log('JubileeParadox service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Uninstall the service
console.log('Uninstalling JubileeParadox Windows Service...');
svc.uninstall();
