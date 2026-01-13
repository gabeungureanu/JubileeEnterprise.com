/**
 * IDNS Database Sync Script
 *
 * Syncs the idns.yaml file with the Codex PostgreSQL database via InspireCodex API.
 * The database becomes the source of truth, with YAML as a backup/export.
 *
 * IMPORTANT: This script uses the InspireCodex.com API instead of direct database access.
 * All database operations go through https://inspirecodex.com/api/v1/idns/*
 *
 * Usage:
 *   node idns-database-sync.js export    - Export database to YAML via API
 *   node idns-database-sync.js import    - Import YAML to database via API
 *   node idns-database-sync.js status    - Show sync status via API
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION - Uses InspireCodex API instead of direct database access
// ============================================================================
const CONFIG = {
    // InspireCodex API endpoint - the ONLY way to access Codex database
    apiBaseUrl: process.env.INSPIRE_CODEX_API_URL || 'http://localhost:3100',
    apiKey: process.env.INSPIRE_CODEX_API_KEY || '',
    yamlFile: path.join(__dirname, '..', 'idns.yaml')
};

// ============================================================================
// API CLIENT - All database operations go through InspireCodex API
// ============================================================================

/**
 * Make an API request to InspireCodex
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.apiBaseUrl}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (CONFIG.apiKey) {
        headers['X-API-Key'] = CONFIG.apiKey;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to InspireCodex API at ${CONFIG.apiBaseUrl}. Is the service running?`);
        }
        throw error;
    }
}

/**
 * Get all IDNS domains from API
 */
async function getDomainsFromAPI() {
    const result = await apiRequest('/api/v1/idns/domains');
    return result.domains || [];
}

/**
 * Create or update a domain via API
 */
