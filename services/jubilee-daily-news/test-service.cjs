/**
 * JubileeDailyNews Test Runner
 *
 * Tests the service functionality without installing as a Windows Service.
 * Useful for development and debugging.
 *
 * Usage: node test-service.cjs
 */

'use strict';

const path = require('path');

// Load the service module
const service = require('./jubilee-daily-news.cjs');

console.log('');
console.log('========================================');
console.log('JubileeDailyNews Test Mode');
console.log('========================================');
console.log('');
console.log('Running a single fetch cycle...');
console.log('Press Ctrl+C to stop');
console.log('');

// Run a single fetch cycle for testing
service.fetchAndCacheNews()
    .then(() => {
        console.log('');
        console.log('Test complete!');
        console.log('');
        console.log('To run continuously, use: node jubilee-daily-news.cjs');
        console.log('To install as service, use: node install-service.cjs (as Administrator)');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed:', error.message);
        process.exit(1);
    });
