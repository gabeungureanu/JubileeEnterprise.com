/**
 * Windows Service Uninstaller
 *
 * TEMPLATE FILE - Copy to your application and modify as needed.
 *
 * Run with Administrator privileges: node uninstall-service.js
 */
const path = require('path');

// Update this path if node-windows is installed elsewhere
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

// ============== CONFIGURATION ==============
// Must match the name used in install-service.js
const SERVICE_NAME = 'MyNodeApp';  // <-- Change: Service name (must match install-service.js)
// ===========================================

// Create service object
const svc = new Service({
  name: SERVICE_NAME,
  script: path.join(__dirname, 'server-cluster.js')
});

// Listen for uninstall event
svc.on('uninstall', function() {
  console.log(`${SERVICE_NAME} service uninstalled successfully!`);
  console.log('');
  console.log('The service has been removed from Windows.');
  console.log('To reinstall, run: node install-service.js');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

// Uninstall the service
console.log(`Uninstalling ${SERVICE_NAME} Windows Service...`);
svc.uninstall();
