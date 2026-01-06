/**
 * wwBibleweb.com Folder Management Server
 *
 * A simple Node.js server that provides API endpoints for:
 * - Listing folders in the directory
 * - Listing subfolders within a folder
 * - Creating new folders (including subfolders)
 * - Renaming existing folders (including nested paths)
 * - Deleting folders (including nested paths)
 *
 * IDNS Configuration is now synced with the Codex PostgreSQL database.
 * The database is the source of truth; YAML serves as backup/export.
 *
 * Run with: node server.js
 * Default port: 3847
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3847;
const BASE_DIR = __dirname; // The directory where this script is located
const CONFIG_FILE = path.join(BASE_DIR, 'idns.yaml');

// Database configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'Codex',
    user: process.env.DB_USER || 'guardian',
    password: process.env.DB_PASSWORD || 'askShaddai4e!',
    max: 10,
    idleTimeoutMillis: 30000
};

// Database pool (lazy initialization)
let dbPool = null;
let dbEnabled = true;

function getDbPool() {
    if (!dbPool && dbEnabled) {
        dbPool = new Pool(DB_CONFIG);
        dbPool.on('error', (err) => {
            console.error('Database pool error:', err.message);
            dbEnabled = false;
        });
    }
    return dbPool;
}

// MIME types for serving static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Create the HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Routes
    if (pathname === '/api/folders' && req.method === 'GET') {
        handleGetFolders(req, res);
    } else if (pathname === '/api/folders/subfolders' && req.method === 'GET') {
        handleGetSubfolders(req, res, parsedUrl.query);
    } else if (pathname === '/api/folders' && req.method === 'POST') {
        handleCreateFolder(req, res);
    } else if (pathname === '/api/folders' && req.method === 'DELETE') {
        handleDeleteFolder(req, res);
    } else if (pathname === '/api/folders/rename' && req.method === 'POST') {
        handleRenameFolder(req, res);
    } else if (pathname === '/api/config' && req.method === 'GET') {
        handleGetConfig(req, res);
    } else if (pathname === '/api/config' && req.method === 'POST') {
        handleSaveConfig(req, res);
    } else {
        // Serve static files
        serveStaticFile(req, res, pathname);
    }
});

/**
 * Get list of all folders in the base directory
 */
function handleGetFolders(req, res) {
    try {
        const items = fs.readdirSync(BASE_DIR, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory())
            .filter(item => !item.name.startsWith('.')) // Exclude hidden folders
            .map(item => {
                const folderPath = path.join(BASE_DIR, item.name);
                const subfolderCount = countSubfolders(folderPath);
                return {
                    name: item.name,
                    path: folderPath,
                    subfolderCount: subfolderCount
                };
            });

        sendJson(res, 200, folders);
    } catch (error) {
        console.error('Error reading folders:', error);
        sendJson(res, 500, { error: 'Failed to read folders' });
    }
}

/**
 * Count immediate subfolders in a directory
 */
function countSubfolders(folderPath) {
    try {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });
        return items.filter(item => item.isDirectory() && !item.name.startsWith('.')).length;
    } catch (error) {
        return 0;
    }
}

/**
 * Get list of subfolders within a specified folder path
 */
