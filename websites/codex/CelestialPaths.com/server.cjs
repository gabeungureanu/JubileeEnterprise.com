/**
 * CelestialPaths.com Production Server Launcher
 *
 * Starts the Next.js frontend on the configured port.
 * Run with: node server.js
 * Default port: 3300 (or process.env.PORT)
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3300;
const FRONTEND_DIR = path.join(__dirname, 'website', 'frontend');

console.log('');
console.log('='.repeat(50));
console.log('  CelestialPaths.com Server Launcher');
console.log('='.repeat(50));
console.log(`  Starting Next.js frontend on port ${PORT}...`);
console.log(`  Directory: ${FRONTEND_DIR}`);
console.log('='.repeat(50));
console.log('');

// Start Next.js in production mode
const nextProcess = spawn('npx', ['next', 'start', '-p', PORT.toString()], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        PORT: PORT.toString(),
        NODE_ENV: 'production'
    }
});

nextProcess.on('error', (error) => {
    console.error('Failed to start Next.js server:', error.message);
    process.exit(1);
});

nextProcess.on('close', (code) => {
    console.log(`Next.js server exited with code ${code}`);
    process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down CelestialPaths server...');
    nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    nextProcess.kill('SIGTERM');
});
