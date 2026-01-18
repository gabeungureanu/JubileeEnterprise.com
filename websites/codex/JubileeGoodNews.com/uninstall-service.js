const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'JubileeGoodNews',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function() {
  console.log('JubileeGoodNews service uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling JubileeGoodNews Windows Service...');
svc.uninstall();
