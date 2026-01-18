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

// Cloudflared configuration paths (needed when running as LocalSystem)
const CLOUDFLARED_CONFIG = 'C:\\Users\\elian\\.cloudflared\\config.yml';
const CLOUDFLARED_CREDS = 'C:\\Users\\elian\\.cloudflared\\c4c875e2-55a9-4ad7-a0e9-36c391229c0b.json';

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
        // Check if cloudflared.exe is running
        const { stdout: taskList } = await execPromise('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH');
        if (!taskList.includes('cloudflared.exe')) {
            return false;
        }

        // Check if the tunnel has an ACTIVE connection (not just process running)
        // cloudflared tunnel info returns "does not have any active connection" if disconnected
        const { stdout: tunnelInfo } = await execPromise(`cloudflared tunnel info ${TUNNEL_NAME}`);

        // If tunnel info shows active connectors with EDGE connections, it's truly running
        const hasActiveConnection = tunnelInfo.includes('EDGE') &&
                                   !tunnelInfo.includes('does not have any active connection');

        if (!hasActiveConnection) {
            console.log('[Cloudflared Manager] cloudflared.exe running but tunnel not connected');
        }

        return hasActiveConnection;
    } catch (err) {
        console.log(`[Cloudflared Manager] Error checking tunnel: ${err.message}`);
        return false;
    }
}

async function killOrphanedCloudflared() {
    // Kill any cloudflared processes that aren't connected to our tunnel
    // This handles the case where a bare cloudflared.exe service starts on boot
    try {
        console.log('[Cloudflared Manager] Checking for orphaned cloudflared processes...');
        await execPromise('taskkill /F /IM cloudflared.exe');
        console.log('[Cloudflared Manager] Killed orphaned cloudflared processes');
        // Wait a moment for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
        // taskkill returns error if no processes found - that's fine
        if (!err.message.includes('not found') && !err.message.includes('Access is denied')) {
            console.log(`[Cloudflared Manager] Note: ${err.message}`);
        }
    }
}

async function startTunnel() {
    if (tunnelProcess) return;

    // Kill any orphaned cloudflared processes first
    await killOrphanedCloudflared();

    console.log(`[Cloudflared Manager] Starting tunnel: ${TUNNEL_NAME}`);

    tunnelProcess = spawn('cloudflared', [
        'tunnel',
        '--config', CLOUDFLARED_CONFIG,
        '--credentials-file', CLOUDFLARED_CREDS,
        'run', TUNNEL_NAME
    ], {
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

    // Check if already running externally with active connection
    const alreadyRunning = await isTunnelRunning();
    if (alreadyRunning) {
        console.log('[Cloudflared Manager] Tunnel already running with active connection');
    } else {
        await startTunnel();
    }

    startHealthServer();

    // Periodic health check
    setInterval(async () => {
        if (isShuttingDown) return;
        const running = await isTunnelRunning();
        if (!running && !tunnelProcess) {
            console.log('[Cloudflared Manager] Tunnel not running or not connected, starting...');
            await startTunnel();
        }
    }, CHECK_INTERVAL);

    console.log('[Cloudflared Manager] Monitoring tunnel...');
}

main();
