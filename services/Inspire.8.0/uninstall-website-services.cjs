/**
 * Inspire 8.0: Website Services - Windows Service Uninstaller
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'Inspire80WebsiteServices',
  script: path.join(__dirname, 'inspire-service-manager.cjs')
});

svc.on('uninstall', function() {
  console.log('Inspire 8.0: Website Services uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling Inspire 8.0: Website Services...');
svc.uninstall();
