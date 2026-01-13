/**
 * Zero-Downtime Reload for InspireCodex API Windows Service
 *
 * This script triggers a graceful reload of all worker processes
 * without dropping any connections.
 *
 * Usage: node reload-service.cjs
 */
const fs = require('fs');
const path = require('path');

const RELOAD_TRIGGER_FILE = path.join(__dirname, '.reload-trigger');

// Touch the reload trigger file
fs.writeFileSync(RELOAD_TRIGGER_FILE, new Date().toISOString());

console.log('InspireCodex API reload triggered!');
console.log('Workers will gracefully restart one by one.');
console.log('');
console.log('Monitor progress with: sc query inspirecodexapi.exe');