function handleGetSubfolders(req, res, query) {
    try {
        const relativePath = query.path;

        if (!relativePath) {
            sendJson(res, 400, { error: 'Path parameter is required' });
            return;
        }

        // Convert relative path (using forward slashes) to system path
        const targetPath = path.join(BASE_DIR, relativePath.replace(/\//g, path.sep));

        // Security: ensure path is within BASE_DIR
        const normalizedTarget = path.normalize(targetPath);
        if (!normalizedTarget.startsWith(BASE_DIR)) {
            sendJson(res, 403, { error: 'Invalid folder path' });
            return;
        }

        // Check if folder exists
        if (!fs.existsSync(targetPath)) {
            sendJson(res, 404, { error: 'Folder does not exist' });
            return;
        }

        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const subfolders = items
            .filter(item => item.isDirectory())
            .filter(item => !item.name.startsWith('.')) // Exclude hidden folders
            .map(item => {
                const subfolderPath = path.join(targetPath, item.name);
                return {
                    name: item.name,
                    path: subfolderPath,
                    subfolderCount: countSubfolders(subfolderPath)
                };
            });

        sendJson(res, 200, subfolders);
    } catch (error) {
        console.error('Error reading subfolders:', error);
        sendJson(res, 500, { error: 'Failed to read subfolders' });
    }
}

/**
 * Create a new folder (supports both root and subfolders)
 */
function handleCreateFolder(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { name, parentPath } = JSON.parse(body);

            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'Folder name is required' });
                return;
            }

            // Validate folder name
            if (!isValidFolderName(name)) {
                sendJson(res, 400, { error: 'Invalid folder name' });
                return;
            }

            // Determine target directory
            let targetDir = BASE_DIR;
            if (parentPath) {
                targetDir = path.join(BASE_DIR, parentPath.replace(/\//g, path.sep));

                // Security: ensure parent path is within BASE_DIR
                const normalizedParent = path.normalize(targetDir);
                if (!normalizedParent.startsWith(BASE_DIR)) {
                    sendJson(res, 403, { error: 'Invalid parent path' });
                    return;
                }

                // Check if parent exists
                if (!fs.existsSync(targetDir)) {
                    sendJson(res, 404, { error: 'Parent folder does not exist' });
                    return;
                }
            }

            const folderPath = path.join(targetDir, name);

            // Check if already exists
            if (fs.existsSync(folderPath)) {
                sendJson(res, 409, { error: 'A folder with this name already exists' });
                return;
            }

            // Create the folder
            fs.mkdirSync(folderPath);
            const displayPath = parentPath ? `${parentPath}/${name}` : name;
            console.log(`Created folder: ${displayPath}`);

            sendJson(res, 201, { success: true, name: name, path: displayPath });
        } catch (error) {
            console.error('Error creating folder:', error);
            sendJson(res, 500, { error: 'Failed to create folder: ' + error.message });
        }
    });
}

/**
 * Delete a folder (supports nested paths)
 */
function handleDeleteFolder(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { name, path: folderPathParam } = JSON.parse(body);

            // Support both 'name' (legacy) and 'path' (new nested support)
            const relativePath = folderPathParam || name;

            if (!relativePath || typeof relativePath !== 'string') {
                sendJson(res, 400, { error: 'Folder path is required' });
                return;
            }

            const folderPath = path.join(BASE_DIR, relativePath.replace(/\//g, path.sep));

            // Security: ensure path is within BASE_DIR
            const normalizedPath = path.normalize(folderPath);
            if (!normalizedPath.startsWith(BASE_DIR) || normalizedPath === BASE_DIR) {
                sendJson(res, 403, { error: 'Invalid folder path' });
                return;
            }

            // Check if folder exists
            if (!fs.existsSync(folderPath)) {
                sendJson(res, 404, { error: 'Folder does not exist' });
                return;
            }

            // Check if it's actually a directory
            const stats = fs.statSync(folderPath);
            if (!stats.isDirectory()) {
                sendJson(res, 400, { error: 'Path is not a folder' });
                return;
            }

            // Delete the folder recursively
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`Deleted folder: ${relativePath}`);

            sendJson(res, 200, { success: true, path: relativePath });
        } catch (error) {
            console.error('Error deleting folder:', error);
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                sendJson(res, 403, { error: 'Permission denied. Cannot delete folder.' });
            } else if (error.code === 'EBUSY') {
                sendJson(res, 409, { error: 'Folder is in use. Please close any programs using it.' });
            } else {
                sendJson(res, 500, { error: 'Failed to delete folder: ' + error.message });
            }
        }
    });
}

