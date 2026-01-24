/**
 * JubileeIntelligence.com - AI Platform Server
 * Port: 3133
 * Authentication: Jubilee SSO via InspireCodex.com API
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3133;
const SITE_NAME = 'JubileeIntelligence.com';
const PUBLIC_DIR = path.join(__dirname, 'public');

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

// Main Index HTML (protected - requires auth)
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE_NAME} - AI Platform</title>
    <link rel="icon" type="image/png" href="/jubilee-profile.png">
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @font-face {
            font-family: 'Agency FB';
            font-weight: bold;
            font-display: swap;
            src: url('https://www.jubileeverse.com/fonts/AGENCYB.TTF');
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
        }
        /* Top Navigation */
        .top-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background-color: rgba(22, 33, 62, 0.95);
            border-bottom: 1px solid rgba(0, 212, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            z-index: 1000;
            backdrop-filter: blur(10px);
        }
        .nav-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
        }
        .nav-brand img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #00d4ff;
        }
        .nav-brand-text {
            font-family: 'Agency FB', sans-serif;
            font-size: 24px;
            font-weight: bold;
            color: #fff;
        }
        .nav-brand-text .intelligence {
            color: #00d4ff;
        }
        .nav-user {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e94560, #0f3460);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
        }
        .user-name {
            font-size: 14px;
            color: #ccc;
        }
        .btn-logout {
            background: transparent;
            border: 1px solid #e94560;
            color: #e94560;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        .btn-logout:hover {
            background-color: #e94560;
            color: #fff;
        }
        /* Main Content */
        .main-content {
            padding-top: 80px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .welcome-container {
            text-align: center;
            max-width: 600px;
            padding: 40px;
        }
        .welcome-icon {
            font-size: 80px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 16px;
            background: linear-gradient(90deg, #00d4ff, #e94560);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .tagline {
            font-size: 1.2rem;
            color: #a0a0a0;
            margin-bottom: 32px;
            line-height: 1.6;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-top: 32px;
        }
        .feature-card {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.2s ease;
        }
        .feature-card:hover {
            background-color: rgba(255, 255, 255, 0.1);
            border-color: #00d4ff;
            transform: translateY(-2px);
        }
        .feature-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .feature-title {
            font-size: 14px;
            font-weight: 600;
            color: #00d4ff;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
        }
        .footer a {
            color: #00d4ff;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <!-- Top Navigation -->
    <nav class="top-nav">
        <a href="/" class="nav-brand">
            <img src="/jubilee-profile.png" alt="JubileeIntelligence">
            <span class="nav-brand-text">Jubilee<span class="intelligence">Intelligence</span></span>
        </a>
        <div class="nav-user">
            <div class="user-info">
                <div class="user-avatar" id="userAvatar">?</div>
                <span class="user-name" id="userName">Loading...</span>
            </div>
            <button class="btn-logout" onclick="logout()">Sign Out</button>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="main-content">
        <div class="welcome-container">
            <div class="welcome-icon">&#129302;</div>
            <h1>Welcome to JubileeIntelligence</h1>
            <p class="tagline">
                AI-powered platform bringing wisdom and understanding to your fingertips.
                Explore intelligent features designed with faith and innovation.
            </p>
            <div class="feature-grid">
                <div class="feature-card">
                    <div class="feature-icon">&#128218;</div>
                    <div class="feature-title">Bible Study AI</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">&#128172;</div>
                    <div class="feature-title">Chat Assistant</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">&#127912;</div>
                    <div class="feature-title">Creative Tools</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">&#128200;</div>
                    <div class="feature-title">Analytics</div>
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        &copy; ${new Date().getFullYear()} JubileeIntelligence.com |
        Part of the <a href="https://jubileeverse.com">Jubilee Enterprise</a> family
    </div>

    <script>
        // Check authentication on page load
        document.addEventListener('DOMContentLoaded', function() {
            var auth = localStorage.getItem('jubileeIntelligenceAuth');
            if (!auth) {
                // Not authenticated, redirect to login
                window.location.href = '/login.html';
                return;
            }

            try {
                var authData = JSON.parse(auth);
                if (!authData.authenticated || !authData.user) {
                    window.location.href = '/login.html';
                    return;
                }

                // Display user info
                var user = authData.user;
                var initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '');
                if (!initials) initials = user.email?.[0]?.toUpperCase() || '?';

                document.getElementById('userAvatar').textContent = initials;
                document.getElementById('userName').textContent = user.displayName || user.firstName || user.email;
            } catch (e) {
                console.error('Auth parse error:', e);
                window.location.href = '/login.html';
            }
        });

        // Logout function
        function logout() {
            localStorage.removeItem('jubileeIntelligenceAuth');
            window.location.href = '/login.html';
        }
    </script>
</body>
</html>`;

// Parse URL and query parameters
function parseUrl(url) {
    const [pathname, queryString] = url.split('?');
    const params = new URLSearchParams(queryString || '');
    return { pathname, params };
}

// Serve static file from public directory
function serveStaticFile(res, filePath) {
    const fullPath = path.join(PUBLIC_DIR, filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(fs.readFileSync(fullPath));
        return true;
    }
    return false;
}

// Main request handler
function handleRequest(req, res) {
    const { pathname } = parseUrl(req.url);

    // API Routes
    if (pathname === '/api/auth/check') {
        // Simple auth check endpoint (client-side validates tokens)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Auth check endpoint' }));
        return;
    }

    if (pathname === '/api/auth/logout') {
        // Logout endpoint (client handles token removal)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
        return;
    }

    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            site: SITE_NAME,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Static files from public directory
    if (pathname !== '/' && pathname !== '/index.html') {
        // Remove leading slash for path join
        const staticPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        if (serveStaticFile(res, staticPath)) {
            return;
        }
    }

    // Login page (public, no auth required)
    if (pathname === '/login' || pathname === '/login.html') {
        if (serveStaticFile(res, 'login.html')) {
            return;
        }
        // Fallback if login.html doesn't exist
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Login page not found</h1>');
        return;
    }

    // Main page (index) - serves the authenticated dashboard
    // Authentication is handled client-side via localStorage check
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(INDEX_HTML);
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // CORS headers for API calls
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    handleRequest(req, res);
});

// Start server
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log(`  ${SITE_NAME} Server`);
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Auth:    Jubilee SSO via InspireCodex.com`);
    console.log('='.repeat(50));
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});
