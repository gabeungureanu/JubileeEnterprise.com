/**
 * IDNS Database Sync Script
 *
 * Syncs the idns.yaml file with the Codex PostgreSQL database.
 * The database becomes the source of truth, with YAML as a backup/export.
 *
 * Usage:
 *   node idns-database-sync.js migrate   - Create table and import YAML to database
 *   node idns-database-sync.js export    - Export database to YAML
 *   node idns-database-sync.js import    - Import YAML to database (overwrites)
 *   node idns-database-sync.js status    - Show sync status
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'Codex',
        user: process.env.DB_USER || 'guardian',
        password: process.env.DB_PASSWORD || 'askShaddai4e!'
    },
    yamlFile: path.join(__dirname, '..', 'idns.yaml')
};

// Database pool
const pool = new Pool(CONFIG.database);

// =============================================================================
// DATABASE SCHEMA
// =============================================================================

const CREATE_TABLE_SQL = `
-- IDNS Domains table for Inspire Domain Name System
CREATE TABLE IF NOT EXISTS idns_domains (
    id SERIAL PRIMARY KEY,

    -- Domain identifier (e.g., 'apostle', 'baptist', 'webspace/jubileeverse')
    domain_key VARCHAR(255) NOT NULL UNIQUE,

    -- Domain type: 'denomination', 'country', 'ministry', 'webspace', 'topic'
    domain_type VARCHAR(50) DEFAULT 'denomination',

    -- Display name (human-readable)
    display_name VARCHAR(255),

    -- Description of the domain
    description TEXT,

    -- Masked Resolution URL (for webspaces)
    mres VARCHAR(500),

    -- Is this domain managed by Jubilee?
    managed BOOLEAN DEFAULT false,

    -- Is this domain active?
    is_active BOOLEAN DEFAULT true,

    -- Parent domain key (for hierarchical domains like webspace/*)
    parent_domain VARCHAR(255),

    -- Sort order for display
    sort_order INTEGER DEFAULT 0,

    -- Metadata JSON for additional properties
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_idns_domains_type ON idns_domains(domain_type);
CREATE INDEX IF NOT EXISTS idx_idns_domains_parent ON idns_domains(parent_domain);
CREATE INDEX IF NOT EXISTS idx_idns_domains_managed ON idns_domains(managed);
CREATE INDEX IF NOT EXISTS idx_idns_domains_active ON idns_domains(is_active);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_idns_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_idns_domains_updated_at ON idns_domains;
CREATE TRIGGER trigger_idns_domains_updated_at
    BEFORE UPDATE ON idns_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_idns_domains_updated_at();
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine domain type based on the domain key
 */