async function upsertDomainViaAPI(domainKey, data) {
    try {
        // Try to update first
        await apiRequest(`/api/v1/idns/domains/${encodeURIComponent(domainKey)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } catch (error) {
        // If not found, create new
        if (error.message.includes('404')) {
            await apiRequest('/api/v1/idns/domains', {
                method: 'POST',
                body: JSON.stringify({ domainKey, ...data })
            });
        } else {
            throw error;
        }
    }
}

/**
 * Trigger sync via API (if supported)
 */
async function triggerAPISync() {
    return await apiRequest('/api/v1/idns/sync', {
        method: 'POST',
        body: JSON.stringify({})
    });
}

/**
 * Get domain types from API
 */
async function getDomainTypes() {
    const result = await apiRequest('/api/v1/idns/types');
    return result.types || [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read YAML configuration file
 */
function readYamlConfig() {
    if (!fs.existsSync(CONFIG.yamlFile)) {
        return { version: '1.0', lastModified: null, idns: {} };
    }
    const content = fs.readFileSync(CONFIG.yamlFile, 'utf8');
    return YAML.parse(content);
}

/**
 * Write YAML configuration file
 */
function writeYamlConfig(config) {
    config.lastModified = new Date().toISOString();

    // Sort idns entries alphabetically
    const sortedIdns = {};
    Object.keys(config.idns)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .forEach(key => {
            sortedIdns[key] = config.idns[key];
        });
    config.idns = sortedIdns;

    fs.writeFileSync(CONFIG.yamlFile, YAML.stringify(config));
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Export database to YAML file via InspireCodex API
 */
async function exportToYaml() {
    console.log('\n=== Export Database to YAML (via InspireCodex API) ===\n');
    console.log(`API Endpoint: ${CONFIG.apiBaseUrl}\n`);

    try {
        const domains = await getDomainsFromAPI();

        const idns = {};
        for (const domain of domains) {
            const data = {};
            if (domain.mres) data.mres = domain.mres;
            if (domain.managed) data.managed = true;
            if (domain.description) data.description = domain.description;
            idns[domain.domain_key || domain.domainKey] = data;
        }

        const config = {
            version: '1.0',
            lastModified: new Date().toISOString(),
            source: 'InspireCodex API',
            idns
        };

        writeYamlConfig(config);

        console.log(`✓ Exported ${domains.length} entries to ${CONFIG.yamlFile}`);
        console.log(`  Source: InspireCodex API (${CONFIG.apiBaseUrl})`);

    } catch (error) {
        console.error('Export failed:', error.message);
        throw error;
    }
}

/**
 * Import YAML to database via InspireCodex API
 */
async function importFromYaml() {
    console.log('\n=== Import YAML to Database (via InspireCodex API) ===\n');
    console.log(`API Endpoint: ${CONFIG.apiBaseUrl}\n`);

    try {
        const yamlConfig = readYamlConfig();
        const idnsEntries = Object.entries(yamlConfig.idns || {});

        console.log(`Found ${idnsEntries.length} entries in YAML\n`);

        let imported = 0;
        let errors = 0;

        for (const [domainKey, data] of idnsEntries) {
            try {
                await upsertDomainViaAPI(domainKey, {
                    mres: data.mres || null,
                    managed: data.managed || false,
                    description: data.description || null
                });
                imported++;
                process.stdout.write('.');
            } catch (err) {
                console.error(`\n  ✗ Error importing ${domainKey}:`, err.message);
                errors++;
            }
        }

        console.log(`\n\n✓ Import complete!`);
        console.log(`  Imported: ${imported}`);
        console.log(`  Errors:   ${errors}`);
        console.log(`  Via:      InspireCodex API`);

    } catch (error) {
        console.error('Import failed:', error.message);
        throw error;
    }
}

/**
 * Show sync status via InspireCodex API
 */
async function showStatus() {
    console.log('\n=== IDNS Sync Status (via InspireCodex API) ===\n');
    console.log(`API Endpoint: ${CONFIG.apiBaseUrl}\n`);

    try {
        // Check API health
        console.log('Checking InspireCodex API...');
        const healthResponse = await fetch(`${CONFIG.apiBaseUrl}/health`);
        const health = await healthResponse.json();

        console.log(`API Status: ${health.status === 'ok' ? '✓ Online' : '✗ ' + health.status}`);
        console.log(`Codex DB:   ${health.databases?.codex || 'unknown'}`);

        // Get domain stats via API
        try {
            const domains = await getDomainsFromAPI();
            console.log(`\nTotal IDNS entries (API): ${domains.length}`);

            // Count by type
            const typeCount = {};
            domains.forEach(d => {
                const type = d.domain_type || d.domainType || 'unknown';
                typeCount[type] = (typeCount[type] || 0) + 1;
            });

            console.log('\nBy type:');
            Object.entries(typeCount)
                .sort((a, b) => b[1] - a[1])
                .forEach(([type, count]) => {
                    console.log(`  ${type}: ${count}`);
                });
        } catch (err) {
            console.log('\nCould not fetch domain stats:', err.message);
        }

        // Check YAML file
        const yamlExists = fs.existsSync(CONFIG.yamlFile);
        console.log(`\nYAML file: ${yamlExists ? '✓ Exists' : '✗ Not found'}`);

        if (yamlExists) {
            const yamlConfig = readYamlConfig();
            const yamlCount = Object.keys(yamlConfig.idns || {}).length;
            console.log(`YAML entries: ${yamlCount}`);
            console.log(`Last modified: ${yamlConfig.lastModified || 'Never'}`);
            if (yamlConfig.source) {
                console.log(`Source: ${yamlConfig.source}`);
            }
        }

    } catch (error) {
        console.error('Status check failed:', error.message);
        console.log('\nMake sure InspireCodex API is running on port 3100');
        throw error;
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const command = process.argv[2];

    console.log('');
    console.log('='.repeat(60));
    console.log('  IDNS Database Sync Tool');
    console.log('  Using InspireCodex API (NO DIRECT DATABASE ACCESS)');
    console.log('='.repeat(60));

    try {
        switch (command) {
            case 'export':
                await exportToYaml();
                break;
            case 'import':
                await importFromYaml();
                break;
            case 'status':
                await showStatus();
                break;
            case 'migrate':
                console.log('\n⚠️  Migration is no longer needed.');
                console.log('   Database schema is managed by InspireCodex API.');
                console.log('   Use "import" to push YAML data to the database via API.');
                break;
            default:
                console.log(`
IDNS Database Sync Tool (API Version)

This tool syncs IDNS data through the InspireCodex API.
NO DIRECT DATABASE ACCESS - all operations go through the API.

Usage:
  node idns-database-sync.js <command>

Commands:
  export    Export database to YAML file (via API)
  import    Import YAML to database (via API)
  status    Show sync status (via API)

Environment Variables:
  INSPIRE_CODEX_API_URL   API base URL (default: http://localhost:3100)
  INSPIRE_CODEX_API_KEY   Optional API key for authentication
                `);
        }
    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
