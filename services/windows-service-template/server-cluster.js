/**
 * Node.js Clustered Server with Zero-Downtime Reload
 *
 * TEMPLATE FILE - Copy to your application and modify as needed.
 *
 * This wrapper provides:
 * - Multi-core clustering (uses all CPU cores)
 * - Zero-downtime reloads via trigger file
 * - Automatic worker restart on crash
 * - Graceful shutdown
 *
 * Configuration:
 *   - Set WORKER_SCRIPT to your main server file
 *   - Set NUM_WORKERS or use CLUSTER_WORKERS env var
 *
 * Usage:
 *   Start: node server-cluster.js
 *   Reload: node reload-service.js
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ============== CONFIGURATION ==============
// Modify these for your application
const NUM_WORKERS = process.env.CLUSTER_WORKERS || os.cpus().length;
const WORKER_SCRIPT = path.join(__dirname, 'server.js');  // <-- Change to your server file
// ===========================================

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
      setTimeout(forkWorker, 1000); // Delay restart to prevent rapid cycling
    }
  });

  // Handle worker online
  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });

  // ============== ZERO-DOWNTIME RELOAD ==============
  // Listen for reload signal (SIGUSR2) - Unix systems
  process.on('SIGUSR2', () => {
    console.log('[Cluster] Received SIGUSR2 - starting zero-downtime reload');
    reloadWorkers();
  });

  // Listen for custom message to trigger reload
  process.on('message', (msg) => {
    if (msg === 'reload') {
      console.log('[Cluster] Received reload message - starting zero-downtime reload');
      reloadWorkers();
    }
  });

  // File-based reload trigger (works on Windows)
  const reloadTriggerFile = path.join(__dirname, '.reload-trigger');

  // Clean up old trigger file
  if (fs.existsSync(reloadTriggerFile)) {
    fs.unlinkSync(reloadTriggerFile);
  }

  // Watch for reload trigger file
  fs.watchFile(reloadTriggerFile, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      console.log('[Cluster] Reload trigger file detected - starting zero-downtime reload');
      reloadWorkers();
      // Remove the trigger file
      try { fs.unlinkSync(reloadTriggerFile); } catch (e) {}
    }
  });

  /**
   * Zero-downtime reload - restart workers one at a time
   */
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

    // Fork new worker first
    const newWorker = forkWorker();

    // Wait for new worker to be ready before killing old one
    newWorker.on('listening', () => {
      console.log(`[Cluster] New worker ${newWorker.process.pid} ready, terminating old worker ${worker.process.pid}`);

      // Gracefully disconnect old worker
      worker.disconnect();

      // Force kill after timeout if not disconnected
      const killTimeout = setTimeout(() => {
        if (!worker.isDead()) {
          console.log(`[Cluster] Force killing worker ${worker.process.pid}`);
          worker.kill('SIGKILL');
        }
      }, 10000);

      worker.on('disconnect', () => {
        clearTimeout(killTimeout);
        // Continue to next worker after a short delay
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

    // Force exit after 30 seconds
    setTimeout(() => {
      console.log('[Cluster] Force shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  /**
   * Fork a new worker
   */
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
  // Workers run the actual server
  console.log(`[Cluster] Worker ${process.pid} starting...`);
  require(WORKER_SCRIPT);
}
