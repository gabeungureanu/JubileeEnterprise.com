#!/usr/bin/env node
/**
 * Update Test Registry
 *
 * After tests pass, update TEST_REGISTRY.json with new fingerprints
 * and set modules to LOCKED status.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const NAMESPACE_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(NAMESPACE_ROOT, '..');
const TEST_REGISTRY_PATH = path.join(NAMESPACE_ROOT, 'testing', 'TEST_REGISTRY.json');
const UNLOCK_REQUESTS_PATH = path.join(NAMESPACE_ROOT, 'testing', 'UNLOCK_REQUESTS.json');

/**
 * Calculate file fingerprint
 */
function calculateFingerprint(filePath) {
    try {
        const fullPath = path.join(REPO_ROOT, filePath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const normalized = content.replace(/\r\n/g, '\n').trim();
        return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    } catch (err) {
        console.error(`Error calculating fingerprint for ${filePath}:`, err.message);
        return null;
    }
}

/**
 * Load JSON file
 */
function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`Error loading ${filePath}:`, err.message);
        return null;
    }
}

/**
 * Save JSON file
 */
function saveJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        return true;
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err.message);
        return false;
    }
}

/**
 * Update registry after tests pass
 */
function updateRegistry() {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Updating Test Registry');
    console.log('='.repeat(60));
    console.log('');

    // Load registry
    const registry = loadJson(TEST_REGISTRY_PATH);
    if (!registry) {
        console.error('Failed to load TEST_REGISTRY.json');
        process.exit(1);
    }

    // Load unlock requests
    const unlocks = loadJson(UNLOCK_REQUESTS_PATH) || { requests: [] };

    const now = new Date().toISOString();
    let updatedCount = 0;

    // Update each lock-bound module
    for (const module of registry.modules) {
        if (!module.lock_bound) continue;

        // Check if file exists
        const fullPath = path.join(REPO_ROOT, module.path);
        if (!fs.existsSync(fullPath)) {
            console.log(`  SKIP: ${module.name} - file not found`);
            continue;
        }

        // Calculate new fingerprint
        const newFingerprint = calculateFingerprint(module.path);
        if (!newFingerprint) continue;

        // Check if fingerprint changed
        const fingerprintChanged = module.version_hash !== newFingerprint;

        if (fingerprintChanged || module.lock_status !== 'LOCKED') {
            const oldHash = module.version_hash || 'none';
            module.version_hash = newFingerprint;
            module.last_pass_time = now;
            module.lock_status = 'LOCKED';
            updatedCount++;

            console.log(`  LOCK: ${module.name}`);
            console.log(`        ${oldHash} -> ${newFingerprint}`);
        } else {
            console.log(`  OK:   ${module.name} (already locked)`);
        }
    }

    // Close any matching unlock requests
    if (unlocks.requests) {
        for (const request of unlocks.requests) {
            if (request.status === 'APPROVED') {
                const module = registry.modules.find(m => m.path === request.module_path);
                if (module && module.lock_status === 'LOCKED') {
                    request.status = 'COMPLETED';
                    request.completed_at = now;
                    console.log(`  CLOSE: Unlock request ${request.id}`);
                }
            }
        }
    }

    // Update timestamps
    registry.last_updated = now;
    unlocks.last_updated = now;

    // Save files
    if (saveJson(TEST_REGISTRY_PATH, registry)) {
        console.log('');
        console.log(`Updated TEST_REGISTRY.json (${updatedCount} modules)`);
    }

    if (saveJson(UNLOCK_REQUESTS_PATH, unlocks)) {
        console.log('Updated UNLOCK_REQUESTS.json');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('  Registry Update Complete');
    console.log('='.repeat(60));
}

updateRegistry();
