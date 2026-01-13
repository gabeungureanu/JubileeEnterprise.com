/**
 * CelestialPaths.com - Static Express Server
 *
 * PRODUCTION SERVER - Serves static HTML files
 *
 * Assigned Port: 3300 (HARDCODED - Cloudflare Tunnel Requirement)
 * This port is mapped in Cloudflare tunnel config and MUST NOT change.
 *
 * Run with: node server.cjs
 */

'use strict';

const express = require('express');
const path = require('path');
const compression = require('compression');

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

// Static files directory (Next.js export)
const STATIC_DIR = path.join(__dirname, 'website', 'frontend', 'out');

// ============================================================================
// EXPRESS SERVER SETUP
// ============================================================================
const app = express();

// Enable gzip compression
app.use(compression());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Cache static assets for 1 year (they have hashed filenames)
app.use('/_next/static', express.static(path.join(STATIC_DIR, '_next', 'static'), {
    maxAge: '1y',
    immutable: true
}));

// Cache other _next files for 1 day
app.use('/_next', express.static(path.join(STATIC_DIR, '_next'), {
    maxAge: '1d'
}));

// Serve static files with short cache for HTML
app.use(express.static(STATIC_DIR, {
    maxAge: '1h',
    index: ['index.html'],
    extensions: ['html']
}));

// Handle trailing slash routes (e.g., /about/ -> /about/index.html)
app.use((req, res, next) => {
    if (req.path.endsWith('/') && req.path !== '/') {
        const indexPath = path.join(STATIC_DIR, req.path, 'index.html');
        res.sendFile(indexPath, (err) => {
            if (err) next();
        });
    } else {
        next();
    }
});

// Fallback: try adding .html extension
app.use((req, res, next) => {
    if (!req.path.includes('.')) {
        const htmlPath = path.join(STATIC_DIR, req.path + '.html');
        res.sendFile(htmlPath, (err) => {
            if (err) {
                // Try index.html in directory
                const indexPath = path.join(STATIC_DIR, req.path, 'index.html');
                res.sendFile(indexPath, (err2) => {
                    if (err2) next();
                });
            }
        });
    } else {
        next();
    }
});

// 404 handler
app.use((req, res) => {
    const notFoundPath = path.join(STATIC_DIR, '404.html');
    res.status(404).sendFile(notFoundPath, (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.message}`);
    res.status(500).send('Internal Server Error');
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
const server = app.listen(REQUIRED_PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log(`  ${SERVICE_NAME} - STATIC EXPRESS SERVER`);
    console.log('='.repeat(60));
    console.log(`  Status:      RUNNING`);
    console.log(`  Port:        ${REQUIRED_PORT} (LOCKED)`);
    console.log(`  Static Dir:  ${STATIC_DIR}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`  Started:     ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
const shutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down ${SERVICE_NAME}...`);
    server.close(() => {
        console.log('[INFO] Server closed gracefully');
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
