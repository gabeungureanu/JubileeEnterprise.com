/**
 * JubileeWebsites.com - CommonJS Entry Point
 *
 * This file loads the ES module server (server.mjs) via dynamic import.
 * Required for Windows Service compatibility.
 */

'use strict';

// Load environment variables first
require('dotenv').config();

// Dynamic import of ES module
async function main() {
    try {
        await import('./server.mjs');
    } catch (err) {
        console.error('[FATAL] Failed to start server:', err);
        process.exit(1);
    }
}

main();
