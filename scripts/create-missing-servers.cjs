/**
 * Create minimal "coming soon" server.js files for websites that are missing them
 */

const fs = require('fs');
const path = require('path');

// Load the services config
const configPath = path.join(__dirname, '..', 'services', 'Inspire.8.0', 'websites-services.json');
const config = require(configPath);
const codexDir = path.join(__dirname, '..', 'websites', 'codex');

// Build port mapping from config
const portMap = {};
const descriptionMap = {};
for (const service of config.services) {
    const siteName = path.basename(service.cwd);
    portMap[siteName] = service.port;
    descriptionMap[siteName] = service.description;
}

// Sites that need server.js
const sites = [
    'CelestialPaths.com',
    'InspireFlywheel.com',
    'InspireReactors.com',
    'InspireShalom.com',
    'InspireWebspaces.com',
    'jixqr.com',
    'jsvBible.com',
    'Jubilee-Software.com',
    'JubileeAdSpots.com',
    'JubileeAIVE.com',
    'JubileeApps.com',
    'JubileeBooks.com',
    'JubileeBrowser.com',
    'JubileeChat.com',
    'JubileeCircles.com',
    'JubileeIntelligence.com',
    'JubileeMessages.com',
    'JubileeOutlook.com',
    'JubileeParadox.com',
    'JubileePathfinders.com',
    'JubileePodcasts.com',
    'JubileeSearch.com',
    'JubileeSermons.com',
    'JubileeShekels.com',
    'JubileeSmallGroups.com',
    'JubileeTunes.com',
    'JubileeVibes.com',
    'JubileeVideos.com',
    'Talk2Characters.com'
];

// Server.js template
function createServerJs(siteName, port, description) {
    return `/**
 * ${siteName} - Coming Soon Server
 * ${description || siteName}
 * Port: ${port}
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || ${port};
const SITE_NAME = '${siteName}';

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
const COMING_SOON_HTML = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${SITE_NAME} - Coming Soon</title>
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
            background: linear-gradient(90deg, #e94560, #f39c12);
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
            background: linear-gradient(90deg, #e94560, #f39c12);
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(233, 69, 96, 0.4); }
            50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(233, 69, 96, 0.6); }
        }
        .footer {
            margin-top: 3rem;
            color: #666;
            font-size: 0.9rem;
        }
        .footer a { color: #e94560; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">&#128640;</div>
        <h1>\${SITE_NAME.replace('.com', '')}</h1>
        <p class="tagline">Something amazing is on the way</p>
        <div class="coming-soon">Coming Soon</div>
        <p class="footer">Part of the <a href="https://JubileeVerse.com">Jubilee Enterprise</a> family</p>
    </div>
</body>
</html>\`;

// Serve static file or coming soon page
function serveRequest(req, res) {
    const pathname = req.url.split('?')[0];

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
    console.log(\`  \${SITE_NAME} Server\`);
    console.log('='.repeat(50));
    console.log(\`  Status:  Running\`);
    console.log(\`  Port:    \${PORT}\`);
    console.log(\`  URL:     http://localhost:\${PORT}\`);
    console.log('='.repeat(50));
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\\nShutting down...');
    server.close(() => process.exit(0));
});
`;
}

// Create server.js for each site that needs it
let created = 0;
let skipped = 0;

for (const site of sites) {
    const siteDir = path.join(codexDir, site);
    const serverPath = path.join(siteDir, 'server.js');

    // Ensure directory exists
    if (!fs.existsSync(siteDir)) {
        fs.mkdirSync(siteDir, { recursive: true });
        console.log(`Created directory: ${site}`);
    }

    // Check if server.js already exists
    if (fs.existsSync(serverPath)) {
        console.log(`Skipped (exists): ${site}`);
        skipped++;
        continue;
    }

    const port = portMap[site] || 3100;
    const description = descriptionMap[site] || site;
    const content = createServerJs(site, port, description);

    fs.writeFileSync(serverPath, content);
    console.log(`Created: ${site}/server.js (port ${port})`);
    created++;
}

console.log('');
console.log(`Done! Created ${created} server.js files, skipped ${skipped} existing files.`);