function inferDomainType(domainKey) {
    // Countries (by common patterns)
    const countries = [
        'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia',
        'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
        'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'botswana', 'brazil',
        'brunei', 'bulgaria', 'cambodia', 'cameroon', 'canada', 'chad', 'chile', 'china',
        'colombia', 'comoros', 'croatia', 'cuba', 'cyprus', 'denmark', 'djibouti', 'dominica',
        'ecuador', 'egypt', 'eritrea', 'estonia', 'ethiopia', 'fiji', 'finland', 'france',
        'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada', 'guatemala',
        'guinea', 'guyana', 'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia',
        'iran', 'iraq', 'ireland', 'israel', 'italy', 'jamaica', 'japan', 'jordan',
        'kazakhstan', 'kenya', 'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos', 'latvia',
        'lebanon', 'lesotho', 'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg',
        'madagascar', 'malawi', 'malaysia', 'maldives', 'mali', 'malta', 'mauritania',
        'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro',
        'morocco', 'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal', 'netherlands',
        'newzealand', 'nicaragua', 'nigeria', 'norway', 'oman', 'pakistan', 'palau',
        'palestine', 'panama', 'paraguay', 'peru', 'philippines', 'poland', 'portugal',
        'qatar', 'romania', 'russia', 'rwanda', 'samoa', 'senegal', 'serbia', 'seychelles',
        'singapore', 'slovakia', 'slovenia', 'somalia', 'spain', 'sudan', 'suriname',
        'sweden', 'switzerland', 'taiwan', 'tajikistan', 'tanzania', 'thailand', 'togo',
        'tonga', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu', 'uganda', 'ukraine',
        'uruguay', 'uzbekistan', 'vanuatu', 'venezuela', 'vietnam', 'yemen', 'zambia',
        'zimbabwe', 'unitedstates', 'unitedkingdom', 'unitedarabemirates', 'southafrica',
        'southkorea', 'northkorea', 'saudiarabia', 'srilanka', 'papuanewguinea', 'hongkong',
        'northmacedonia', 'bosniaandherzegovina', 'centralafricanrepublic', 'congodemocraticrepublic',
        'congorepublic', 'cookislands', 'czechrepublic', 'dominicanrepublic', 'easttimor',
        'elsalvador', 'equatorialguinea', 'eswatini', 'guineabissau', 'ivorycoast',
        'burkinafaso', 'burundi', 'capeverde', 'marshallislands', 'sanmarino',
        'saotomeandprincipe', 'sierraleone', 'solomonislands', 'southsudan',
        'trinidadandtobago', 'vaticancity', 'antiguaandbarbuda', 'saintkittsandnevis',
        'saintlucia', 'saintvincentandthegrenadines'
    ];

    // Ministry/Topic types
    const ministryTopics = [
        'academy', 'bible', 'biblical', 'charity', 'children', 'church', 'coaching',
        'community', 'conference', 'discipleship', 'events', 'family', 'fellowship',
        'group', 'healing', 'inspire', 'kids', 'library', 'marriage', 'men', 'ministry',
        'mission', 'music', 'news', 'pastor', 'podcast', 'praise', 'prayer', 'prophet',
        'recovery', 'retreat', 'school', 'scriptural', 'sermon', 'serve', 'shepherd',
        'teacher', 'testimony', 'women', 'worship', 'youth', 'apostle', 'evangelist'
    ];

    const lowerKey = domainKey.toLowerCase();

    if (domainKey.includes('/')) {
        return 'webspace';
    }
    if (countries.includes(lowerKey)) {
        return 'country';
    }
    if (ministryTopics.includes(lowerKey)) {
        return 'ministry';
    }
    return 'denomination';
}

/**
 * Generate display name from domain key
 */
