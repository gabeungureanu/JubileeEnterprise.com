/**
 * wwBibleweb.com Folder Management Server
 *
 * A Node.js server that provides API endpoints for:
 * - Listing folders in the directory
 * - Listing subfolders within a folder
 * - Creating new folders (including subfolders)
 * - Renaming existing folders (including nested paths)
 * - Deleting folders (including nested paths)
 *
 * TWO-LAYER ARCHITECTURE (v2.0):
 * - IDNS Layer: Domain registry only (domain names, protocol types, ownership)
 * - Websites Layer: Actual built websites (references IDNS, publication status, config)
 *
 * All operations use the InspireCodex.com API exclusively:
 * - Domain creation uses /api/v1/websites/create-with-domain (atomic domain+website)
 * - Domain listing uses /api/v1/websites (shows only domains with active websites)
 * - YAML file serves only as a local backup/export
 *
 * Run with: node server.js
 * Default port: 3847 (or process.env.PORT for iisnode)
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const YAML = require('yaml');

const PORT = process.env.PORT || 3847;
const BASE_DIR = __dirname; // The directory where this script is located
const CONFIG_FILE = path.join(BASE_DIR, 'idns.yaml');

// InspireCodex API Configuration
const INSPIRE_CODEX_API = process.env.INSPIRE_CODEX_API || 'http://localhost:3100';
let apiEnabled = true;

// Helper function to make HTTP requests to InspireCodex API
async function apiRequest(endpoint, options = {}) {
    const fetch = (await import('node-fetch')).default;
    const url = `${INSPIRE_CODEX_API}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `API request failed: ${response.status}`);
        }

        return data;
    } catch (err) {
        console.error(`API request to ${endpoint} failed:`, err.message);
        throw err;
    }
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
    } else if (pathname === '/api/ensure-daily-history' && req.method === 'POST') {
        handleEnsureDailyHistory(req, res);
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
            .filter(item => item.name !== 'node_modules') // Exclude node_modules
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
 * Get the IDNS configuration - from InspireCodex API (primary) or YAML (fallback)
 * Now uses the two-layer architecture: fetches from Websites API for live sites
 */