/**
 * Rename an existing folder (supports nested paths)
 */
function handleRenameFolder(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { oldName, newName, oldPath: oldPathParam } = JSON.parse(body);

            // Support both 'oldName' (legacy) and 'oldPath' (new nested support)
            const relativePath = oldPathParam || oldName;

            if (!relativePath || !newName) {
                sendJson(res, 400, { error: 'Both old path and new folder name are required' });
                return;
            }

            // Validate new folder name
            if (!isValidFolderName(newName)) {
                sendJson(res, 400, { error: 'Invalid new folder name' });
                return;
            }

            const oldFullPath = path.join(BASE_DIR, relativePath.replace(/\//g, path.sep));

            // Get parent directory and construct new path
            const parentDir = path.dirname(oldFullPath);
            const newFullPath = path.join(parentDir, newName);

            // Security: ensure paths are within BASE_DIR
            const normalizedOld = path.normalize(oldFullPath);
            const normalizedNew = path.normalize(newFullPath);
            if (!normalizedOld.startsWith(BASE_DIR) || !normalizedNew.startsWith(BASE_DIR)) {
                sendJson(res, 403, { error: 'Invalid folder path' });
                return;
            }

            // Check if source exists
            if (!fs.existsSync(oldFullPath)) {
                sendJson(res, 404, { error: 'Source folder does not exist' });
                return;
            }

            // Get old name for comparison
            const oldFolderName = path.basename(oldFullPath);

            // Check if destination already exists (case-insensitive on Windows)
            if (oldFolderName.toLowerCase() !== newName.toLowerCase() && fs.existsSync(newFullPath)) {
                sendJson(res, 409, { error: 'A folder with the new name already exists' });
                return;
            }

            // Rename the folder
            fs.renameSync(oldFullPath, newFullPath);
            console.log(`Renamed folder: ${relativePath} -> ${newName}`);

            sendJson(res, 200, { success: true, oldPath: relativePath, newName: newName });
        } catch (error) {
            console.error('Error renaming folder:', error);
            sendJson(res, 500, { error: 'Failed to rename folder: ' + error.message });
        }
    });
}

/**
 * Get the IDNS configuration - from database (primary) or YAML (fallback)
 */
async function handleGetConfig(req, res) {
    try {
        const pool = getDbPool();

        // Try database first
        if (pool && dbEnabled) {
            try {
                const result = await pool.query(`
                    SELECT domain_key, mres, managed, metadata
                    FROM idns_domains
                    WHERE is_active = true
                    ORDER BY domain_key
                `);

                const idns = {};
                for (const row of result.rows) {
                    const data = {};
                    if (row.mres) data.mres = row.mres;
                    if (row.managed) data.managed = true;
                    idns[row.domain_key] = data;
                }

                const config = {
                    version: '1.0',
                    lastModified: new Date().toISOString(),
                    source: 'database',
                    idns
                };

                sendJson(res, 200, config);
                return;
            } catch (dbError) {
                console.error('Database read failed, falling back to YAML:', dbError.message);
            }
        }

        // Fallback to YAML file
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultConfig = {
                version: '1.0',
                lastModified: null,
                source: 'yaml',
                idns: {}
            };
            fs.writeFileSync(CONFIG_FILE, YAML.stringify(defaultConfig));
        }

        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = YAML.parse(configData);
        config.source = 'yaml';
        sendJson(res, 200, config);
    } catch (error) {
        console.error('Error reading config:', error);
        sendJson(res, 500, { error: 'Failed to read configuration file' });
    }
}

/**
 * Save the IDNS configuration - to database (primary) and YAML (backup)
 */
