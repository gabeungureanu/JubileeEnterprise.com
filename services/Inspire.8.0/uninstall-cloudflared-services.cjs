/**
 * Inspire 8.0: Cloudflared Services - Windows Service Uninstaller
 *
 * Uninstalls the Cloudflared Services Windows Service.
 *
 * Run with Administrator privileges: node uninstall-cloudflared-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'Inspire80CloudflaredServices',
  script: path.join(__dirname, 'cloudflared-service-manager.cjs')
});

svc.on('uninstall', function() {
  console.log('Inspire 8.0: Cloudflared Services uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling Inspire 8.0: Cloudflared Services...');
svc.uninstall();
