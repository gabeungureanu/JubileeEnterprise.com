/**
 * InspireContinuum API - Production Cluster Server
 *
 * Multi-core clustering wrapper for high availability:
 * - Uses all available CPU cores (16 workers on this system)
 * - Zero-downtime reload via file trigger
 * - Auto-restart crashed workers
 * - Windows Service compatible
 *
 * PRODUCTION PORT: 3101 (API Server)
 *
 * For Windows Service deployment, use:
 *   node install-service.cjs    (as Administrator)
 *
 * For zero-downtime reload after code changes:
 *   node reload-service.cjs
 */

'use strict';

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Configuration
const NUM_WORKERS = process.env.CLUSTER_WORKERS || os.cpus().length;
const RELOAD_TRIGGER_FILE = path.join(__dirname, '.reload-trigger');
const PID_FILE = path.join(__dirname, '.cluster-master.pid');

if (cluster.isMaster) {
    console.log('');
    console.log('='.repeat(60));
    console.log('  InspireContinuum API - Production Cluster');
    console.log('='.repeat(60));
    console.log(`  Master PID:    ${process.pid}`);
    console.log(`  Workers:       ${NUM_WORKERS}`);
    console.log(`  CPU Cores:     ${os.cpus().length}`);
    console.log(`  Port:          3101 (API Server)`);
    console.log('='.repeat(60));
    console.log('');

    // Write PID file for reload script
    fs.writeFileSync(PID_FILE, process.pid.toString());

    // Track workers
    const workers = new Set();
    let isReloading = false;
    let reloadQueue = [];

    // Fork workers
    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = cluster.fork();
        workers.add(worker.id);
        console.log(`[Cluster] Worker ${worker.id} started (PID: ${worker.process.pid})`);
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        workers.delete(worker.id);
        console.log(`[Cluster] Worker ${worker.id} exited (code: ${code}, signal: ${signal})`);

        // Auto-restart unless we're shutting down
        if (!isReloading || reloadQueue.length > 0) {
            const newWorker = cluster.fork();
            workers.add(newWorker.id);
            console.log(`[Cluster] Worker ${newWorker.id} started to replace ${worker.id}`);

            // Continue reload if in progress
            if (reloadQueue.length > 0) {
                setTimeout(() => reloadNextWorker(), 1000);
            }
        }
    });

    // Zero-downtime reload function
    function reloadWorkers() {
        if (isReloading) {
            console.log('[Cluster] Reload already in progress, queuing...');
            return;
        }

        console.log('');
        console.log('[Cluster] Starting zero-downtime reload...');
        isReloading = true;
        reloadQueue = Object.keys(cluster.workers).map(Number);
        reloadNextWorker();
    }

    function reloadNextWorker() {
        if (reloadQueue.length === 0) {
            isReloading = false;
            console.log('[Cluster] Zero-downtime reload complete!');
            console.log('');
            return;
        }

        const workerId = reloadQueue.shift();
        const worker = cluster.workers[workerId];

        if (worker) {
            console.log(`[Cluster] Gracefully restarting worker ${workerId}...`);
            worker.disconnect();

            // Force kill after 10 seconds if still alive
            const timeout = setTimeout(() => {
                if (!worker.isDead()) {
                    console.log(`[Cluster] Force killing worker ${workerId}`);
                    worker.kill();
                }
            }, 10000);

            worker.on('disconnect', () => {
                clearTimeout(timeout);
            });
        } else {
            // Worker doesn't exist, continue
            setTimeout(() => reloadNextWorker(), 100);
        }
    }

    // Watch for reload trigger file (Windows-compatible)
    fs.watchFile(RELOAD_TRIGGER_FILE, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
            console.log('[Cluster] Reload trigger detected');
            reloadWorkers();
        }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[Cluster] SIGTERM received, shutting down...');

        // Clean up PID file
        try {
            fs.unlinkSync(PID_FILE);
        } catch (e) {}

        // Disconnect all workers gracefully
        for (const id in cluster.workers) {
            cluster.workers[id].disconnect();
        }

        // Force exit after 30 seconds
        setTimeout(() => process.exit(0), 30000);
    });

    process.on('SIGINT', () => {
        console.log('[Cluster] SIGINT received, shutting down...');

        try {
            fs.unlinkSync(PID_FILE);
        } catch (e) {}

        for (const id in cluster.workers) {
            cluster.workers[id].disconnect();
        }

        setTimeout(() => process.exit(0), 30000);
    });

} else {
    // Worker process - run the actual server
    console.log(`[Worker ${cluster.worker.id}] Starting server...`);
    require('./server.js');
}