function generateDisplayName(domainKey) {
    if (domainKey.includes('/')) {
        const parts = domainKey.split('/');
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');
    }

    // Split camelCase and add spaces
    const spaced = domainKey.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Capitalize first letter of each word
    return spaced.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

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

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Create the database table and import existing YAML data
 */
async function migrate() {
    console.log('\n=== IDNS Database Migration ===\n');

    try {
        // Create the table
        console.log('Creating idns_domains table...');
        await pool.query(CREATE_TABLE_SQL);
        console.log('✓ Table created successfully\n');

        // Read existing YAML
        const yamlConfig = readYamlConfig();
        const idnsEntries = Object.entries(yamlConfig.idns || {});

        console.log(`Found ${idnsEntries.length} IDNS entries in YAML\n`);

        if (idnsEntries.length === 0) {
            console.log('No entries to import.');
            return;
        }

        // Import entries
        let imported = 0;
        let skipped = 0;

        for (const [domainKey, data] of idnsEntries) {
            const domainType = inferDomainType(domainKey);
            const displayName = generateDisplayName(domainKey);
            const parentDomain = domainKey.includes('/') ? domainKey.split('/')[0] : null;

            try {
                await pool.query(`
                    INSERT INTO idns_domains (domain_key, domain_type, display_name, mres, managed, parent_domain, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (domain_key) DO UPDATE SET
                        domain_type = EXCLUDED.domain_type,
                        display_name = EXCLUDED.display_name,
                        mres = EXCLUDED.mres,
                        managed = EXCLUDED.managed,
                        parent_domain = EXCLUDED.parent_domain,
                        metadata = EXCLUDED.metadata
                `, [
                    domainKey,
                    domainType,
                    displayName,
                    data.mres || null,
                    data.managed || false,
                    parentDomain,
                    JSON.stringify(data)
                ]);
                imported++;
            } catch (err) {
                console.error(`  ✗ Error importing ${domainKey}:`, err.message);
                skipped++;
            }
        }

        console.log(`\n✓ Migration complete!`);
        console.log(`  Imported: ${imported}`);
        console.log(`  Skipped:  ${skipped}`);

    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    }
}

/**
 * Export database to YAML file
 */
async function exportToYaml() {
    console.log('\n=== Export Database to YAML ===\n');

    try {
        const result = await pool.query(`
            SELECT domain_key, mres, managed, metadata
            FROM idns_domains
            WHERE is_active = true
            ORDER BY domain_key
        `);

        const idns = {};
        for (const row of result.rows) {
            const data = {};
            if (row.mres) data.mres = row.mres;
            if (row.managed) data.managed = true;
            // Add any extra metadata fields
            if (row.metadata && typeof row.metadata === 'object') {
                Object.keys(row.metadata).forEach(key => {
                    if (key !== 'mres' && key !== 'managed') {
                        data[key] = row.metadata[key];
                    }
                });
            }
            idns[row.domain_key] = data;
        }

        const config = {
            version: '1.0',
            lastModified: new Date().toISOString(),
            idns
        };

        writeYamlConfig(config);

        console.log(`✓ Exported ${result.rows.length} entries to ${CONFIG.yamlFile}`);

    } catch (error) {
        console.error('Export failed:', error.message);
        throw error;
    }
}

/**
 * Import YAML to database (overwrites existing)
 */
async function importFromYaml() {
    console.log('\n=== Import YAML to Database ===\n');

    try {
        const yamlConfig = readYamlConfig();
        const idnsEntries = Object.entries(yamlConfig.idns || {});

        console.log(`Found ${idnsEntries.length} entries in YAML\n`);

        // Clear existing entries
        await pool.query('DELETE FROM idns_domains');
        console.log('✓ Cleared existing entries\n');

        let imported = 0;
        for (const [domainKey, data] of idnsEntries) {
            const domainType = inferDomainType(domainKey);
            const displayName = generateDisplayName(domainKey);
            const parentDomain = domainKey.includes('/') ? domainKey.split('/')[0] : null;

            await pool.query(`
                INSERT INTO idns_domains (domain_key, domain_type, display_name, mres, managed, parent_domain, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                domainKey,
                domainType,
                displayName,
                data.mres || null,
                data.managed || false,
                parentDomain,
                JSON.stringify(data)
            ]);
            imported++;
        }

        console.log(`✓ Imported ${imported} entries to database`);

    } catch (error) {
        console.error('Import failed:', error.message);
        throw error;
    }
}

/**
 * Show sync status
 */
async function showStatus() {
    console.log('\n=== IDNS Sync Status ===\n');

    try {
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'idns_domains'
            )
        `);

        const tableExists = tableCheck.rows[0].exists;
        console.log(`Database table: ${tableExists ? '✓ Exists' : '✗ Not found'}`);

        if (tableExists) {
            const countResult = await pool.query('SELECT COUNT(*) FROM idns_domains');
            const typeBreakdown = await pool.query(`
                SELECT domain_type, COUNT(*) as count
                FROM idns_domains
                GROUP BY domain_type
                ORDER BY count DESC
            `);

            console.log(`Total entries: ${countResult.rows[0].count}`);
            console.log('\nBy type:');
            typeBreakdown.rows.forEach(row => {
                console.log(`  ${row.domain_type}: ${row.count}`);
            });
        }

        // Check YAML file
        const yamlExists = fs.existsSync(CONFIG.yamlFile);
        console.log(`\nYAML file: ${yamlExists ? '✓ Exists' : '✗ Not found'}`);

        if (yamlExists) {
            const yamlConfig = readYamlConfig();
            const yamlCount = Object.keys(yamlConfig.idns || {}).length;
            console.log(`YAML entries: ${yamlCount}`);
            console.log(`Last modified: ${yamlConfig.lastModified || 'Never'}`);
        }

    } catch (error) {
        console.error('Status check failed:', error.message);
        throw error;
    }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    const command = process.argv[2];

    try {
        switch (command) {
            case 'migrate':
                await migrate();
                break;
            case 'export':
                await exportToYaml();
                break;
            case 'import':
                await importFromYaml();
                break;
            case 'status':
                await showStatus();
                break;
            default:
                console.log(`
IDNS Database Sync Tool

Usage:
  node idns-database-sync.js <command>

Commands:
  migrate   Create table and import YAML to database
  export    Export database to YAML file
  import    Import YAML to database (clears existing)
  status    Show sync status
                `);
        }
    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
