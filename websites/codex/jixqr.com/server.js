/**
 * jixqr.com - QR Code Service
 * Port: 3137
 *
 * Routes:
 *   /              - Landing page
 *   /r/:id         - Redirect by file ID
 *   /qr/:id        - Generate QR code for file ID
 *   /qr/:id.png    - Generate QR code as PNG
 *   /api/files     - List all public files
 *   /api/file/:id  - Get file details
 *   /health        - Health check
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const PORT = 3137; // Hardcoded to avoid env var conflicts
const SITE_NAME = 'jixqr.com';
const BASE_URL = process.env.BASE_URL || 'https://jixqr.com';
const AZURE_BLOB_URL = 'https://stgabeungure563580095495.blob.core.windows.net/jubileechat';

// Azure Blob Storage configuration (connection string from env var)
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'jubilee-music';

// Initialize Azure Blob client
let blobServiceClient;
let containerClient;
if (AZURE_CONNECTION_STRING) {
    try {
        blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
        containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
        console.log('  Azure Blob: Connected');
    } catch (err) {
        console.error('  Azure Blob: Connection failed -', err.message);
    }
} else {
    console.warn('  Azure Blob: AZURE_STORAGE_CONNECTION_STRING not set');
}

// PostgreSQL connection
const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'codex',
    user: process.env.PGUSER || 'guardian',
    password: process.env.PGPASSWORD || 'askShaddai4'
});

// Test DB connection on startup
pool.query('SELECT NOW()')
    .then(() => console.log('  Database: Connected'))
    .catch(err => console.error('  Database: Connection failed -', err.message));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'wwwroot')));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Stream proxy endpoint - streams media from Azure Blob Storage using SDK
app.get('/stream/:uuid', async (req, res) => {
    const uuid = req.params.uuid;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
        return res.status(400).json({ error: 'Invalid UUID' });
    }

    if (!containerClient) {
        return res.status(503).json({ error: 'Storage service unavailable' });
    }

    try {
        // Look up file details
        const fileResult = await pool.query(
            'SELECT azurefilename, file_extension, file_name FROM jc_system_share_redirector WHERE azurefilename = $1 AND is_active = true LIMIT 1',
            [uuid]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = fileResult.rows[0];
        const ext = file.file_extension?.toLowerCase() || '';
        const blobName = `${file.azurefilename}${ext}`;

        // Content type mapping
        const contentTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.aac': 'audio/aac',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm'
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        // Get blob client
        const blobClient = containerClient.getBlobClient(blobName);

        // Check if blob exists
        const exists = await blobClient.exists();
        if (!exists) {
            console.error(`Blob not found: ${blobName}`);
            return res.status(404).json({ error: 'Media file not found in storage' });
        }

        // Get blob properties
        const properties = await blobClient.getProperties();

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', properties.contentLength);

        if (file.file_name) {
            res.setHeader('Content-Disposition', `inline; filename="${file.file_name}${ext}"`);
        }

        // Download and stream the blob
        const downloadResponse = await blobClient.download(0);

        // Pipe the stream to the response
        downloadResponse.readableStreamBody.pipe(res);

        // Handle client disconnect
        req.on('close', () => {
            if (downloadResponse.readableStreamBody) {
                downloadResponse.readableStreamBody.destroy();
            }
        });

    } catch (err) {
        console.error('Stream proxy error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream media', details: err.message });
        }
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', service: SITE_NAME, database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', service: SITE_NAME, database: 'disconnected' });
    }
});

// Redirect by file ID - /r/:id
app.get('/r/:id', async (req, res) => {
    const fileId = req.params.id;
    const numericId = parseInt(fileId);

    if (isNaN(numericId)) {
        return res.status(400).send(errorPage('Invalid file ID'));
    }

    try {
        // First check for custom redirect URL
        const redirectResult = await pool.query(
            'SELECT redirect_link FROM jc_system_redirect_u_r_l WHERE file_id = $1 LIMIT 1',
            [numericId]
        );

        if (redirectResult.rows.length > 0 && redirectResult.rows[0].redirect_link) {
            // Track the hit
            await trackRedirectHit(numericId, req);
            return res.redirect(redirectResult.rows[0].redirect_link);
        }

        // Otherwise get file details for Azure blob redirect
        const fileResult = await pool.query(
            'SELECT * FROM jc_system_share_redirector WHERE file_i_d = $1 AND is_active = true LIMIT 1',
            [numericId]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).send(notFoundPage(fileId));
        }

        const file = fileResult.rows[0];

        // Track the hit
        await trackRedirectHit(numericId, req);

        // If there's a redirect URL in the file record
        if (file.redirect_u_r_l) {
            return res.redirect(file.redirect_u_r_l);
        }

        // Otherwise show file info page
        res.send(fileInfoPage(file));

    } catch (err) {
        console.error('Redirect error:', err);
        res.status(500).send(errorPage('Database error'));
    }
});

// Share by UUID - /share/:uuid (compatible with JubileeChat share links)
app.get('/share/:uuid', async (req, res) => {
    const uuid = req.params.uuid;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
        return res.status(400).send(errorPage('Invalid share ID'));
    }

    try {
        // Look up file by azurefilename (UUID)
        const fileResult = await pool.query(
            'SELECT * FROM jc_system_share_redirector WHERE azurefilename = $1 AND is_active = true LIMIT 1',
            [uuid]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).send(notFoundPage(uuid));
        }

        const file = fileResult.rows[0];

        // Track the hit
        await trackRedirectHit(file.file_i_d, req);

        // Check for custom redirect URL
        const redirectResult = await pool.query(
            'SELECT redirect_link FROM jc_system_redirect_u_r_l WHERE file_id = $1 LIMIT 1',
            [file.file_i_d]
        );

        if (redirectResult.rows.length > 0 && redirectResult.rows[0].redirect_link) {
            return res.redirect(redirectResult.rows[0].redirect_link);
        }

        // If there's a redirect URL in the file record
        if (file.redirect_u_r_l) {
            return res.redirect(file.redirect_u_r_l);
        }

        // Otherwise show file info page
        res.send(fileInfoPage(file));

    } catch (err) {
        console.error('Share redirect error:', err);
        res.status(500).send(errorPage('Database error'));
    }
});

// Generate QR code - /qr/:id or /qr/:id.png
app.get('/qr/:id', async (req, res) => {
    let fileId = req.params.id;
    const isPng = fileId.endsWith('.png');
    if (isPng) fileId = fileId.replace('.png', '');

    try {
        // Convert to integer for BIGINT column
        const numericId = parseInt(fileId);
        if (isNaN(numericId)) {
            return res.status(400).json({ error: 'Invalid file ID' });
        }

        // Verify file exists
        const fileResult = await pool.query(
            'SELECT file_i_d, file_name FROM jc_system_share_redirector WHERE file_i_d = $1 LIMIT 1',
            [numericId]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Get custom QR styling if exists
        const styleResult = await pool.query(
            'SELECT color, logo FROM jc_system_custom_q_r_logo WHERE file_id = $1 LIMIT 1',
            [numericId]
        );

        const redirectUrl = `${BASE_URL}/r/${fileId}`;

        // QR code options
        const qrOptions = {
            type: 'png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        };

        // Apply custom color if exists (convert RGB to hex)
        if (styleResult.rows.length > 0 && styleResult.rows[0].color) {
            const rgb = styleResult.rows[0].color.split(',').map(n => parseInt(n.trim()));
            if (rgb.length === 3) {
                const hex = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
                qrOptions.color.dark = hex;
            }
        }

        // Generate QR code
        const qrBuffer = await QRCode.toBuffer(redirectUrl, qrOptions);

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `inline; filename="qr-${fileId}.png"`);
        res.send(qrBuffer);

    } catch (err) {
        console.error('QR generation error:', err.message, err.stack);
        res.status(500).json({ error: 'QR generation failed', details: err.message });
    }
});

// API: List public files
app.get('/api/files', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(`
            SELECT file_i_d, file_name, share_description, file_extension,
                   is_public, created_date
            FROM jc_system_share_redirector
            WHERE is_active = true AND is_public = true
            ORDER BY created_date DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM jc_system_share_redirector WHERE is_active = true AND is_public = true'
        );

        res.json({
            files: result.rows.map(f => ({
                id: f.file_i_d,
                name: f.file_name,
                description: f.share_description,
                extension: f.file_extension,
                qrUrl: `${BASE_URL}/qr/${f.file_i_d}`,
                redirectUrl: `${BASE_URL}/r/${f.file_i_d}`,
                createdAt: f.created_date
            })),
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count)
            }
        });
    } catch (err) {
        console.error('API files error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Get file details
app.get('/api/file/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM jc_system_share_redirector WHERE file_i_d = $1 LIMIT 1',
            [fileId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const f = result.rows[0];
        res.json({
            id: f.file_i_d,
            name: f.file_name,
            description: f.share_description,
            extension: f.file_extension,
            duration: f.duration,
            isPublic: f.is_public,
            isActive: f.is_active,
            qrUrl: `${BASE_URL}/qr/${f.file_i_d}`,
            redirectUrl: `${BASE_URL}/r/${f.file_i_d}`,
            createdAt: f.created_date
        });
    } catch (err) {
        console.error('API file error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Track redirect hits
async function trackRedirectHit(fileId, req) {
    try {
        await pool.query(`
            INSERT INTO redirect_hits (file_id, ip_address, user_agent, hit_time)
            VALUES ($1, $2, $3, NOW())
        `, [fileId, req.ip || req.connection.remoteAddress, req.get('User-Agent') || 'Unknown']);
    } catch (err) {
        // Table might not exist yet, ignore
    }
}

// Landing page
app.get('/', (req, res) => {
    res.send(landingPage());
});

// HTML Templates
function landingPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE_NAME} - QR Code Service</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
        }
        .hero {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px 20px;
        }
        .logo { font-size: 5rem; margin-bottom: 1rem; }
        h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, #00d4ff, #7c3aed);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .tagline { font-size: 1.3rem; color: #a0a0a0; margin-bottom: 3rem; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            max-width: 800px;
            margin-bottom: 3rem;
        }
        .feature {
            background: rgba(255,255,255,0.05);
            padding: 25px;
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .feature-icon { font-size: 2rem; margin-bottom: 10px; }
        .feature h3 { color: #00d4ff; margin-bottom: 8px; }
        .feature p { color: #888; font-size: 0.9rem; }
        .stats {
            display: flex;
            gap: 40px;
            margin-bottom: 3rem;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 2.5rem; font-weight: bold; color: #00d4ff; }
        .stat-label { color: #666; font-size: 0.9rem; }
        .cta {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(90deg, #00d4ff, #7c3aed);
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            color: #fff;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,212,255,0.3);
        }
        .footer { margin-top: 3rem; color: #444; font-size: 0.9rem; }
        .footer a { color: #00d4ff; text-decoration: none; }
    </style>
</head>
<body>
    <div class="hero">
        <div class="logo">&#128200;</div>
        <h1>jixqr</h1>
        <p class="tagline">Dynamic QR Code Redirects</p>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">&#128279;</div>
                <h3>Smart Redirects</h3>
                <p>Dynamic URLs that can be updated without reprinting QR codes</p>
            </div>
            <div class="feature">
                <div class="feature-icon">&#127912;</div>
                <h3>Custom Styling</h3>
                <p>Branded QR codes with custom colors and logos</p>
            </div>
            <div class="feature">
                <div class="feature-icon">&#128202;</div>
                <h3>Analytics</h3>
                <p>Track scans, locations, and engagement metrics</p>
            </div>
        </div>

        <div class="stats" id="stats">
            <div class="stat">
                <div class="stat-value" id="fileCount">-</div>
                <div class="stat-label">QR Codes</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="publicCount">-</div>
                <div class="stat-label">Public Links</div>
            </div>
        </div>

        <a href="/api/files" class="cta">View Public QR Codes</a>

        <p class="footer">Part of the <a href="https://JubileeVerse.com">Jubilee Enterprise</a> family</p>
    </div>

    <script>
        fetch('/api/stats').then(r => r.json()).then(data => {
            document.getElementById('fileCount').textContent = data.total || '0';
            document.getElementById('publicCount').textContent = data.public || '0';
        }).catch(() => {});
    </script>
</body>
</html>`;
}

function fileInfoPage(file) {
    const isAudio = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'].includes(file.file_extension?.toLowerCase());
    const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(file.file_extension?.toLowerCase());
    // Use our proxy endpoint instead of direct Azure URL (Azure has private access)
    const mediaUrl = `${BASE_URL}/stream/${file.azurefilename}`;

    let mediaPlayer = '';
    if (isAudio) {
        mediaPlayer = `
        <div class="player">
            <audio id="audioPlayer" controls autoplay>
                <source src="${mediaUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        </div>`;
    } else if (isVideo) {
        mediaPlayer = `
        <div class="player">
            <video id="videoPlayer" controls autoplay width="100%">
                <source src="${mediaUrl}" type="video/mp4">
                Your browser does not support the video element.
            </video>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${file.file_name || 'Shared File'} - ${SITE_NAME}</title>
    <meta property="og:title" content="${file.file_name || 'Shared File'}">
    <meta property="og:description" content="${file.share_description || 'Shared via jixqr.com'}">
    <meta property="og:audio" content="${isAudio ? mediaUrl : ''}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .icon { font-size: 4rem; margin-bottom: 20px; }
        h1 { font-size: 1.5rem; margin-bottom: 10px; color: #00d4ff; }
        .description { color: #888; margin-bottom: 20px; font-size: 0.95rem; }
        .meta { color: #666; font-size: 0.85rem; margin-bottom: 20px; }
        .player {
            margin: 25px 0;
            padding: 15px;
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
        }
        audio, video {
            width: 100%;
            border-radius: 10px;
        }
        audio::-webkit-media-controls-panel {
            background: linear-gradient(135deg, #1a1a2e, #0f3460);
        }
        .download-btn {
            display: inline-block;
            margin-top: 15px;
            padding: 12px 30px;
            background: linear-gradient(90deg, #00d4ff, #7c3aed);
            color: #fff;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,212,255,0.3);
        }
        .qr { margin: 20px 0; }
        .qr img { max-width: 150px; border-radius: 10px; opacity: 0.7; }
        .footer { margin-top: 20px; color: #444; font-size: 0.8rem; }
        .footer a { color: #00d4ff; text-decoration: none; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${getFileIcon(file.file_extension)}</div>
        <h1>${file.file_name || 'Shared File'}</h1>
        <p class="description">${file.share_description || ''}</p>
        ${file.duration ? `<p class="meta">Duration: ${file.duration}</p>` : ''}
        ${mediaPlayer}
        ${(isAudio || isVideo) ? `<a href="${mediaUrl}" download="${file.file_name || 'file'}${file.file_extension || ''}" class="download-btn">Download</a>` : ''}
        <div class="qr">
            <img src="/qr/${file.file_i_d}" alt="QR Code">
        </div>
        <p class="footer">Shared via <a href="https://jixqr.com">jixqr.com</a></p>
    </div>
</body>
</html>`;
}

function notFoundPage(id) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Not Found - ${SITE_NAME}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            background: #1a1a2e;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        h1 { font-size: 6rem; color: #e94560; }
        p { color: #888; }
        a { color: #00d4ff; }
    </style>
</head>
<body>
    <div>
        <h1>404</h1>
        <p>QR code "${id}" not found or inactive</p>
        <p><a href="/">Return to ${SITE_NAME}</a></p>
    </div>
</body>
</html>`;
}

function errorPage(message) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error - ${SITE_NAME}</title>
    <style>
        body { font-family: sans-serif; background: #1a1a2e; color: #fff;
               display: flex; align-items: center; justify-content: center;
               min-height: 100vh; text-align: center; }
        h1 { color: #e94560; }
    </style>
</head>
<body>
    <div>
        <h1>Error</h1>
        <p>${message}</p>
        <p><a href="/" style="color:#00d4ff">Return home</a></p>
    </div>
</body>
</html>`;
}

function getFileIcon(ext) {
    const icons = {
        '.mp3': '&#127925;', '.wav': '&#127925;', '.m4a': '&#127925;',
        '.mp4': '&#127909;', '.mov': '&#127909;', '.avi': '&#127909;',
        '.pdf': '&#128196;', '.doc': '&#128196;', '.docx': '&#128196;',
        '.jpg': '&#128247;', '.jpeg': '&#128247;', '.png': '&#128247;',
        '.zip': '&#128230;', '.rar': '&#128230;'
    };
    return icons[ext?.toLowerCase()] || '&#128196;';
}

// API: Get stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalResult = await pool.query(
            'SELECT COUNT(*) FROM jc_system_share_redirector WHERE is_active = true'
        );
        const publicResult = await pool.query(
            'SELECT COUNT(*) FROM jc_system_share_redirector WHERE is_active = true AND is_public = true'
        );
        res.json({
            total: parseInt(totalResult.rows[0].count),
            public: parseInt(publicResult.rows[0].count)
        });
    } catch (err) {
        res.json({ total: 0, public: 0 });
    }
});

// Catch-all for bare UUIDs - serve share page directly
app.get('/:uuid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', async (req, res) => {
    const uuid = req.params.uuid;

    try {
        // Look up file by azurefilename (UUID)
        const fileResult = await pool.query(
            'SELECT * FROM jc_system_share_redirector WHERE azurefilename = $1 AND is_active = true LIMIT 1',
            [uuid]
        );

        if (fileResult.rows.length === 0) {
            return res.status(404).send(notFoundPage(uuid));
        }

        const file = fileResult.rows[0];

        // Track the hit
        await trackRedirectHit(file.file_i_d, req);

        // Check for custom redirect URL
        const redirectResult = await pool.query(
            'SELECT redirect_link FROM jc_system_redirect_u_r_l WHERE file_id = $1 LIMIT 1',
            [file.file_i_d]
        );

        if (redirectResult.rows.length > 0 && redirectResult.rows[0].redirect_link) {
            return res.redirect(redirectResult.rows[0].redirect_link);
        }

        // If there's a redirect URL in the file record
        if (file.redirect_u_r_l) {
            return res.redirect(file.redirect_u_r_l);
        }

        // Otherwise show file info page
        res.send(fileInfoPage(file));

    } catch (err) {
        console.error('UUID lookup error:', err);
        res.status(500).send(errorPage('Database error'));
    }
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log(`  ${SITE_NAME} QR Code Service`);
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    pool.end().then(() => process.exit(0));
});
