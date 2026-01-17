/**
 * Inspire 8.0: Web API Services - Windows Service Uninstaller
 *
 * Uninstalls the Web API Services Windows Service.
 *
 * Run with Administrator privileges: node uninstall-api-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'Inspire80WebAPIServices',
  script: path.join(__dirname, 'inspire-service-manager.cjs')
});

svc.on('uninstall', function() {
  console.log('Inspire 8.0: Web API Services uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling Inspire 8.0: Web API Services...');
svc.uninstall();