async function handleGetConfig(req, res) {
    try {
        // Try InspireCodex Websites API first (two-layer architecture)
        if (apiEnabled) {
            try {
                // Fetch websites with their domain information
                const data = await apiRequest('/api/v1/websites?environment=WWBW&limit=1000');

                const idns = {};
                for (const website of data.websites) {
                    const entry = {};
                    if (website.masked_resolution) entry.mres = website.masked_resolution;
                    // Check if managed from domain data
                    const domainData = await apiRequest(`/api/v1/idns/domains/${website.domain_name}`).catch(() => null);
                    if (domainData && domainData.managed) entry.managed = true;
                    // Add website status info
                    entry.website_id = website.id;
                    entry.status = website.status;
                    idns[website.domain_name] = entry;
                }

                const config = {
                    version: '2.0', // Updated version for two-layer architecture
                    lastModified: new Date().toISOString(),
                    source: 'api',
                    architecture: 'two-layer',
                    idns
                };

                sendJson(res, 200, config);
                return;
            } catch (apiError) {
                console.error('InspireCodex Websites API read failed, trying legacy IDNS:', apiError.message);
                // Try legacy IDNS API as fallback
                try {
                    const data = await apiRequest('/api/v1/idns/domains?limit=1000');

                    const idns = {};
                    for (const domain of data.domains) {
                        const entry = {};
                        if (domain.mres) entry.mres = domain.mres;
                        if (domain.managed) entry.managed = true;
                        idns[domain.domain_key] = entry;
                    }

                    const config = {
                        version: '1.0',
                        lastModified: new Date().toISOString(),
                        source: 'api',
                        architecture: 'legacy',
                        idns
                    };

                    sendJson(res, 200, config);
                    return;
                } catch (legacyError) {
                    console.error('Legacy IDNS API also failed, falling back to YAML:', legacyError.message);
                    apiEnabled = false;
                }
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
 * Save the IDNS configuration - uses two-layer architecture
 * Creates domain+website entries atomically via InspireCodex API
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
            config.version = config.version || '2.0';

            // Sort idns entries alphabetically (A-Z)
            const sortedIdns = {};
            Object.keys(config.idns)
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
                .forEach(key => {
                    sortedIdns[key] = config.idns[key];
                });
            config.idns = sortedIdns;

            let savedToApi = false;
            let created = 0;
            let updated = 0;
            let errors = [];

            // Save to InspireCodex API using two-layer architecture
            if (apiEnabled) {
                try {
                    // Get existing websites to determine what needs to be created vs updated
                    const existingData = await apiRequest('/api/v1/websites?environment=WWBW&limit=1000');
                    const existingDomains = new Set(existingData.websites.map(w => w.domain_name));

                    for (const [domainName, data] of Object.entries(config.idns)) {
                        try {
                            if (existingDomains.has(domainName)) {
                                // Update existing - find website ID and update
                                const website = existingData.websites.find(w => w.domain_name === domainName);
                                if (website) {
                                    await apiRequest(`/api/v1/websites/${website.id}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                            config: data
                                        })
                                    });
                                    updated++;
                                }
                            } else {
                                // Create new domain+website atomically
                                await apiRequest('/api/v1/websites/create-with-domain', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        domain_name: domainName,
                                        protocol_type: 'WWBW',
                                        site_title: domainName,
                                        content_source: domainName,
                                        content_type: 'folder',
                                        status: 'PUBLISHED',
                                        config: data
                                    })
                                });
                                created++;
                            }
                        } catch (itemError) {
                            // Domain may already exist - try just updating IDNS
                            if (itemError.message.includes('already exists')) {
                                try {
                                    await apiRequest(`/api/v1/idns/domains/${domainName}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                            mres: data.mres,
                                            managed: data.managed
                                        })
                                    });
                                    updated++;
                                } catch (updateError) {
                                    errors.push({ domain: domainName, error: updateError.message });
                                }
                            } else {
                                errors.push({ domain: domainName, error: itemError.message });
                            }
                        }
                    }

                    savedToApi = true;
                    console.log(`Configuration saved to API (two-layer): ${created} created, ${updated} updated, ${errors.length} errors`);
                } catch (apiError) {
                    console.error('InspireCodex API save failed:', apiError.message);

                    // Fallback to legacy sync endpoint
                    try {
                        const result = await apiRequest('/api/v1/idns/sync', {
                            method: 'POST',
                            body: JSON.stringify({ domains: config.idns })
                        });
                        savedToApi = result.success;
                        created = result.created;
                        updated = result.updated;
                        console.log(`Configuration saved via legacy sync: ${created} created, ${updated} updated`);
                    } catch (legacyError) {
                        console.error('Legacy sync also failed:', legacyError.message);
                        apiEnabled = false;
                    }
                }
            }

            // Always save to YAML as backup
            const tempFile = CONFIG_FILE + '.tmp';
            fs.writeFileSync(tempFile, YAML.stringify(config));
            fs.renameSync(tempFile, CONFIG_FILE);
            console.log('Configuration saved to YAML backup');

            sendJson(res, 200, {
                success: true,
                lastModified: config.lastModified,
                savedToApi: savedToApi,
                savedToYaml: true,
                created,
                updated,
                errors: errors.length > 0 ? errors : undefined
            });
        } catch (error) {
            console.error('Error saving config:', error);
            sendJson(res, 500, { error: 'Failed to save configuration: ' + error.message });
        }
    });
}

/**
 * Ensure today's history file exists for a website
 * If today's file doesn't exist, copies the most recent history file and updates the date
 * Business Rule: Auto-create daily history files on first visitor of each day
 */
