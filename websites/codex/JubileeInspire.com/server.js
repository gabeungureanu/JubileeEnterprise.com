/**
 * JubileeInspire.com Static Server
 *
 * A simple Node.js server for serving the JubileeInspire.com static website.
 * Supports clean URLs and SPA-style routing.
 *
 * Port: 3003 (or process.env.PORT for iisnode/production)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3001;
const BASE_DIR = __dirname;

// MIME types for serving static files
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
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
    '.webp': 'image/webp'
};

// Route rewrites (from serve.json)
const REWRITES = {
    '/login': '/login.html',
    '/chat': '/chat.html'
};

// Create the HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Apply rewrites
    if (REWRITES[pathname]) {
        pathname = REWRITES[pathname];
    }

    // Remove trailing slash (except for root)
    if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
    }

    // Serve static files
    serveStaticFile(req, res, pathname);
});

/**
 * Serve static files with fallback to index.html for SPA routing
 */
function serveStaticFile(req, res, pathname) {
    // Default to index.html for root
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(BASE_DIR, safePath);

    // Make sure we're still within the base directory
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Try adding .html extension for clean URLs
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
        } else {
            // Return 404
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
    }

    // Check if it's a directory
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
        // Try to serve index.html from directory
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
            filePath = indexPath;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
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

        // Set cache headers for static assets
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.webp'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else if (['.css', '.js'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }

        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    } catch (error) {
        console.error('Error serving file:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    }
}

// Start the server
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  JubileeInspire.com Static Server');
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Dir:     ${BASE_DIR}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});