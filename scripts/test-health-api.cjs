/**
 * Test the updated health check API that uses production URLs
 */

const http = require('http');

http.get('http://localhost:3100/api/v1/services/check/websites', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(data);

            console.log('=== PRODUCTION URL HEALTH CHECK ===');
            console.log('Timestamp:', response.timestamp);
            console.log('Summary:', JSON.stringify(response.summary));
            console.log('');

            console.log('ONLINE services (' + response.summary.online + '):');
            response.services
                .filter(s => s.httpOk === true)
                .forEach(s => console.log(`  [OK] ${s.name} - ${s.publicUrl} (${s.responseTime}ms)`));

            console.log('');
            console.log('OFFLINE services (' + response.summary.offline + '):');
            response.services
                .filter(s => s.httpOk === false && s.configStatus !== 'disabled')
                .forEach(s => console.log(`  [FAIL] ${s.name} - ${s.publicUrl} - ${s.error || 'HTTP ' + s.httpStatus}`));

        } catch (e) {
            console.error('Parse error:', e.message);
            console.error('Raw response:', data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});
