/**
 * Inspire 8.0: Docker Services - Windows Service Uninstaller
 *
 * Uninstalls the Docker Services Windows Service.
 *
 * Run with Administrator privileges: node uninstall-docker-services.cjs
 */
const path = require('path');
const Service = require('C:/Users/elian/AppData/Roaming/npm/node_modules/node-windows').Service;

const svc = new Service({
  name: 'Inspire80DockerServices',
  script: path.join(__dirname, 'docker-service-manager.cjs')
});

svc.on('uninstall', function() {
  console.log('Inspire 8.0: Docker Services uninstalled successfully!');
});

svc.on('error', function(err) {
  console.error('Error:', err);
});

console.log('Uninstalling Inspire 8.0: Docker Services...');
svc.uninstall();
