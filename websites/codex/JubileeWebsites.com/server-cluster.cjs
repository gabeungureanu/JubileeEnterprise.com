/**
 * JubileeWebsites.com - Inspire Web Server (Windows Service)
 *
 * Production wrapper for Windows Service:
 * - Auto-restart on crash
 * - PID file tracking for monitoring
 * - Reload trigger support
 * - Windows Service compatible (no PM2 required)
 *
 * PRODUCTION PORT: 3008 (LOCKED)
 *
 * For Windows Service deployment, use:
 *   node install-service.cjs    (as Administrator)
 *
 * For reload after code changes:
 *   node reload-service.cjs
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Configuration
const PID_FILE = path.join(__dirname, '.cluster-master.pid');
const RELOAD_TRIGGER_FILE = path.join(__dirname, '.reload-trigger');

console.log('');
console.log('='.repeat(60));
console.log('  JubileeWebsites.com - Inspire Web Server');
console.log('='.repeat(60));
console.log(`  PID:           ${process.pid}`);
console.log(`  Port:          3008 (Locked)`);
console.log(`  Working Dir:   ${__dirname}`);
console.log('='.repeat(60));
console.log('');

// Write PID file
fs.writeFileSync(PID_FILE, process.pid.toString());

// Load environment variables
require('dotenv').config();

// Watch for reload trigger file (triggers process restart by node-windows)
fs.watchFile(RELOAD_TRIGGER_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
        console.log('[Server] Reload trigger detected, exiting for restart...');
        process.exit(0);  // Clean exit triggers node-windows to restart
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down...');
    try { fs.unlinkSync(PID_FILE); } catch (e) {}
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down...');
    try { fs.unlinkSync(PID_FILE); } catch (e) {}
    process.exit(0);
});

// Dynamic import of ES module server
(async () => {
    try {
        console.log('[Server] Loading ES module...');
        await import('./server.mjs');
        console.log('[Server] Server loaded successfully');
    } catch (err) {
        console.error('[FATAL] Failed to load server:', err);
        process.exit(1);
    }
})();
