#!/usr/bin/env node
/**
 * AI Prompt Bootstrap Wrapper
 *
 * Prepends namespace governance files to any AI prompt, ensuring
 * the AI always has the required context regardless of session history.
 *
 * Usage:
 *   node scripts/ai-prompt.cjs "How do I add a new website service?"
 *   node scripts/ai-prompt.cjs --file prompt.txt
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Get repository root
const scriptDir = __dirname;
const repoRoot = path.dirname(scriptDir);

// Governance files to include
const BOOTSTRAP_FILES = [
    '.namespace/context/CONTEXT_SUMMARY.md',
    '.namespace/governance/SYSTEM_STANDARD.md',
    '.namespace/governance/AI_DEV_CONTRACT.md',
    '.namespace/testing/LOCK_RULES.md',
];

/**
 * Build bootstrapped prompt
 */
function buildBootstrappedPrompt(userPrompt) {
    let result = `# ============================================================
# NAMESPACE GOVERNANCE BOOTSTRAP
# Auto-prepended by scripts/ai-prompt.cjs
# ============================================================

This prompt has been automatically bootstrapped with project governance.
You MUST comply with all rules in the following sections.

[NAMESPACE-BOOTSTRAP: VERIFIED]

`;

    for (const file of BOOTSTRAP_FILES) {
        const fullPath = path.join(repoRoot, file);

        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            result += `
# ------------------------------------------------------------
# FILE: ${file}
# ------------------------------------------------------------

${content}

`;
        } else {
            console.error(`Warning: Missing bootstrap file: ${file}`);
        }
    }

    result += `
# ============================================================
# USER REQUEST
# ============================================================

${userPrompt}

# ============================================================
# RESPONSE REQUIREMENTS
# ============================================================

1. Verify compliance with SYSTEM_STANDARD.md before any code changes
2. Check LOCK_RULES.md before modifying core modules
3. Include [NAMESPACE-BOOTSTRAP: VERIFIED] in your response
4. Never suggest PM2 or other forbidden technologies
5. Use production HTTPS URLs for health checks, not localhost

`;

    return result;
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node scripts/ai-prompt.cjs "Your prompt here"');
        console.log('       node scripts/ai-prompt.cjs --file prompt.txt');
        console.log('       node scripts/ai-prompt.cjs --output result.txt "Your prompt"');
        process.exit(1);
    }

    let userPrompt = '';
    let outputFile = null;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--file' && args[i + 1]) {
            userPrompt = fs.readFileSync(args[i + 1], 'utf8');
            i++;
        } else if (args[i] === '--output' && args[i + 1]) {
            outputFile = args[i + 1];
            i++;
        } else if (!args[i].startsWith('--')) {
            userPrompt = args[i];
        }
    }

    if (!userPrompt) {
        console.error('Error: No prompt provided');
        process.exit(1);
    }

    // Build and output
    const bootstrapped = buildBootstrappedPrompt(userPrompt);

    if (outputFile) {
        fs.writeFileSync(outputFile, bootstrapped);
        console.log(`Bootstrapped prompt saved to: ${outputFile}`);
        console.log(`Length: ${bootstrapped.length} characters`);
    } else {
        console.log(bootstrapped);
    }
}

main();
