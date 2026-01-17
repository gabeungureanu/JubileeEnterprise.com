/**
 * Inspire 8.0: Docker Services Manager
 *
 * Manages Docker containers for Qdrant, Redis, and other infrastructure.
 * Ensures containers are running and auto-restarts them if they stop.
 */

'use strict';

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_FILE = process.argv.find(arg => arg.startsWith('--config='))?.split('=')[1]
    || path.join(__dirname, 'docker-services.json');
const HEALTH_PORT = 3902;
const CHECK_INTERVAL = 30000; // 30 seconds

let config = null;
let isShuttingDown = false;

function loadConfig() {
    try {
        delete require.cache[require.resolve(CONFIG_FILE)];
        config = require(CONFIG_FILE);
        console.log(`[Docker Manager] Loaded config: ${CONFIG_FILE}`);
        return config;
    } catch (err) {
        console.error(`[Docker Manager] Failed to load config: ${err.message}`);
        process.exit(1);
    }
}

function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
        });
    });
}

async function isDockerRunning() {
    try {
        await execPromise('docker info');
        return true;
    } catch {
        return false;
    }
}

async function isContainerRunning(name) {
    try {
        const { stdout } = await execPromise(`docker inspect --format="{{.State.Running}}" ${name}`);
        return stdout.trim() === 'true';
    } catch {
        return false;
    }
}

async function startContainer(container) {
    const { name } = container;
    console.log(`[Docker Manager] Starting container: ${name}`);

    try {
        // Try to start existing container first
        await execPromise(`docker start ${name}`);
        console.log(`[Docker Manager] Container ${name} started`);
    } catch {
        console.log(`[Docker Manager] Container ${name} not found, may need manual docker-compose up`);
    }
}

async function checkAndStartContainers() {
    if (isShuttingDown) return;

    const dockerRunning = await isDockerRunning();
    if (!dockerRunning) {
        console.log('[Docker Manager] Docker is not running');
        return;
    }

    for (const container of config.containers) {
        if (!container.enabled) continue;

        const running = await isContainerRunning(container.name);
        if (!running) {
            console.log(`[Docker Manager] Container ${container.name} is not running`);
            await startContainer(container);
        }
    }
}

function startHealthServer() {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/health' || req.url === '/') {
            const dockerRunning = await isDockerRunning();
            const containers = [];

            for (const container of config.containers) {
                if (!container.enabled) continue;
                const running = await isContainerRunning(container.name);
                containers.push({
                    name: container.name,
                    port: container.port,
                    status: running ? 'running' : 'stopped'
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: dockerRunning ? 'ok' : 'docker_not_running',
                timestamp: new Date().toISOString(),
                containers
            }, null, 2));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(HEALTH_PORT, () => {
        console.log(`[Docker Manager] Health endpoint: http://localhost:${HEALTH_PORT}/health`);
    });

    return server;
}

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Docker Manager] ${signal} received, shutting down...`);
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  Inspire 8.0: Docker Services Manager');
    console.log('═'.repeat(60));
    console.log('');

    loadConfig();
    startHealthServer();

    // Initial check
    await checkAndStartContainers();

    // Periodic check
    setInterval(checkAndStartContainers, CHECK_INTERVAL);

    console.log('[Docker Manager] Monitoring containers...');
}

main();
