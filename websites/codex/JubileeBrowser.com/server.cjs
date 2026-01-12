/**
 * JubileeBrowser.com Static File Server
 *
 * PRODUCTION SERVER - DO NOT MODIFY PORT CONFIGURATION
 *
 * Assigned Port: 3200 (HARDCODED - Cloudflare Tunnel Requirement)
 * This port is mapped in Cloudflare tunnel config and MUST NOT change.
 *
 * Run with: node server.cjs
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ============================================================================
// PRODUCTION PORT CONFIGURATION - DO NOT MODIFY
// ============================================================================
const REQUIRED_PORT = 3200;
const SERVICE_NAME = 'JubileeBrowser.com';

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

const BASE_DIR = __dirname;

// ============================================================================
// MIME TYPES
// ============================================================================
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.exe': 'application/octet-stream',
    '.dmg': 'application/octet-stream',
    '.msi': 'application/octet-stream'
};

// ============================================================================
// HTTP SERVER
// ============================================================================
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
    }

    // Default to index.html
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(BASE_DIR, safePath);

    // Make sure we're still within the base directory
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
            filePath = filePath + '.html';
        } else {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
    }

    // If it's a directory, try to serve index.html
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
            filePath = indexPath;
        } else {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
    }

    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve the file
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(content);
    } catch (error) {
        console.error('[ERROR] Failed to serve file:', filePath, error.message);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
server.listen(REQUIRED_PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log(`  ${SERVICE_NAME} - PRODUCTION SERVER`);
    console.log('='.repeat(60));
    console.log(`  Status:      ONLINE`);
    console.log(`  Port:        ${REQUIRED_PORT} (LOCKED)`);
    console.log(`  URL:         http://localhost:${REQUIRED_PORT}`);
    console.log(`  Directory:   ${BASE_DIR}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`  Started:     ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('');
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[FATAL] Port ${REQUIRED_PORT} is already in use`);
    } else {
        console.error('[FATAL] Server error:', error.message);
    }
    process.exit(1);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
const shutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down ${SERVICE_NAME}...`);
    server.close(() => {
        console.log(`[${signal}] Server stopped gracefully.`);
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[TIMEOUT] Forced shutdown after 10s');
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
