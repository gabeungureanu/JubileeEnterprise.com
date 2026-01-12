/**
 * JubileeBrowser.com Static File Server
 *
 * A simple Node.js server for serving static content.
 * Run with: node server.js
 * Default port: 3200 (or process.env.PORT)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3200;
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

// Create the HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Enable CORS
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
        // Try adding .html extension
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
        console.error('Error serving file:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

// Start the server
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  JubileeBrowser.com Static Server');
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
