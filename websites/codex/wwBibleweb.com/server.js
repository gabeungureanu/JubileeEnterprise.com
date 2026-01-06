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
 * Run with: node server.js
 * Default port: 3847 (or process.env.PORT for iisnode)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const YAML = require('yaml');

const PORT = process.env.PORT || 3847;
const BASE_DIR = __dirname; // The directory where this script is located
const CONFIG_FILE = path.join(BASE_DIR, 'idns.yaml');

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
 * Get the IDNS configuration file
 */
function handleGetConfig(req, res) {
    try {
        // Check if config file exists, create default if not
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultConfig = {
                version: '1.0',
                lastModified: null,
                idns: {}
            };
            fs.writeFileSync(CONFIG_FILE, YAML.stringify(defaultConfig));
        }

        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = YAML.parse(configData);
        sendJson(res, 200, config);
    } catch (error) {
        console.error('Error reading config:', error);
        sendJson(res, 500, { error: 'Failed to read configuration file' });
    }
}

/**
 * Save the IDNS configuration file
 */
function handleSaveConfig(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
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

            // Write to YAML file atomically (write to temp file, then rename)
            const tempFile = CONFIG_FILE + '.tmp';
            fs.writeFileSync(tempFile, YAML.stringify(config));
            fs.renameSync(tempFile, CONFIG_FILE);

            console.log('Configuration saved successfully to YAML');
            sendJson(res, 200, { success: true, lastModified: config.lastModified });
        } catch (error) {
            console.error('Error saving config:', error);
            sendJson(res, 500, { error: 'Failed to save configuration: ' + error.message });
        }
    });
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
server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  wwBibleweb.com Folder Management Server');
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
