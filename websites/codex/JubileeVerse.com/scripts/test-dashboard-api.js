#!/usr/bin/env node
/**
 * Test dashboard API data
 */

require('dotenv').config();
const database = require('../src/database');

async function test() {
  try {
    // Initialize database
    await database.initialize();

    console.log('=== Testing getDashboardData() ===\n');

    const DailyProgressMetrics = require('../src/models/DailyProgressMetrics');
    const data = await DailyProgressMetrics.getDashboardData();

    console.log('progressMade:', {
      completedTasks: data.progressMade.completedTasks,
      totalEHH: data.progressMade.totalEHH,
      totalCWPlus: data.progressMade.totalCWPlus,
      linesOfCode: data.progressMade.linesOfCode,
      apiEndpoints: data.progressMade.apiEndpoints,
      databaseTables: data.progressMade.databaseTables
    });

    console.log('\nworkRemaining:', {
      pendingTasks: data.workRemaining.pendingTasks,
      pendingHEH: data.workRemaining.pendingHEH
    });

    console.log('\nvelocity:', {
      wph: data.velocity.wph,
      totalHEH: data.velocity.totalHEH,
      zone: data.velocity.zone
    });

    console.log('\nExpected values:');
    console.log('  completedTasks: 22');
    console.log('  totalEHH: 66');
    console.log('  totalCWPlus: 33');

    if (data.progressMade.completedTasks === 22 &&
        data.progressMade.totalEHH === 66 &&
        data.progressMade.totalCWPlus === 33) {
      console.log('\n✅ SUCCESS: Dashboard data matches database values!');
    } else {
      console.log('\n❌ MISMATCH: Dashboard data does not match expected values');
    }

  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    process.exit(0);
  }
}

test();
