/**
 * Create package.json files for websites that are missing them
 * This prevents inheriting "type": "module" from parent package.json
 */

const fs = require('fs');
const path = require('path');

const codexDir = path.join(__dirname, '..', 'websites', 'codex');

// Load the services config
const configPath = path.join(__dirname, '..', 'services', 'Inspire.8.0', 'websites-services.json');
const config = require(configPath);

// Build description mapping from config
const descriptionMap = {};
for (const service of config.services) {
    const siteName = path.basename(service.cwd);
    descriptionMap[siteName] = service.description;
}

// Get all site directories
const sites = fs.readdirSync(codexDir).filter(f => {
    const stat = fs.statSync(path.join(codexDir, f));
    return stat.isDirectory() && f.endsWith('.com');
});

// Process each site
let created = 0;
let fixed = 0;
let skipped = 0;

for (const site of sites) {
    const siteDir = path.join(codexDir, site);
    const pkgPath = path.join(siteDir, 'package.json');

    // Skip backup directory
    if (site === 'backup') {
        continue;
    }

    if (fs.existsSync(pkgPath)) {
        // Check if it has type: module
        const pkg = require(pkgPath);
        if (pkg.type === 'module') {
            // Remove type: module to use CommonJS
            delete pkg.type;
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
            console.log(`Fixed (removed type:module): ${site}`);
            fixed++;
        } else {
            console.log(`OK: ${site}`);
            skipped++;
        }
    } else {
        // Create minimal package.json
        const description = descriptionMap[site] || site;
        const pkg = {
            name: `@jubilee/${site.toLowerCase().replace('.com', '')}`,
            version: '1.0.0',
            description: description,
            private: true,
            main: 'server.js',
            scripts: {
                start: 'node server.js',
                dev: 'node --watch server.js'
            },
            dependencies: {},
            engines: {
                node: '>=20.0.0'
            }
        };

        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`Created: ${site}/package.json`);
        created++;
    }
}

console.log('');
console.log(`Done! Created ${created} package.json files, fixed ${fixed} files, skipped ${skipped} files.`);
