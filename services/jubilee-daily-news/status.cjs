/**
 * JubileeDailyNews Status Checker
 *
 * Checks the status of the JubileeDailyNews service by
 * querying its health endpoint.
 *
 * Usage: node status.cjs
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const healthUrl = `http://localhost:${config.healthPort}/health`;

console.log('');
console.log('========================================');
console.log(`${config.name} Service Status`);
console.log('========================================');
console.log('');
console.log(`Checking health endpoint: ${healthUrl}`);
console.log('');

const request = http.get(healthUrl, (response) => {
    let data = '';

    response.on('data', (chunk) => {
        data += chunk;
    });

    response.on('end', () => {
        try {
            const status = JSON.parse(data);

            console.log('Service Status: RUNNING');
            console.log('');
            console.log('Details:');
            console.log(`  Version: ${status.version}`);
            console.log(`  Uptime: ${Math.round(status.uptime)} seconds`);
            console.log(`  Last Fetch: ${status.lastFetch || 'Never'}`);
            console.log(`  Last Status: ${status.lastStatus || 'N/A'}`);
            console.log(`  Total Fetches: ${status.totalFetches}`);
            console.log(`  Total Stories Cached: ${status.totalStoriesCached}`);
            console.log(`  Next Fetch In: ${status.nextFetchIn}`);

            if (status.currentStories && status.currentStories.length > 0) {
                console.log('');
                console.log('Current Top Stories:');
                status.currentStories.forEach((story, index) => {
                    console.log(`  ${index + 1}. [${story.source}] ${story.title.substring(0, 50)}...`);
                    console.log(`     Score: ${story.score} | Cluster: ${story.cluster}`);
                });
            }

            if (status.errors && status.errors.length > 0) {
                console.log('');
                console.log('Recent Errors:');
                status.errors.forEach((error) => {
                    console.log(`  - [${error.time}] ${error.type}: ${error.message}`);
                });
            }

            console.log('');

        } catch (error) {
            console.log('Error parsing response:', error.message);
            console.log('Raw response:', data);
        }
    });
});

request.on('error', (error) => {
    console.log('Service Status: NOT RUNNING');
    console.log('');
    console.log(`Error: ${error.message}`);
    console.log('');
    console.log('The service may not be running or the health port is not accessible.');
    console.log('');
    console.log('To start the service:');
    console.log('  1. Run as Administrator: node install-service.cjs');
    console.log('  2. Or run directly: node jubilee-daily-news.cjs');
});

request.setTimeout(5000, () => {
    request.destroy();
    console.log('Service Status: TIMEOUT');
    console.log('');
    console.log('The health endpoint did not respond within 5 seconds.');
});
