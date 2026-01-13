/**
 * JubileeInspire.com - Clustered Server with Zero-Downtime Reload
 *
 * This wrapper provides:
 * - Multi-core clustering (uses all CPU cores)
 * - Zero-downtime reloads via trigger file
 * - Automatic worker restart on crash
 * - Graceful shutdown
 *
 * Usage:
 *   Start: node server-cluster.js
 *   Reload: node reload-service.js
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Configuration
const NUM_WORKERS = 16; // Fixed 16 workers for 16-core processor
const WORKER_SCRIPT = path.join(__dirname, 'server.js');

// Track workers for zero-downtime reload
let isReloading = false;
let workersToReload = [];
let isShuttingDown = false;

if (cluster.isPrimary || cluster.isMaster) {
  // ============== MASTER PROCESS ==============
  console.log(`[Cluster] Master ${process.pid} starting with ${NUM_WORKERS} workers`);
  console.log(`[Cluster] Worker script: ${WORKER_SCRIPT}`);

  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    forkWorker();
  }

  // Handle worker exit - restart if not shutting down
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);

    if (!isReloading && !isShuttingDown) {
      console.log('[Cluster] Restarting worker...');
      setTimeout(forkWorker, 1000);
    }
  });

  // Handle worker online
  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });

  // ============== ZERO-DOWNTIME RELOAD ==============
  process.on('SIGUSR2', () => {
    console.log('[Cluster] Received SIGUSR2 - starting zero-downtime reload');
    reloadWorkers();
  });

  process.on('message', (msg) => {
    if (msg === 'reload') {
      console.log('[Cluster] Received reload message - starting zero-downtime reload');
      reloadWorkers();
    }
  });

  // File-based reload trigger (works on Windows)
  const reloadTriggerFile = path.join(__dirname, '.reload-trigger');

  if (fs.existsSync(reloadTriggerFile)) {
    fs.unlinkSync(reloadTriggerFile);
  }

  fs.watchFile(reloadTriggerFile, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      console.log('[Cluster] Reload trigger file detected - starting zero-downtime reload');
      reloadWorkers();
      try { fs.unlinkSync(reloadTriggerFile); } catch (e) {}
    }
  });

  function reloadWorkers() {
    if (isReloading) {
      console.log('[Cluster] Reload already in progress, ignoring');
      return;
    }

    isReloading = true;
    workersToReload = Object.values(cluster.workers).slice();

    console.log(`[Cluster] Reloading ${workersToReload.length} workers one at a time`);
    reloadNextWorker();
  }

  function reloadNextWorker() {
    if (workersToReload.length === 0) {
      console.log('[Cluster] All workers reloaded successfully');
      isReloading = false;
      return;
    }

    const worker = workersToReload.shift();
    if (!worker) {
      reloadNextWorker();
      return;
    }

    console.log(`[Cluster] Reloading worker ${worker.process.pid}...`);

    const newWorker = forkWorker();

    newWorker.on('listening', () => {
      console.log(`[Cluster] New worker ${newWorker.process.pid} ready, terminating old worker ${worker.process.pid}`);

      worker.disconnect();

      const killTimeout = setTimeout(() => {
        if (!worker.isDead()) {
          console.log(`[Cluster] Force killing worker ${worker.process.pid}`);
          worker.kill('SIGKILL');
        }
      }, 10000);

      worker.on('disconnect', () => {
        clearTimeout(killTimeout);
        setTimeout(reloadNextWorker, 500);
      });
    });
  }

  // ============== GRACEFUL SHUTDOWN ==============
  function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[Cluster] ${signal} received, shutting down gracefully...`);

    const workers = Object.values(cluster.workers);
    let workersAlive = workers.length;

    if (workersAlive === 0) {
      console.log('[Cluster] No workers to shut down');
      process.exit(0);
    }

    workers.forEach((worker) => {
      worker.disconnect();

      worker.on('disconnect', () => {
        workersAlive--;
        console.log(`[Cluster] Worker ${worker.process.pid} disconnected (${workersAlive} remaining)`);
        if (workersAlive === 0) {
          console.log('[Cluster] All workers shut down');
          process.exit(0);
        }
      });
    });

    setTimeout(() => {
      console.log('[Cluster] Force shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  function forkWorker() {
    const worker = cluster.fork();
    return worker;
  }

  // Write master PID to file for reload script
  const pidFile = path.join(__dirname, '.cluster-master.pid');
  fs.writeFileSync(pidFile, process.pid.toString());
  console.log(`[Cluster] Master PID written to ${pidFile}`);

} else {
  // ============== WORKER PROCESS ==============
  console.log(`[Cluster] Worker ${process.pid} starting...`);
  require(WORKER_SCRIPT);
}
