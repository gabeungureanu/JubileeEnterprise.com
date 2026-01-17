/**
 * Inspire 8.0: Cloudflared Services Manager
 *
 * Manages Cloudflare tunnel for production traffic routing.
 * Ensures the tunnel stays connected and auto-restarts if it disconnects.
 */

'use strict';

const { spawn, exec } = require('child_process');
const http = require('http');

const TUNNEL_NAME = 'jubilee-enterprise';
const HEALTH_PORT = 3903;
const CHECK_INTERVAL = 60000; // 60 seconds

let tunnelProcess = null;
let isShuttingDown = false;
let restartCount = 0;

function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
        });
    });
}

async function isTunnelRunning() {
    try {
        const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH');
        return stdout.includes('cloudflared.exe');
    } catch {
        return false;
    }
}

function startTunnel() {
    if (tunnelProcess) return;

    console.log(`[Cloudflared Manager] Starting tunnel: ${TUNNEL_NAME}`);

    tunnelProcess = spawn('cloudflared', ['tunnel', 'run', TUNNEL_NAME], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true
    });

    tunnelProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            console.log(`[cloudflared] ${line}`);
        });
    });

    tunnelProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            console.error(`[cloudflared] ${line}`);
        });
    });

    tunnelProcess.on('exit', (code, signal) => {
        console.log(`[Cloudflared Manager] Tunnel exited (code: ${code}, signal: ${signal})`);
        tunnelProcess = null;

        if (!isShuttingDown) {
            restartCount++;
            const delay = Math.min(1000 * Math.pow(2, restartCount - 1), 30000);
            console.log(`[Cloudflared Manager] Restarting in ${delay}ms (attempt ${restartCount})`);
            setTimeout(startTunnel, delay);

            // Reset restart count after 5 minutes of successful running
            setTimeout(() => {
                if (tunnelProcess) restartCount = 0;
            }, 300000);
        }
    });

    tunnelProcess.on('error', (err) => {
        console.error(`[Cloudflared Manager] Error: ${err.message}`);
    });

    console.log(`[Cloudflared Manager] Tunnel started (PID: ${tunnelProcess.pid})`);
}

async function stopTunnel() {
    if (!tunnelProcess) return;

    console.log('[Cloudflared Manager] Stopping tunnel...');
    tunnelProcess.kill('SIGTERM');

    await new Promise(resolve => {
        const timeout = setTimeout(() => {
            tunnelProcess?.kill('SIGKILL');
            resolve();
        }, 10000);

        tunnelProcess?.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });

    tunnelProcess = null;
}

function startHealthServer() {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/health' || req.url === '/') {
            const running = await isTunnelRunning();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: running ? 'ok' : 'tunnel_not_running',
                timestamp: new Date().toISOString(),
                tunnel: {
                    name: TUNNEL_NAME,
                    status: running ? 'connected' : 'disconnected',
                    pid: tunnelProcess?.pid || null,
                    restarts: restartCount
                }
            }, null, 2));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(HEALTH_PORT, () => {
        console.log(`[Cloudflared Manager] Health endpoint: http://localhost:${HEALTH_PORT}/health`);
    });

    return server;
}

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[Cloudflared Manager] ${signal} received, shutting down...`);
    await stopTunnel();
    console.log('[Cloudflared Manager] Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  Inspire 8.0: Cloudflared Services Manager');
    console.log('═'.repeat(60));
    console.log(`  Tunnel: ${TUNNEL_NAME}`);
    console.log('═'.repeat(60));
    console.log('');

    // Check if already running externally
    const alreadyRunning = await isTunnelRunning();
    if (alreadyRunning) {
        console.log('[Cloudflared Manager] Tunnel already running externally');
    } else {
        startTunnel();
    }

    startHealthServer();

    // Periodic health check
    setInterval(async () => {
        if (isShuttingDown) return;
        const running = await isTunnelRunning();
        if (!running && !tunnelProcess) {
            console.log('[Cloudflared Manager] Tunnel not running, starting...');
            startTunnel();
        }
    }, CHECK_INTERVAL);

    console.log('[Cloudflared Manager] Monitoring tunnel...');
}

main();
