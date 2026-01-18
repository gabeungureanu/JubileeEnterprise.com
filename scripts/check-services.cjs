const http = require('http');
const config = require('../services/Inspire.8.0/websites-services.json');

http.get('http://localhost:3900/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const health = JSON.parse(data);
        const running = health.services.map(s => s.name);
        const configured = config.services.map(s => s.name);
        const missing = configured.filter(n => !running.includes(n));

        console.log('=== SERVICE STATUS ===');
        console.log('Configured:', configured.length);
        console.log('Running:', running.length);

        if (missing.length > 0) {
            console.log('\nMissing services:', missing.join(', '));
        } else {
            console.log('\nAll services running!');
        }
    });
}).on('error', err => console.error('Error:', err.message));