function handleSaveConfig(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            // Request body is still JSON from frontend
            const config = JSON.parse(body);

            // Validate config structure
            if (!config || typeof config !== 'object') {
                sendJson(res, 400, { error: 'Invalid configuration format' });
                return;
            }

            // Ensure required fields exist
            if (!config.idns || typeof config.idns !== 'object') {
                sendJson(res, 400, { error: 'Configuration must contain idns object' });
                return;
            }

            // Update lastModified timestamp
            config.lastModified = new Date().toISOString();
            config.version = config.version || '1.0';

            // Sort idns entries alphabetically (A-Z)
            const sortedIdns = {};
            Object.keys(config.idns)
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
                .forEach(key => {
                    sortedIdns[key] = config.idns[key];
                });
            config.idns = sortedIdns;

            const pool = getDbPool();
            let savedToDb = false;

            // Save to database first
            if (pool && dbEnabled) {
                try {
                    // Use transaction for consistency
                    const client = await pool.connect();
                    try {
                        await client.query('BEGIN');

                        // Get current domain keys in database
                        const existingResult = await client.query('SELECT domain_key FROM idns_domains');
                        const existingKeys = new Set(existingResult.rows.map(r => r.domain_key));

                        // Upsert all entries from config
                        for (const [domainKey, data] of Object.entries(config.idns)) {
                            const domainType = inferDomainType(domainKey);
                            const displayName = generateDisplayName(domainKey);
                            const parentDomain = domainKey.includes('/') ? domainKey.split('/')[0] : null;

                            await client.query(`
                                INSERT INTO idns_domains (domain_key, domain_type, display_name, mres, managed, parent_domain, metadata, is_active)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                                ON CONFLICT (domain_key) DO UPDATE SET
                                    mres = EXCLUDED.mres,
                                    managed = EXCLUDED.managed,
                                    metadata = EXCLUDED.metadata,
                                    is_active = true,
                                    updated_at = CURRENT_TIMESTAMP
                            `, [
                                domainKey,
                                domainType,
                                displayName,
                                data.mres || null,
                                data.managed || false,
                                parentDomain,
                                JSON.stringify(data)
                            ]);

                            existingKeys.delete(domainKey);
                        }

                        // Mark removed entries as inactive (soft delete)
                        for (const removedKey of existingKeys) {
                            await client.query(
                                'UPDATE idns_domains SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE domain_key = $1',
                                [removedKey]
                            );
                        }

                        await client.query('COMMIT');
                        savedToDb = true;
                        console.log('Configuration saved to database');
                    } catch (txError) {
                        await client.query('ROLLBACK');
                        throw txError;
                    } finally {
                        client.release();
                    }
                } catch (dbError) {
                    console.error('Database save failed:', dbError.message);
                }
            }

            // Always save to YAML as backup
            const tempFile = CONFIG_FILE + '.tmp';
            fs.writeFileSync(tempFile, YAML.stringify(config));
            fs.renameSync(tempFile, CONFIG_FILE);
            console.log('Configuration saved to YAML');

            sendJson(res, 200, {
                success: true,
                lastModified: config.lastModified,
                savedToDatabase: savedToDb,
                savedToYaml: true
            });
        } catch (error) {
            console.error('Error saving config:', error);
            sendJson(res, 500, { error: 'Failed to save configuration: ' + error.message });
        }
    });
}

/**
 * Determine domain type based on the domain key
 */
