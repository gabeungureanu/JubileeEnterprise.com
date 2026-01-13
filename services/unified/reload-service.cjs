/**
 * Reload Trigger for Jubilee Unified Service Manager
 *
 * This script triggers a hot reload of all services.
 * Services will be gracefully restarted one by one.
 *
 * Usage: node reload-service.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const RELOAD_TRIGGER = path.join(__dirname, '.reload-trigger');
const HEALTH_PORT = 3999;

// Method 1: Touch the reload trigger file
fs.writeFileSync(RELOAD_TRIGGER, new Date().toISOString());
console.log('');
console.log('═'.repeat(60));
console.log('  Jubilee Services Reload Triggered');
console.log('═'.repeat(60));
console.log('');

// Method 2: Also hit the HTTP reload endpoint
const req = http.request({
    hostname: 'localhost',
    port: HEALTH_PORT,
    path: '/reload',
    method: 'GET',
    timeout: 5000
}, (res) => {
    console.log('  HTTP reload endpoint responded:', res.statusCode);
    console.log('');
    console.log('  All services will gracefully restart.');
    console.log('  Check status: curl http://localhost:3999/health');
    console.log('');
});

req.on('error', (err) => {
    console.log('  Note: HTTP endpoint not reachable (service may use file trigger)');
    console.log('');
});

req.end();
