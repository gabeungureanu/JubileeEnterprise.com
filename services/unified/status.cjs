/**
 * Status Check for Jubilee Unified Service Manager
 *
 * Shows the status of all managed services.
 *
 * Usage: node status.cjs
 */
const http = require('http');

const HEALTH_PORT = 3999;

console.log('');
console.log('═'.repeat(60));
console.log('  Jubilee Services Status');
console.log('═'.repeat(60));
console.log('');

const req = http.request({
    hostname: 'localhost',
    port: HEALTH_PORT,
    path: '/health',
    method: 'GET',
    timeout: 5000
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const status = JSON.parse(data);

            console.log(`  Manager PID:    ${status.manager.pid}`);
            console.log(`  Uptime:         ${Math.floor(status.manager.uptime / 60)} minutes`);
            console.log(`  Timestamp:      ${status.timestamp}`);
            console.log('');
            console.log('  Services:');
            console.log('  ' + '-'.repeat(56));

            for (const svc of status.services) {
                const statusIcon = svc.status === 'running' ? '✓' : '✗';
                const restarts = svc.restarts > 0 ? ` (restarts: ${svc.restarts})` : '';
                console.log(`  ${statusIcon} ${svc.name.padEnd(25)} :${svc.port}  PID ${svc.pid}${restarts}`);
            }

            console.log('  ' + '-'.repeat(56));
            console.log(`  Total: ${status.services.length} services`);
            console.log('');
        } catch (err) {
            console.error('  Error parsing response:', err.message);
        }
    });
});

req.on('error', (err) => {
    console.log('  ✗ Service Manager is not running');
    console.log('');
    console.log('  To start: node jubilee-services.cjs');
    console.log('  Or install as Windows Service: node install-service.cjs');
    console.log('');
});

req.end();
