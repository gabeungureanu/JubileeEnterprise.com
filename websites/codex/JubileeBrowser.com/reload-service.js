/**
 * JubileeBrowser.com - Zero-Downtime Reload Trigger
 *
 * Run this script to trigger a zero-downtime reload of all workers.
 *
 * Usage: node reload-service.js
 */

const fs = require('fs');
const path = require('path');

const triggerFile = path.join(__dirname, '.reload-trigger');
const pidFile = path.join(__dirname, '.cluster-master.pid');

console.log('Zero-Downtime Reload - JubileeBrowser.com');
console.log('=========================================');
console.log('');

// Check if cluster is running
if (!fs.existsSync(pidFile)) {
  console.error('Error: Cluster master PID file not found.');
  console.error('Is the service running?');
  console.error('');
  console.error('Check with: sc query "jubileebrowser.exe"');
  process.exit(1);
}

const masterPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);

// Verify process is running
try {
  process.kill(masterPid, 0);
  console.log(`Found cluster master process (PID: ${masterPid})`);
} catch (e) {
  console.error(`Error: Cluster master process (PID: ${masterPid}) is not running.`);
  process.exit(1);
}

// Create trigger file to signal reload
console.log('');
console.log('Triggering zero-downtime reload...');
fs.writeFileSync(triggerFile, new Date().toISOString());

console.log('');
console.log('Reload signal sent!');
console.log('Workers will be restarted one at a time with no downtime.');
