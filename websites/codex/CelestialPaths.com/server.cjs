/**
 * CelestialPaths.com Production Server Launcher
 *
 * PRODUCTION SERVER - DO NOT MODIFY PORT CONFIGURATION
 *
 * Assigned Port: 3300 (HARDCODED - Cloudflare Tunnel Requirement)
 * This port is mapped in Cloudflare tunnel config and MUST NOT change.
 *
 * Run with: node server.cjs
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

// ============================================================================
// PRODUCTION PORT CONFIGURATION - DO NOT MODIFY
// ============================================================================
const REQUIRED_PORT = 3300;
const SERVICE_NAME = 'CelestialPaths.com';

// Validate port - fail fast if misconfigured
const PORT = parseInt(process.env.PORT, 10) || REQUIRED_PORT;
if (PORT !== REQUIRED_PORT) {
    console.error('');
    console.error('='.repeat(60));
    console.error('  FATAL: PORT CONFIGURATION ERROR');
    console.error('='.repeat(60));
    console.error(`  Service:  ${SERVICE_NAME}`);
    console.error(`  Required: ${REQUIRED_PORT}`);
    console.error(`  Received: ${PORT}`);
    console.error('');
    console.error('  This service MUST run on port ' + REQUIRED_PORT);
    console.error('  Cloudflare tunnel is configured for this port.');
    console.error('  DO NOT override the PORT environment variable.');
    console.error('='.repeat(60));
    console.error('');
    process.exit(1);
}

const FRONTEND_DIR = path.join(__dirname, 'website', 'frontend');

// ============================================================================
// SERVER STARTUP
// ============================================================================
console.log('');
console.log('='.repeat(60));
console.log(`  ${SERVICE_NAME} - PRODUCTION SERVER`);
console.log('='.repeat(60));
console.log(`  Status:      STARTING`);
console.log(`  Port:        ${REQUIRED_PORT} (LOCKED)`);
console.log(`  Directory:   ${FRONTEND_DIR}`);
console.log(`  Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`  Started:     ${new Date().toISOString()}`);
console.log('='.repeat(60));
console.log('');

// Start Next.js in production mode with LOCKED port
const nextProcess = spawn('npx', ['next', 'start', '-p', REQUIRED_PORT.toString()], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        PORT: REQUIRED_PORT.toString(),
        NODE_ENV: 'production'
    }
});

nextProcess.on('error', (error) => {
    console.error(`[FATAL] Failed to start ${SERVICE_NAME}:`, error.message);
    process.exit(1);
});

nextProcess.on('close', (code) => {
    console.log(`[INFO] ${SERVICE_NAME} exited with code ${code}`);
    process.exit(code);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
const shutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down ${SERVICE_NAME}...`);
    nextProcess.kill(signal);
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[TIMEOUT] Forced shutdown after 10s');
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
