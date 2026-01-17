/**
 * JubileeDailyNews Windows Service Installer
 *
 * Installs the JubileeDailyNews as a Windows Service.
 * Must be run with Administrator privileges.
 *
 * Usage: node install-service.cjs
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
    console.error('Then run: npm link node-windows');
    process.exit(1);
}

// Service configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const svc = new Service({
    name: config.name,
    description: config.description,
    script: path.join(__dirname, 'jubilee-daily-news.cjs'),
    nodeOptions: [],
    workingDirectory: __dirname,
    allowServiceLogon: true
});

// Event handlers
svc.on('install', () => {
    console.log('');
    console.log('========================================');
    console.log(`${config.name} Service Installed Successfully!`);
    console.log('========================================');
    console.log('');
    console.log('Starting service...');
    svc.start();
});

svc.on('alreadyinstalled', () => {
    console.log('');
    console.log(`${config.name} is already installed.`);
    console.log('Use uninstall-service.cjs first if you want to reinstall.');
});

svc.on('start', () => {
    console.log(`${config.name} started successfully!`);
    console.log('');
    console.log('Service Details:');
    console.log(`  Name: ${config.name}`);
    console.log(`  Health Endpoint: http://localhost:${config.healthPort}/health`);
    console.log(`  Logs: ${path.join(__dirname, 'logs')}`);
    console.log('');
    console.log('To check status: node status.cjs');
    console.log('To uninstall: node uninstall-service.cjs');
});

svc.on('error', (err) => {
    console.error('Service error:', err);
});

// Install the service
console.log('');
console.log('========================================');
console.log(`Installing ${config.name} Windows Service`);
console.log('========================================');
console.log('');
console.log('Configuration:');
console.log(`  Script: ${path.join(__dirname, 'jubilee-daily-news.cjs')}`);
console.log(`  Working Directory: ${__dirname}`);
console.log(`  Health Port: ${config.healthPort}`);
console.log('');

svc.install();
