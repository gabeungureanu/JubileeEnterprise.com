#!/usr/bin/env node
/**
 * Namespace Enforcement Check
 *
 * Validates commits and PRs against governance rules.
 * Used by pre-commit hooks and CI pipeline.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration
const NAMESPACE_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(NAMESPACE_ROOT, '..');
const TEST_REGISTRY_PATH = path.join(NAMESPACE_ROOT, 'testing', 'TEST_REGISTRY.json');
const UNLOCK_REQUESTS_PATH = path.join(NAMESPACE_ROOT, 'testing', 'UNLOCK_REQUESTS.json');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_FORBIDDEN = 1;
const EXIT_LOCK_VIOLATION = 2;
const EXIT_FREEZE_VIOLATION = 3;
const EXIT_STANDARDS_VIOLATION = 4;

// Forbidden patterns
const FORBIDDEN_FILES = [
    'pm2.config.js',
    'pm2.config.cjs',
    'ecosystem.config.js',
    'ecosystem.config.cjs',
    '.pm2',
];

const FORBIDDEN_CONTENT = [
    { pattern: /pm2\.start\(/gi, desc: 'PM2 process management' },
    { pattern: /require\(['"]pm2['"]\)/gi, desc: 'PM2 module import' },
    { pattern: /from\s+['"]pm2['"]/gi, desc: 'PM2 ES import' },
];

const FROZEN_PATHS = [
    'services/Inspire.8.0/daemon/',
    '.namespace/governance/',
    '.namespace/context/',
    '.namespace/enforcement/',
];

const FREEZE_EXCEPTIONS = [
    '.namespace/testing/UNLOCK_REQUESTS.json',
    '.namespace/testing/TEST_REGISTRY.json',
];

const BLOCKED_STANDARDS_FILES = [
    'STANDARDS.md',
    'GOVERNANCE.md',
    'CODING_STANDARDS.md',
    'DEV_RULES.md',
    'ARCHITECTURE.md',
];

/**
 * Get list of staged files
 */
function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
        return output.split('\n').filter(f => f.trim());
    } catch (err) {
        console.error('Error getting staged files:', err.message);
        return [];
    }
}

/**
 * Get list of changed files in PR
 */
function getPRChangedFiles() {
    try {
        const baseBranch = process.env.GITHUB_BASE_REF || 'main';
        const output = execSync(`git diff --name-only origin/${baseBranch}...HEAD`, { encoding: 'utf8' });
        return output.split('\n').filter(f => f.trim());
    } catch (err) {
        // Fallback for local testing
        return getStagedFiles();
    }
}

/**
 * Load JSON file safely
 */
function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        return null;
    }
}

/**
 * Calculate file fingerprint
 */
function calculateFingerprint(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const normalized = content.replace(/\r\n/g, '\n').trim();
        return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    } catch (err) {
        return null;
    }
}

/**
 * Check for forbidden files
 */
function checkForbiddenFiles(files) {
    const violations = [];

    for (const file of files) {
        const basename = path.basename(file);
        const dirname = path.dirname(file);

        for (const forbidden of FORBIDDEN_FILES) {
            if (basename === forbidden || dirname.includes(forbidden)) {
                violations.push({
                    file,
                    reason: `Forbidden file: ${forbidden}`,
                });
            }
        }
    }

    return violations;
}

/**
 * Check for forbidden content patterns
 */
function checkForbiddenContent(files) {
    const violations = [];

    for (const file of files) {
        const fullPath = path.join(REPO_ROOT, file);

        if (!fs.existsSync(fullPath)) continue;

        try {
            const content = fs.readFileSync(fullPath, 'utf8');

            for (const { pattern, desc } of FORBIDDEN_CONTENT) {
                if (pattern.test(content)) {
                    violations.push({
                        file,
                        reason: `Forbidden pattern: ${desc}`,
                    });
                }
            }
        } catch (err) {
            // Skip binary files
        }
    }

    return violations;
}

/**
 * Check lock status of modules
 */
function checkLockStatus(files) {
    const violations = [];
    const registry = loadJson(TEST_REGISTRY_PATH);
    const unlocks = loadJson(UNLOCK_REQUESTS_PATH);

    if (!registry) return violations;

    const now = new Date();

    for (const file of files) {
        // Find module in registry
        const module = registry.modules.find(m => file.includes(m.path));

        if (!module || !module.lock_bound) continue;
        if (module.lock_status !== 'LOCKED') continue;

        // Check for valid unlock
        let hasValidUnlock = false;

        if (unlocks && unlocks.requests) {
            const unlock = unlocks.requests.find(r =>
                r.module_path === module.path &&
                r.status === 'APPROVED' &&
                new Date(r.expires) > now
            );

            if (unlock) hasValidUnlock = true;
        }

        if (!hasValidUnlock) {
            violations.push({
                file,
                module: module.name,
                reason: 'Module is LOCKED. Create unlock request.',
            });
        }
    }

    return violations;
}

