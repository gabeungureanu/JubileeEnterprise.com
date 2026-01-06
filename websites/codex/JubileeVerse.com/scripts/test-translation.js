#!/usr/bin/env node
/**
 * Translation System Test Script
 * Tests the centralized translation system in JubileeVerse
 *
 * Usage: node scripts/test-translation.js
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
  console.log(`  [${status}] ${name}${details ? ` - ${details}` : ''}`);
  return passed;
}

async function runTests() {
  log('\n========================================', 'cyan');
  log('  JubileeVerse Translation System Test', 'cyan');
  log('========================================\n', 'cyan');

  let passed = 0;
  let failed = 0;

  try {
    // Initialize database connection
    log('Initializing services...', 'blue');
    const database = require('../src/database');
    await database.initialize();

    const AIService = require('../src/services/AIService');
    log('Services initialized\n', 'green');

    // Test 1: translateToEnglish - English input should pass through
    log('Test Group 1: translateToEnglish', 'yellow');
    {
      const englishText = 'What does John 3:16 say about God\'s love?';
      const result = await AIService.translateToEnglish(englishText);
      const testPassed = result === englishText || result.toLowerCase().includes('john 3:16');
      if (logTest('English text passes through', testPassed, `"${result.substring(0, 50)}..."`)) passed++; else failed++;
    }

    // Test 2: translateToEnglish - Romanian to English
    {
      const romanianText = 'Ce spune Ioan 3:16 despre dragostea lui Dumnezeu?';
      const result = await AIService.translateToEnglish(romanianText);
      const testPassed = result.toLowerCase().includes('john') || result.toLowerCase().includes('god') || result.toLowerCase().includes('love');
      if (logTest('Romanian to English', testPassed, `"${result.substring(0, 50)}..."`)) passed++; else failed++;
    }

    // Test 3: translateToEnglish - Spanish to English
    {
      const spanishText = '¿Qué dice Juan 3:16 sobre el amor de Dios?';
      const result = await AIService.translateToEnglish(spanishText);
      const testPassed = result.toLowerCase().includes('john') || result.toLowerCase().includes('god') || result.toLowerCase().includes('love');
      if (logTest('Spanish to English', testPassed, `"${result.substring(0, 50)}..."`)) passed++; else failed++;
    }

    // Test 4: translateFromEnglish - English to Romanian
    log('\nTest Group 2: translateFromEnglish', 'yellow');
    {
      const englishText = 'God loves you and has a wonderful plan for your life.';
      const result = await AIService.translateFromEnglish(englishText, 'ro');
      const testPassed = result !== englishText && result.length > 10;
      if (logTest('English to Romanian', testPassed, `"${result.substring(0, 50)}..."`)) passed++; else failed++;
    }

    // Test 5: translateFromEnglish - English to Spanish
    {
      const englishText = 'Jesus said, "I am the way, the truth, and the life."';
      const result = await AIService.translateFromEnglish(englishText, 'es');
      const testPassed = result !== englishText && result.length > 10;
      if (logTest('English to Spanish', testPassed, `"${result.substring(0, 50)}..."`)) passed++; else failed++;
    }

    // Test 6: translateFromEnglish - English should pass through if target is English
    {
      const englishText = 'The Lord is my shepherd, I shall not want.';
      const result = await AIService.translateFromEnglish(englishText, 'en');
      const testPassed = result === englishText;
      if (logTest('English target returns original', testPassed)) passed++; else failed++;
    }

    // Test 7: translateResponse wrapper
    log('\nTest Group 3: translateResponse', 'yellow');
    {
      const englishResponse = 'The Bible teaches us that God is love (1 John 4:8). This means that everything God does flows from His loving nature.';
      const result = await AIService.translateResponse(englishResponse, 'ro');
      const testPassed = result.wasTranslated === true && result.translated !== result.original;
      if (logTest('Response translation wrapper (Romanian)', testPassed, `wasTranslated: ${result.wasTranslated}`)) passed++; else failed++;
    }

    // Test 8: translateResponse - English target should not translate
    {
      const englishResponse = 'Faith comes by hearing, and hearing by the word of God.';
      const result = await AIService.translateResponse(englishResponse, 'en');
      const testPassed = result.wasTranslated === false && result.translated === result.original;
      if (logTest('English target not translated', testPassed)) passed++; else failed++;
    }

    // Test 9: getLanguageName
    log('\nTest Group 4: Language utilities', 'yellow');
    {
      const roName = AIService.getLanguageName('ro');
      const esName = AIService.getLanguageName('es');
      const unknownName = AIService.getLanguageName('xx');
      const testPassed = roName === 'Romanian' && esName === 'Spanish' && unknownName === 'xx';
      if (logTest('getLanguageName', testPassed, `ro=${roName}, es=${esName}, xx=${unknownName}`)) passed++; else failed++;
    }

    // Test 10: LANGUAGE_NAMES exported
    {
      const testPassed = AIService.LANGUAGE_NAMES && Object.keys(AIService.LANGUAGE_NAMES).length > 40;
      if (logTest('LANGUAGE_NAMES exported', testPassed, `${Object.keys(AIService.LANGUAGE_NAMES).length} languages`)) passed++; else failed++;
    }

    // Summary
    log('\n========================================', 'cyan');
    log('  TEST SUMMARY', 'cyan');
    log('========================================', 'cyan');
    log(`  Passed: ${passed}`, 'green');
    log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`  Total:  ${passed + failed}`, 'blue');
    log('========================================\n', 'cyan');

    // Clean up
    await database.close();

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    log(`\nFATAL ERROR: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