function inferDomainType(domainKey) {
    const countries = [
        'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia',
        'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
        'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'botswana', 'brazil',
        'brunei', 'bulgaria', 'cambodia', 'cameroon', 'canada', 'chad', 'chile', 'china',
        'colombia', 'comoros', 'croatia', 'cuba', 'cyprus', 'denmark', 'djibouti', 'dominica',
        'ecuador', 'egypt', 'eritrea', 'estonia', 'ethiopia', 'fiji', 'finland', 'france',
        'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada', 'guatemala',
        'guinea', 'guyana', 'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia',
        'iran', 'iraq', 'ireland', 'israel', 'italy', 'jamaica', 'japan', 'jordan',
        'kazakhstan', 'kenya', 'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos', 'latvia',
        'lebanon', 'lesotho', 'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg',
        'madagascar', 'malawi', 'malaysia', 'maldives', 'mali', 'malta', 'mauritania',
        'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro',
        'morocco', 'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal', 'netherlands',
        'newzealand', 'nicaragua', 'nigeria', 'norway', 'oman', 'pakistan', 'palau',
        'palestine', 'panama', 'paraguay', 'peru', 'philippines', 'poland', 'portugal',
        'qatar', 'romania', 'russia', 'rwanda', 'samoa', 'senegal', 'serbia', 'seychelles',
        'singapore', 'slovakia', 'slovenia', 'somalia', 'spain', 'sudan', 'suriname',
        'sweden', 'switzerland', 'taiwan', 'tajikistan', 'tanzania', 'thailand', 'togo',
        'tonga', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu', 'uganda', 'ukraine',
        'uruguay', 'uzbekistan', 'vanuatu', 'venezuela', 'vietnam', 'yemen', 'zambia',
        'zimbabwe', 'unitedstates', 'unitedkingdom', 'unitedarabemirates', 'southafrica',
        'southkorea', 'northkorea', 'saudiarabia', 'srilanka', 'papuanewguinea', 'hongkong'
    ];

    const ministryTopics = [
        'academy', 'bible', 'biblical', 'charity', 'children', 'church', 'coaching',
        'community', 'conference', 'discipleship', 'events', 'family', 'fellowship',
        'group', 'healing', 'inspire', 'kids', 'library', 'marriage', 'men', 'ministry',
        'mission', 'music', 'news', 'pastor', 'podcast', 'praise', 'prayer', 'prophet',
        'recovery', 'retreat', 'school', 'scriptural', 'sermon', 'serve', 'shepherd',
        'teacher', 'testimony', 'women', 'worship', 'youth', 'apostle', 'evangelist'
    ];

    const lowerKey = domainKey.toLowerCase();
    if (domainKey.includes('/')) return 'webspace';
    if (countries.includes(lowerKey)) return 'country';
    if (ministryTopics.includes(lowerKey)) return 'ministry';
    return 'denomination';
}

/**
 * Generate display name from domain key
 */
function generateDisplayName(domainKey) {
    if (domainKey.includes('/')) {
        const parts = domainKey.split('/');
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');
    }
    const spaced = domainKey.replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

/**
 * Serve static files (index.html, etc.)
 */
function serveStaticFile(req, res, pathname) {
    // Default to index.html
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(BASE_DIR, safePath);

    // Make sure we're still within the base directory
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve the file
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    } catch (error) {
        console.error('Error serving file:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
}

/**
 * Helper: Send JSON response
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * Helper: Validate folder name
 */
function isValidFolderName(name) {
    // Check for invalid Windows filename characters
    const invalidChars = /[\\/:*?"<>|]/;
    // Check for reserved Windows names
    const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

    return (
        name &&
        typeof name === 'string' &&
        name.length > 0 &&
        name.length <= 255 &&
        !invalidChars.test(name) &&
        !reserved.test(name) &&
        !name.startsWith('.') &&
        name.trim() === name
    );
}

// Start the server
server.listen(PORT, async () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  wwBibleweb.com Folder Management Server');
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Dir:     ${BASE_DIR}`);

    // Test database connection
    try {
        const pool = getDbPool();
        if (pool) {
            await pool.query('SELECT 1');
            const countResult = await pool.query('SELECT COUNT(*) FROM idns_domains WHERE is_active = true');
            console.log(`  DB:      Connected (Codex - ${countResult.rows[0].count} IDNS entries)`);
        }
    } catch (err) {
        console.log(`  DB:      Not connected (${err.message})`);
        dbEnabled = false;
    }

    console.log('='.repeat(50));
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    if (dbPool) {
        await dbPool.end();
        console.log('Database pool closed.');
    }
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});
