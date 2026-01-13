/**
 * JubileeVerse - Zero-Downtime Reload Trigger
 *
 * Run this script to trigger a zero-downtime reload of all workers.
 * The cluster master watches for the trigger file and reloads workers one at a time.
 *
 * Usage: node reload-service.js
 */

const fs = require('fs');
const path = require('path');

const triggerFile = path.join(__dirname, '.reload-trigger');
const pidFile = path.join(__dirname, '.cluster-master.pid');

// Check if cluster is running
if (!fs.existsSync(pidFile)) {
  console.error('Error: Cluster master PID file not found. Is the service running?');
  process.exit(1);
}

const masterPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);

// Verify process is running
try {
  process.kill(masterPid, 0); // Signal 0 just checks if process exists
  console.log(`Found cluster master process (PID: ${masterPid})`);
} catch (e) {
  console.error(`Error: Cluster master process (PID: ${masterPid}) is not running`);
  process.exit(1);
}

// Create trigger file to signal reload
console.log('Triggering zero-downtime reload...');
fs.writeFileSync(triggerFile, new Date().toISOString());

console.log('Reload signal sent!');
console.log('Workers will be restarted one at a time with no downtime.');
console.log('Check the service logs for reload progress.');
