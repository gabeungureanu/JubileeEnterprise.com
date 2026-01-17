/**
 * Jubilee Unified Service Manager
 *
 * A single Windows Service that manages multiple Node.js websites/APIs.
 * Each site runs in its own child process with automatic restart on crash.
 *
 * Features:
 * - Unlimited websites from a single Windows Service
 * - Per-site configuration via JSON config file
 * - Automatic restart on crash with exponential backoff
 * - Zero-downtime reload via trigger file
 * - Health monitoring and logging
 * - Graceful shutdown
 *
 * Usage:
 *   node jubilee-services.cjs                    # Start all services
 *   node jubilee-services.cjs --config=custom.json  # Use custom config
 */

'use strict';

const { fork, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Configuration - support environment variable for paths with spaces
const CONFIG_FILE = process.env.SERVICE_CONFIG
    || process.argv.find(arg => arg.startsWith('--config='))?.split('=')[1]
    || path.join(__dirname, 'services.json');
const PID_FILE = path.join(__dirname, '.manager.pid');
const RELOAD_TRIGGER = path.join(__dirname, '.reload-trigger');
const LOG_DIR = path.join(__dirname, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Service state
const processes = new Map();
const restartCounts = new Map();
const MAX_RESTART_DELAY = 30000; // 30 seconds max
const BASE_RESTART_DELAY = 1000; // 1 second base

/**
 * Load configuration from JSON file
 */
function loadConfig() {
    try {
        const configPath = path.resolve(CONFIG_FILE);
        if (!fs.existsSync(configPath)) {
            console.error(`[Manager] Config file not found: ${configPath}`);
            process.exit(1);
        }

        // Clear require cache to allow hot reload
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);

        console.log(`[Manager] Loaded config from: ${configPath}`);
        return config;
    } catch (err) {
        console.error(`[Manager] Failed to load config: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Create a log stream for a service
 */
function createLogStream(serviceName) {
    const logFile = path.join(LOG_DIR, `${serviceName}.log`);
    return fs.createWriteStream(logFile, { flags: 'a' });
}

/**
 * Start a single service
 */
function startService(service) {
    const { name, script, cwd, port, env = {}, enabled = true } = service;

    if (!enabled) {
        console.log(`[Manager] Skipping disabled service: ${name}`);
        return;
    }

    if (processes.has(name)) {
        console.log(`[Manager] Service already running: ${name}`);
        return;
    }

    const scriptPath = path.resolve(cwd, script);
    if (!fs.existsSync(scriptPath)) {
        console.error(`[Manager] Script not found for ${name}: ${scriptPath}`);
        return;
    }

    console.log(`[Manager] Starting service: ${name} (port ${port})`);

    const logStream = createLogStream(name);
    const timestamp = () => new Date().toISOString();

    // Merge environment variables
    const processEnv = {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        ...env
    };

    // Spawn the child process using node explicitly (more compatible with Windows Services)
    const nodePath = process.execPath; // Gets the path to node.exe
    const child = spawn(nodePath, [scriptPath], {
        cwd: path.resolve(cwd),
        env: processEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true
    });

    // Log stdout
    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            logStream.write(`${timestamp()} [OUT] ${line}\n`);
        });
    });

    // Log stderr
    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            logStream.write(`${timestamp()} [ERR] ${line}\n`);
            console.error(`[${name}] ${line}`);
        });
    });

    // Handle process exit
    child.on('exit', (code, signal) => {
        console.log(`[Manager] Service ${name} exited (code: ${code}, signal: ${signal})`);
        logStream.write(`${timestamp()} [MANAGER] Process exited (code: ${code}, signal: ${signal})\n`);

        processes.delete(name);

        // Auto-restart with exponential backoff
        if (!isShuttingDown) {
            const count = (restartCounts.get(name) || 0) + 1;
            restartCounts.set(name, count);

            const delay = Math.min(BASE_RESTART_DELAY * Math.pow(2, count - 1), MAX_RESTART_DELAY);
            console.log(`[Manager] Restarting ${name} in ${delay}ms (attempt ${count})`);

            setTimeout(() => {
                if (!isShuttingDown) {
                    startService(service);
                }
            }, delay);

            // Reset restart count after successful run (5 minutes)
            setTimeout(() => {
                if (processes.has(name)) {
                    restartCounts.set(name, 0);
                }
            }, 300000);
        }
    });

    child.on('error', (err) => {
        console.error(`[Manager] Error starting ${name}: ${err.message}`);
        logStream.write(`${timestamp()} [MANAGER] Error: ${err.message}\n`);
    });

    processes.set(name, { child, service, logStream });
    console.log(`[Manager] Service ${name} started (PID: ${child.pid})`);
}

/**
 * Stop a single service
 */
function stopService(name, force = false) {
    const proc = processes.get(name);
    if (!proc) {
        console.log(`[Manager] Service not running: ${name}`);
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        console.log(`[Manager] Stopping service: ${name}`);

        const { child, logStream } = proc;
        const timeout = setTimeout(() => {
            console.log(`[Manager] Force killing ${name}`);
            child.kill('SIGKILL');
        }, force ? 0 : 10000);

        child.once('exit', () => {
            clearTimeout(timeout);
            logStream.end();
            processes.delete(name);
            resolve();
        });

        child.kill('SIGTERM');
    });
}

/**
 * Stop all services
 */
async function stopAllServices() {
    console.log('[Manager] Stopping all services...');
    const stopPromises = Array.from(processes.keys()).map(name => stopService(name));
    await Promise.all(stopPromises);
    console.log('[Manager] All services stopped');
}

/**
 * Reload configuration and restart changed services
 */
function reloadServices() {
    console.log('[Manager] Reloading services...');

    const config = loadConfig();
    const currentNames = new Set(processes.keys());
    const newNames = new Set(config.services.filter(s => s.enabled !== false).map(s => s.name));

    // Stop removed services
    for (const name of currentNames) {
        if (!newNames.has(name)) {
            console.log(`[Manager] Removing service: ${name}`);
            stopService(name);
        }
    }

    // Start/restart services
    for (const service of config.services) {
        if (service.enabled === false) continue;

        if (processes.has(service.name)) {
            // Restart existing service
            console.log(`[Manager] Restarting service: ${service.name}`);
            stopService(service.name).then(() => startService(service));
        } else {
            // Start new service
            startService(service);
        }
    }
}

/**
 * Health check endpoint
 */
function startHealthServer(port = 3999) {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            const services = [];
            for (const [name, proc] of processes) {
                services.push({
                    name,
                    port: proc.service.port,
                    pid: proc.child.pid,
                    status: proc.child.exitCode === null ? 'running' : 'stopped',
                    restarts: restartCounts.get(name) || 0
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                manager: {
                    pid: process.pid,
                    uptime: process.uptime()
                },
                services
            }, null, 2));
        } else if (req.url === '/reload') {
            reloadServices();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'reloading' }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Manager] Health port ${port} in use, trying ${port + 1}...`);
            server.listen(port + 1);
        } else {
            console.error(`[Manager] Health server error: ${err.message}`);
        }
    });

    server.listen(port, () => {
        console.log(`[Manager] Health endpoint: http://localhost:${port}/health`);
    });

    return server;
}

