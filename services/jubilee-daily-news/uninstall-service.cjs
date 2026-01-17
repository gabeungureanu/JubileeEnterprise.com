/**
 * JubileeDailyNews Windows Service Uninstaller
 *
 * Removes the JubileeDailyNews Windows Service.
 * Must be run with Administrator privileges.
 *
 * Usage: node uninstall-service.cjs
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load node-windows from global installation
const nodeWindowsPath = path.join(
    process.env.APPDATA || 'C:/Users/elian/AppData/Roaming',
    'npm/node_modules/node-windows'
);

let Service;
try {
    Service = require(nodeWindowsPath).Service;
} catch (error) {
    console.error('Error: node-windows is not installed globally.');
    console.error('Please run: npm install -g node-windows');
    process.exit(1);
}

// Service configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const svc = new Service({
    name: config.name,
    script: path.join(__dirname, 'jubilee-daily-news.cjs')
});

// Event handlers
svc.on('uninstall', () => {
    console.log('');
    console.log('========================================');
    console.log(`${config.name} Service Uninstalled`);
    console.log('========================================');
    console.log('');
    console.log('The service has been removed from Windows Services.');
    console.log('Log files have been preserved in the logs directory.');
});

svc.on('alreadyuninstalled', () => {
    console.log('');
    console.log(`${config.name} is not installed.`);
});

svc.on('error', (err) => {
    console.error('Service error:', err);
});

// Uninstall the service
console.log('');
console.log('========================================');
console.log(`Uninstalling ${config.name} Windows Service`);
console.log('========================================');
console.log('');

svc.uninstall();
