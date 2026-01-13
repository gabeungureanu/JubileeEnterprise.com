/**
 * Windows Service Uninstaller for Jubilee Unified Service Manager
 * Run with Administrator privileges: node uninstall-service.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'JubileeServices',
  script: path.join(__dirname, 'jubilee-services.cjs')
});

svc.on('uninstall', function() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Jubilee Services Uninstalled');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  The Windows Service has been removed.');
  console.log('  All managed websites have been stopped.');
  console.log('');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('');
console.log('Uninstalling Jubilee Services...');
svc.uninstall();