/**
 * Check freeze zone modifications
 */
function checkFreezeZones(files) {
    const violations = [];
    const unlocks = loadJson(UNLOCK_REQUESTS_PATH);
    const now = new Date();

    for (const file of files) {
        // Check if file is in exception list
        if (FREEZE_EXCEPTIONS.some(ex => file === ex)) continue;

        // Check if file is in frozen path
        const isFrozen = FROZEN_PATHS.some(fp => file.startsWith(fp));

        if (!isFrozen) continue;

        // Check for valid unlock
        let hasValidUnlock = false;

        if (unlocks && unlocks.freeze_zone_unlocks) {
            const unlock = unlocks.freeze_zone_unlocks.find(r =>
                (r.path === file || file.startsWith(r.path)) &&
                r.status === 'APPROVED' &&
                new Date(r.expires) > now
            );

            if (unlock) hasValidUnlock = true;
        }

        if (!hasValidUnlock) {
            violations.push({
                file,
                reason: 'Path is FROZEN. Create unlock request.',
            });
        }
    }

    return violations;
}

/**
 * Check for alternate standards files
 */
function checkAlternateStandards(files) {
    const violations = [];

    for (const file of files) {
        // Skip files in .namespace
        if (file.startsWith('.namespace/')) continue;

        const basename = path.basename(file);

        if (BLOCKED_STANDARDS_FILES.includes(basename)) {
            violations.push({
                file,
                reason: 'Standards files must be in .namespace/',
            });
        }
    }

    return violations;
}

/**
 * Main enforcement check
 */
function runChecks(mode = 'precommit') {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Namespace Enforcement Check');
    console.log('='.repeat(60));
    console.log(`  Mode: ${mode}`);
    console.log(`  Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('');

    // Get files to check
    const files = mode === 'ci' ? getPRChangedFiles() : getStagedFiles();

    if (files.length === 0) {
        console.log('No files to check.');
        process.exit(EXIT_SUCCESS);
    }

    console.log(`Checking ${files.length} files...`);
    console.log('');

    let hasViolations = false;
    let exitCode = EXIT_SUCCESS;

    // Run all checks
    const forbiddenFileViolations = checkForbiddenFiles(files);
    const forbiddenContentViolations = checkForbiddenContent(files);
    const lockViolations = checkLockStatus(files);
    const freezeViolations = checkFreezeZones(files);
    const standardsViolations = checkAlternateStandards(files);

    // Report violations
    if (forbiddenFileViolations.length > 0) {
        hasViolations = true;
        exitCode = EXIT_FORBIDDEN;
        console.log('FORBIDDEN FILE VIOLATIONS:');
        forbiddenFileViolations.forEach(v => {
            console.log(`  - ${v.file}: ${v.reason}`);
        });
        console.log('');
    }

    if (forbiddenContentViolations.length > 0) {
        hasViolations = true;
        exitCode = EXIT_FORBIDDEN;
        console.log('FORBIDDEN CONTENT VIOLATIONS:');
        forbiddenContentViolations.forEach(v => {
            console.log(`  - ${v.file}: ${v.reason}`);
        });
        console.log('');
    }

    if (lockViolations.length > 0) {
        hasViolations = true;
        exitCode = EXIT_LOCK_VIOLATION;
        console.log('LOCK VIOLATIONS:');
        lockViolations.forEach(v => {
            console.log(`  - ${v.file} (${v.module}): ${v.reason}`);
        });
        console.log('');
    }

    if (freezeViolations.length > 0) {
        hasViolations = true;
        exitCode = EXIT_FREEZE_VIOLATION;
        console.log('FREEZE ZONE VIOLATIONS:');
        freezeViolations.forEach(v => {
            console.log(`  - ${v.file}: ${v.reason}`);
        });
        console.log('');
    }

    if (standardsViolations.length > 0) {
        hasViolations = true;
        exitCode = EXIT_STANDARDS_VIOLATION;
        console.log('STANDARDS VIOLATIONS:');
        standardsViolations.forEach(v => {
            console.log(`  - ${v.file}: ${v.reason}`);
        });
        console.log('');
    }

    // Final result
    if (hasViolations) {
        console.log('='.repeat(60));
        console.log('  CHECK FAILED - Violations detected');
        console.log('  See .namespace/ for governance rules');
        console.log('='.repeat(60));
        process.exit(exitCode);
    } else {
        console.log('='.repeat(60));
        console.log('  CHECK PASSED - No violations');
        console.log('='.repeat(60));
        process.exit(EXIT_SUCCESS);
    }
}

// CLI handling
const mode = process.argv[2] || 'precommit';
runChecks(mode);
