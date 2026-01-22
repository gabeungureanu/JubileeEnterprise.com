/**
 * JubileeChat Direct Data Import Script
 * Imports CSV data directly into PostgreSQL with auto-created tables
 * Tables are prefixed with 'jc_' to avoid conflicts
 *
 * Usage: node import-jubileechat-direct.cjs <csv-directory>
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');

// PostgreSQL connection
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'codex',
    user: 'guardian',
    password: 'askShaddai4'
});

// Convert column name to PostgreSQL-friendly format
function toSnakeCase(name) {
    return name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/__+/g, '_')
        .replace(/[^a-z0-9_]/g, '_');
}

// Convert MSSQL table name to PostgreSQL table name
function toTableName(mssqlName) {
    // Prefix with jc_ (JubileeChat) to avoid conflicts
    return 'jc_' + toSnakeCase(mssqlName);
}

// Detect column type from values
function detectColumnType(values) {
    let isInt = true;
    let isFloat = true;
    let isBool = true;
    let isDate = true;
    let maxLen = 0;

    for (const val of values) {
        if (val === '' || val === null || val === undefined) continue;

        const str = String(val);
        maxLen = Math.max(maxLen, str.length);

        // Check integer
        if (isInt && !/^-?\d+$/.test(str)) {
            isInt = false;
        }

        // Check float
        if (isFloat && !/^-?\d+\.?\d*$/.test(str)) {
            isFloat = false;
        }

        // Check boolean
        if (isBool && !['True', 'False', '0', '1', 'true', 'false'].includes(str)) {
            isBool = false;
        }

        // Check date - simple pattern
        if (isDate && !str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) && !str.match(/^\d{4}-\d{2}-\d{2}/)) {
            isDate = false;
        }
    }

    if (isBool && values.filter(v => v !== '' && v !== null).length > 0) return 'BOOLEAN';
    if (isInt && values.filter(v => v !== '' && v !== null).length > 0) return 'BIGINT';
    if (isFloat && values.filter(v => v !== '' && v !== null).length > 0) return 'NUMERIC';
    if (isDate && values.filter(v => v !== '' && v !== null).length > 0) return 'TIMESTAMP';
    if (maxLen > 10000) return 'TEXT';
    return 'TEXT';
}

// Convert value for PostgreSQL
function convertValue(value, colType) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    if (colType === 'BOOLEAN') {
        return ['True', '1', 'true'].includes(value);
    }

    if (colType === 'TIMESTAMP') {
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (e) {
            return null;
        }
    }

    return value;
}

async function importCsv(csvPath) {
    const fileName = path.basename(csvPath, '.csv');
    const tableName = toTableName(fileName);

    // Read CSV content with BOM handling
    let csvContent = fs.readFileSync(csvPath, 'utf-8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
        csvContent = csvContent.slice(1);
    }

    let records;
    try {
        records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_quotes: true,
            relax_column_count: true,
            trim: true
        });
    } catch (err) {
        console.log(`  Error parsing: ${err.message}`);
        return { imported: 0, error: err.message };
    }

    if (records.length === 0) {
        return { imported: 0, empty: true };
    }

    const client = await pool.connect();
    let imported = 0;

    try {
        // Get columns and detect types
        const mssqlColumns = Object.keys(records[0]);
        const columnTypes = {};
        const pgColumns = [];

        for (const col of mssqlColumns) {
            const pgCol = toSnakeCase(col);
            pgColumns.push(pgCol);

            // Sample values for type detection
            const sampleValues = records.slice(0, 100).map(r => r[col]);
            columnTypes[pgCol] = detectColumnType(sampleValues);
        }

        // Drop existing table and create new one
        await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);

        const columnDefs = pgColumns.map((col, idx) => {
            return `"${col}" ${columnTypes[col]}`;
        }).join(', ');

        const createSql = `CREATE TABLE "${tableName}" (${columnDefs})`;
        await client.query(createSql);

        // Insert data in batches
        await client.query('BEGIN');

        for (const record of records) {
            const values = [];
            const placeholders = [];
            let idx = 1;

            for (const mssqlCol of mssqlColumns) {
                const pgCol = toSnakeCase(mssqlCol);
                const value = convertValue(record[mssqlCol], columnTypes[pgCol]);
                values.push(value);
                placeholders.push(`$${idx++}`);
            }

            const insertSql = `
                INSERT INTO "${tableName}" (${pgColumns.map(c => `"${c}"`).join(', ')})
                VALUES (${placeholders.join(', ')})
            `;

            try {
                await client.query(insertSql, values);
                imported++;
            } catch (err) {
                // Log first error, continue
                if (imported === 0) {
                    console.log(`    First row error: ${err.message.substring(0, 80)}`);
                }
            }
        }

        await client.query('COMMIT');

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return { imported, total: records.length, tableName };
}

async function main() {
    const csvDir = process.argv[2] || 'C:\\Temp\\JubileeBackup\\export';

    if (!fs.existsSync(csvDir)) {
        console.error(`Directory not found: ${csvDir}`);
        console.log('Usage: node import-jubileechat-direct.cjs <csv-directory>');
        process.exit(1);
    }

    console.log('================================================');
    console.log('JubileeChat Direct Import to PostgreSQL');
    console.log('================================================');
    console.log(`Source: ${csvDir}`);
    console.log(`Target: codex database (jc_* tables)`);
    console.log('');

    const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
    console.log(`Found ${csvFiles.length} CSV files to import\n`);

    let totalImported = 0;
    let totalTables = 0;

    for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile);
        process.stdout.write(`Importing ${csvFile}... `);

        try {
            const result = await importCsv(csvPath);
            if (result.empty) {
                console.log('empty');
            } else if (result.error) {
                console.log(`error: ${result.error}`);
            } else {
                console.log(`${result.imported}/${result.total} rows -> ${result.tableName}`);
                totalImported += result.imported;
                totalTables++;
            }
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }

    console.log('\n================================================');
    console.log(`Import complete!`);
    console.log(`Tables created: ${totalTables}`);
    console.log(`Total rows imported: ${totalImported}`);
    console.log('================================================');

    await pool.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
