const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'InspireCodex',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function() {
  console.log('InspireCodex service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling InspireCodex Windows Service...');
svc.uninstall();
