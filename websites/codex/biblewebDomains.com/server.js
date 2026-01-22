/**
 * biblewebDomains.com - Coming Soon Server
 * biblewebDomains.com - Premium Bible Domain Names
 * Port: 3138
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3138;
const SITE_NAME = 'biblewebDomains.com';

// MIME types
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
    '.woff2': 'font/woff2'
};

// Coming Soon HTML
const COMING_SOON_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE_NAME} - Premium Bible Domain Names</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            animation: fadeIn 1s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .logo {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, #4a90d9, #7c3aed);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .tagline {
            font-size: 1.2rem;
            color: #a0a0a0;
            margin-bottom: 2rem;
        }
        .coming-soon {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(90deg, #4a90d9, #7c3aed);
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(74, 144, 217, 0.4); }
            50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(74, 144, 217, 0.6); }
        }
        .footer {
            margin-top: 3rem;
            color: #666;
            font-size: 0.9rem;
        }
        .footer a { color: #4a90d9; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">&#128215;</div>
        <h1>BiblewebDomains</h1>
        <p class="tagline">Premium Bible-Themed Domain Names</p>
        <div class="coming-soon">Coming Soon</div>
        <p class="footer">Part of the <a href="https://JubileeVerse.com">Jubilee Enterprise</a> family</p>
    </div>
</body>
</html>`;

// Health check endpoint
function handleHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: SITE_NAME, port: PORT }));
}

// Serve static file or coming soon page
function serveRequest(req, res) {
    const pathname = req.url.split('?')[0];

    // Health check
    if (pathname === '/health') {
        return handleHealth(req, res);
    }

    // Try to serve static files first
    if (pathname !== '/' && pathname !== '/index.html') {
        const filePath = path.join(__dirname, pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(fs.readFileSync(filePath));
            return;
        }
    }

    // Check for custom index.html
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(indexPath, 'utf8'));
        return;
    }

    // Serve coming soon page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(COMING_SOON_HTML);
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    serveRequest(req, res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  ' + SITE_NAME + ' Server');
    console.log('='.repeat(50));
    console.log('  Status:  Running');
    console.log('  Port:    ' + PORT);
    console.log('  URL:     http://localhost:' + PORT);
    console.log('='.repeat(50));
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});
