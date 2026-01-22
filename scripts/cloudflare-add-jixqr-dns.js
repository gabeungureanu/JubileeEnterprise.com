// Cloudflare DNS Configuration for jixqr.com
// Run this in your browser console while on the Cloudflare dashboard
// 1. Go to https://dash.cloudflare.com
// 2. Open browser DevTools (F12) -> Console tab
// 3. Paste this entire script and press Enter

(async function() {
    const TUNNEL_ID = 'c4c875e2-55a9-4ad7-a0e9-36c391229c0b';
    const DOMAIN = 'jixqr.com';
    const TUNNEL_CNAME = `${TUNNEL_ID}.cfargotunnel.com`;

    console.log('=== Cloudflare DNS Configuration for jixqr.com ===');

    // Get API token from the page (works when logged into dashboard)
    const getApiToken = () => {
        // Try to get token from localStorage or session
        const token = localStorage.getItem('cf-api-token');
        if (token) return token;

        // Prompt user for token
        return prompt('Enter your Cloudflare API Token (from Profile > API Tokens):');
    };

    const apiToken = getApiToken();
    if (!apiToken) {
        console.error('No API token provided. Aborting.');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
    };

    // Step 1: Get Zone ID
    console.log(`\n[1/4] Getting Zone ID for ${DOMAIN}...`);
    try {
        const zoneResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`,
            { headers }
        );
        const zoneData = await zoneResponse.json();

        if (!zoneData.success || zoneData.result.length === 0) {
            console.error(`Zone not found for ${DOMAIN}. Make sure the domain is in your Cloudflare account.`);
            console.error('Errors:', zoneData.errors);
            return;
        }

        const zoneId = zoneData.result[0].id;
        console.log(`   Zone ID: ${zoneId}`);

        // Step 2: Get existing DNS records
        console.log(`\n[2/4] Checking existing DNS records...`);
        const dnsResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
            { headers }
        );
        const dnsData = await dnsResponse.json();

        const existingRecords = dnsData.result.filter(r =>
            (r.name === DOMAIN || r.name === `www.${DOMAIN}`) &&
            (r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME')
        );

        console.log(`   Found ${existingRecords.length} existing records to update/replace`);

        // Step 3: Delete existing A/AAAA records (CNAME can't coexist with A records)
        console.log(`\n[3/4] Removing conflicting A/AAAA records...`);
        for (const record of existingRecords) {
            if (record.type === 'A' || record.type === 'AAAA') {
                console.log(`   Deleting ${record.type} record for ${record.name}: ${record.content}`);
                await fetch(
                    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`,
                    { method: 'DELETE', headers }
                );
            }
        }

        // Step 4: Create/Update CNAME records
        console.log(`\n[4/4] Creating CNAME records pointing to tunnel...`);

        // Root domain CNAME
        const rootCname = existingRecords.find(r => r.name === DOMAIN && r.type === 'CNAME');
        if (rootCname) {
            console.log(`   Updating root CNAME...`);
            const updateResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${rootCname.id}`,
                {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        type: 'CNAME',
                        name: '@',
                        content: TUNNEL_CNAME,
                        proxied: true
                    })
                }
            );
            const updateData = await updateResponse.json();
            console.log(`   Root CNAME: ${updateData.success ? 'SUCCESS' : 'FAILED'}`);
        } else {
            console.log(`   Creating root CNAME...`);
            const createResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'CNAME',
                        name: '@',
                        content: TUNNEL_CNAME,
                        proxied: true
                    })
                }
            );
            const createData = await createResponse.json();
            console.log(`   Root CNAME: ${createData.success ? 'SUCCESS' : 'FAILED'}`);
            if (!createData.success) console.error('   Errors:', createData.errors);
        }

        // www CNAME
        const wwwCname = existingRecords.find(r => r.name === `www.${DOMAIN}` && r.type === 'CNAME');
        if (wwwCname) {
            console.log(`   Updating www CNAME...`);
            const updateResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${wwwCname.id}`,
                {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        type: 'CNAME',
                        name: 'www',
                        content: TUNNEL_CNAME,
                        proxied: true
                    })
                }
            );
            const updateData = await updateResponse.json();
            console.log(`   www CNAME: ${updateData.success ? 'SUCCESS' : 'FAILED'}`);
        } else {
            console.log(`   Creating www CNAME...`);
            const createResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'CNAME',
                        name: 'www',
                        content: TUNNEL_CNAME,
                        proxied: true
                    })
                }
            );
            const createData = await createResponse.json();
            console.log(`   www CNAME: ${createData.success ? 'SUCCESS' : 'FAILED'}`);
            if (!createData.success) console.error('   Errors:', createData.errors);
        }

        console.log('\n=== Configuration Complete ===');
        console.log(`DNS records now point to tunnel: ${TUNNEL_ID}`);
        console.log('Changes may take 1-2 minutes to propagate.');
        console.log('\nTest with: curl https://jixqr.com/health');

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