function handleEnsureDailyHistory(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { sitePath } = JSON.parse(body);

            if (!sitePath || typeof sitePath !== 'string') {
                sendJson(res, 400, { error: 'sitePath is required' });
                return;
            }

            // Convert URL path to filesystem path (e.g., /pentecostal/home -> pentecostal/home)
            const cleanPath = sitePath.replace(/^\/+/, '').replace(/\//g, path.sep);
            const historyDir = path.join(BASE_DIR, cleanPath, '.webstore', 'history');

            // Security: ensure path is within BASE_DIR
            const normalizedPath = path.normalize(historyDir);
            if (!normalizedPath.startsWith(BASE_DIR)) {
                sendJson(res, 403, { error: 'Invalid site path' });
                return;
            }

            // Check if history directory exists
            if (!fs.existsSync(historyDir)) {
                sendJson(res, 404, { error: 'History directory not found', path: historyDir });
                return;
            }

            // Generate today's filename (YY-MMDD.json)
            const today = new Date();
            const yy = today.getFullYear().toString().slice(-2);
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayFileName = `${yy}-${mm}${dd}.json`;
            const todayFilePath = path.join(historyDir, todayFileName);

            // If today's file already exists, return success
            if (fs.existsSync(todayFilePath)) {
                sendJson(res, 200, {
                    success: true,
                    fileName: todayFileName,
                    action: 'exists',
                    message: 'Today\'s history file already exists'
                });
                return;
            }

            // Find the most recent history file
            const historyFiles = fs.readdirSync(historyDir)
                .filter(f => /^\d{2}-\d{4}\.json$/.test(f))
                .sort()
                .reverse();

            if (historyFiles.length === 0) {
                sendJson(res, 404, { error: 'No existing history files found to copy from' });
                return;
            }

            const mostRecentFile = historyFiles[0];
            const mostRecentPath = path.join(historyDir, mostRecentFile);

            // Read the most recent file
            const sourceContent = fs.readFileSync(mostRecentPath, 'utf8');
            let historyData;
            try {
                historyData = JSON.parse(sourceContent);
            } catch (parseError) {
                sendJson(res, 500, { error: 'Failed to parse source history file' });
                return;
            }

            // Update the date fields
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD
            historyData.buildDate = todayISO;
            historyData.buildTimestamp = today.toISOString();

            // Write the new file
            fs.writeFileSync(todayFilePath, JSON.stringify(historyData, null, 2));
            console.log(`Created daily history file: ${todayFilePath} (copied from ${mostRecentFile})`);

            sendJson(res, 201, {
                success: true,
                fileName: todayFileName,
                action: 'created',
                copiedFrom: mostRecentFile,
                message: 'Created today\'s history file from most recent file'
            });

        } catch (error) {
            console.error('Error ensuring daily history:', error);
            sendJson(res, 500, { error: 'Failed to ensure daily history: ' + error.message });
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
 * Supports SPA-style routing for clean URLs
 */
function serveStaticFile(req, res, pathname) {
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

    // Check if file exists and is not a directory
    let fileExists = fs.existsSync(filePath);
    let isDirectory = fileExists && fs.statSync(filePath).isDirectory();

    // SPA routing: For clean URLs like:
    //   /pentecostal/home/spiritual-growth/index.html (category page)
    //   /pentecostal/home/spiritual-growth/article-slug.html (article page)
    // serve the parent /pentecostal/home/index.html if it exists
    const pathParts = safePath.split(/[\/\\]/).filter(p => p);

    // SPA routing for paths with .html extension that don't exist as actual files
    if ((!fileExists || isDirectory) && safePath.endsWith('.html') && pathParts.length >= 3) {
        // Try to find /group/subsite/index.html (e.g., /pentecostal/home/index.html)
        const groupSubsitePath = path.join(BASE_DIR, pathParts[0], pathParts[1], 'index.html');
        if (fs.existsSync(groupSubsitePath)) {
            const stat = fs.statSync(groupSubsitePath);
            if (!stat.isDirectory()) {
                filePath = groupSubsitePath;
                fileExists = true;
                isDirectory = false;
            }
        }
    }

    // If it's a directory, try to serve index.html from that directory
    if (isDirectory) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
            filePath = indexPath;
            isDirectory = false;
        } else {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
    }

    // Check if file exists
    if (!fileExists && !fs.existsSync(filePath)) {
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
    console.log(`  API:     ${INSPIRE_CODEX_API}`);

    // Test InspireCodex API connection
    try {
        const data = await apiRequest('/api/v1/idns/domains?limit=1');
        console.log(`  Codex:   Connected via InspireCodex API`);
    } catch (err) {
        console.log(`  Codex:   Not connected (${err.message})`);
        apiEnabled = false;
    }

    console.log('='.repeat(50));
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});
