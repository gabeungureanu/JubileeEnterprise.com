// Add impossibleharvest.com hostname to Cloudflare Tunnel
// Run in browser console at https://one.dash.cloudflare.com
// Or run with Node.js: node cloudflare-add-impossibleharvest-tunnel.js YOUR_API_TOKEN

(async function() {
    const ACCOUNT_ID = 'b4a6c8642ee9ebf163a7d480c0cdda0c';
    const TUNNEL_ID = 'c4c875e2-55a9-4ad7-a0e9-36c391229c0b';

    // Get API token - prompt if in browser, use arg if Node.js
    let apiToken;
    if (typeof window !== 'undefined') {
        apiToken = prompt('Enter your Cloudflare API Token:');
    } else {
        apiToken = process.argv[2];
        if (!apiToken) {
            console.error('Usage: node cloudflare-add-impossibleharvest-tunnel.js YOUR_API_TOKEN');
            process.exit(1);
        }
    }

    if (!apiToken) {
        console.error('No API token provided');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
    };

    const fetchFn = typeof window !== 'undefined' ? window.fetch : require('node-fetch');

    console.log('=== Adding ImpossibleHarvest.com to Cloudflare Tunnel ===\n');

    // Step 1: Get current tunnel configuration
    console.log('[1/2] Getting current tunnel configuration...');

    const configUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations`;

    const configResponse = await fetchFn(configUrl, { headers });
    const configData = await configResponse.json();

    if (!configData.success) {
        console.error('Failed to get tunnel config:', configData.errors);
        return;
    }

    const currentConfig = configData.result.config;
    console.log(`   Current ingress rules: ${currentConfig.ingress.length}`);

    // Step 2: Check if impossibleharvest.com is already configured
    const hasImpossibleHarvest = currentConfig.ingress.some(r => r.hostname === 'impossibleharvest.com');
    const hasWww = currentConfig.ingress.some(r => r.hostname === 'www.impossibleharvest.com');

    if (hasImpossibleHarvest && hasWww) {
        console.log('   impossibleharvest.com is already configured!');
        return;
    }

    // Step 3: Add impossibleharvest.com to ingress rules (before the catch-all)
    console.log('\n[2/2] Adding ImpossibleHarvest.com hostnames...');

    // Find where to insert (before catch-all which has no hostname)
    const catchAllIndex = currentConfig.ingress.findIndex(r => !r.hostname);

    const newRules = [];

    if (!hasImpossibleHarvest) {
        newRules.push({
            hostname: 'impossibleharvest.com',
            service: 'http://localhost:3139',
            originRequest: {}
        });
    }

    if (!hasWww) {
        newRules.push({
            hostname: 'www.impossibleharvest.com',
            service: 'http://localhost:3139',
            originRequest: {}
        });
    }

    // Insert before catch-all
    if (catchAllIndex >= 0) {
        currentConfig.ingress.splice(catchAllIndex, 0, ...newRules);
    } else {
        // No catch-all, just append
        currentConfig.ingress.push(...newRules);
    }

    // Step 4: Update tunnel configuration
    const updateResponse = await fetchFn(configUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ config: currentConfig })
    });

    const updateData = await updateResponse.json();

    if (updateData.success) {
        console.log('   SUCCESS! ImpossibleHarvest.com added to tunnel');
        console.log('\n=== Configuration Updated ===');
        console.log('The tunnel will automatically reload the new config.');
        console.log('\nTest with: curl https://impossibleharvest.com/health');
    } else {
        console.error('   FAILED:', updateData.errors);
    }
})();
