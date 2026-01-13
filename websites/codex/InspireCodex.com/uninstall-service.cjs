/**
 * Windows Service Uninstaller for InspireCodex API
 * Run with Administrator privileges: node uninstall-service.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'InspireCodexAPI',
  script: path.join(__dirname, 'server-cluster.cjs')
});

svc.on('uninstall', function() {
  console.log('InspireCodex API service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling InspireCodex API Windows Service...');
svc.uninstall();
