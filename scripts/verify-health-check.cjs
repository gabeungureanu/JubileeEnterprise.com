/**
 * Verify health check accuracy by comparing API response with actual HTTP requests
 */

const http = require('http');

// Fetch the health check API response
function fetchHealthAPI() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3100/api/v1/services/check/websites', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Perform an actual HTTP request to verify
function checkPort(port) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const req = http.get(`http://localhost:${port}/`, { timeout: 5000 }, (res) => {
            resolve({
                success: true,
                status: res.statusCode,
                ok: res.statusCode >= 200 && res.statusCode < 400,
                responseTime: Date.now() - startTime
            });
        });
        req.on('error', (err) => {
            resolve({
                success: false,
                status: 0,
                ok: false,
                error: err.code || err.message,
                responseTime: Date.now() - startTime
            });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                status: 0,
                ok: false,
                error: 'TIMEOUT',
                responseTime: Date.now() - startTime
            });
        });
    });
}

async function main() {
    console.log('=== HEALTH CHECK VERIFICATION ===');
    console.log('Fetching health check API response...\n');

    try {
        const apiResponse = await fetchHealthAPI();

        console.log('API Summary:', JSON.stringify(apiResponse.summary));
        console.log('Timestamp:', apiResponse.timestamp);
        console.log('');

        // Verify each service
        let discrepancies = 0;
        let verified = 0;
        const results = [];

        console.log('Verifying each service with independent HTTP check...\n');

        for (const service of apiResponse.services) {
            if (service.configStatus === 'disabled') {
                continue;
            }

            const verify = await checkPort(service.port);
            const match = service.httpOk === verify.ok;

            if (!match) {
                discrepancies++;
                console.log(`[DISCREPANCY] ${service.name} (port ${service.port})`);
                console.log(`  API says: httpOk=${service.httpOk}, status=${service.httpStatus}, error=${service.error}`);
                console.log(`  Verify:   ok=${verify.ok}, status=${verify.status}, error=${verify.error}`);
                console.log('');
            } else {
                verified++;
            }

            results.push({
                name: service.name,
                port: service.port,
                apiOk: service.httpOk,
                verifyOk: verify.ok,
                match,
                apiStatus: service.httpStatus,
                verifyStatus: verify.status,
                apiError: service.error,
                verifyError: verify.error
            });
        }

        console.log('=== SUMMARY ===');
        console.log(`Total services: ${results.length}`);
        console.log(`Verified matches: ${verified}`);
        console.log(`Discrepancies: ${discrepancies}`);
        console.log('');

        // Show all failing services (both API and verify)
        const failing = results.filter(r => !r.verifyOk);
        if (failing.length > 0) {
            console.log('=== SERVICES THAT ARE ACTUALLY DOWN ===');
            for (const r of failing) {
                console.log(`  ${r.name} (port ${r.port}): ${r.verifyError || `status ${r.verifyStatus}`}`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