// Shutdown handling
let isShuttingDown = false;
let healthServer = null;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Manager] ${signal} received, shutting down...`);

    // Stop health server
    if (healthServer) {
        healthServer.close();
    }

    // Stop all services
    await stopAllServices();

    // Clean up PID file
    try {
        fs.unlinkSync(PID_FILE);
    } catch (e) {}

    console.log('[Manager] Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Watch for reload trigger
fs.watchFile(RELOAD_TRIGGER, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
        console.log('[Manager] Reload trigger detected');
        reloadServices();
    }
});

// Main entry point
function main() {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  Jubilee Unified Service Manager');
    console.log('═'.repeat(60));
    console.log(`  PID:           ${process.pid}`);
    console.log(`  Config:        ${CONFIG_FILE}`);
    console.log(`  Log Directory: ${LOG_DIR}`);
    console.log('═'.repeat(60));
    console.log('');

    // Write PID file
    fs.writeFileSync(PID_FILE, process.pid.toString());

    // Load configuration and start services
    const config = loadConfig();

    console.log(`[Manager] Found ${config.services.length} services in config`);
    console.log('');

    // Start health server
    healthServer = startHealthServer(config.healthPort || 3999);

    // Start all enabled services
    for (const service of config.services) {
        startService(service);
    }

    console.log('');
    console.log('[Manager] All services started');
    console.log('[Manager] Reload services: touch .reload-trigger');
    console.log('');
}

main();
