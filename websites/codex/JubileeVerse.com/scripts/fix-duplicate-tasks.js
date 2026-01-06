#!/usr/bin/env node
/**
 * Fix duplicate task_number entries
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function run() {
  try {
    console.log('=== Finding duplicate task_numbers ===\n');

    // Find duplicates
    const dups = await pool.query(`
      SELECT task_number, COUNT(*) as cnt
      FROM admin_tasks
      GROUP BY task_number
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${dups.rows.length} duplicate task_numbers:\n`);

    for (const dup of dups.rows) {
      console.log(`Task #${dup.task_number} has ${dup.cnt} entries:`);

      const tasks = await pool.query(`
        SELECT id, task_number, title, created_at
        FROM admin_tasks
        WHERE task_number = $1
        ORDER BY created_at
      `, [dup.task_number]);

      tasks.rows.forEach((t, i) => {
        console.log(`  ${i + 1}. [${t.id}] ${t.title.substring(0, 60)}`);
        console.log(`     Created: ${new Date(t.created_at).toLocaleString()}`);
      });
      console.log('');
    }

    // Get max task_number
    const maxResult = await pool.query(`SELECT MAX(task_number) as max_num FROM admin_tasks`);
    let nextNum = maxResult.rows[0].max_num + 1;

    console.log(`\nMax task_number: ${maxResult.rows[0].max_num}`);
    console.log(`Will assign new numbers starting from: ${nextNum}\n`);

    // Fix duplicates - keep the first (oldest), reassign others
    for (const dup of dups.rows) {
      const tasks = await pool.query(`
        SELECT id, task_number, title, created_at
        FROM admin_tasks
        WHERE task_number = $1
        ORDER BY created_at
      `, [dup.task_number]);

      // Skip the first one (keep it), reassign the rest
      for (let i = 1; i < tasks.rows.length; i++) {
        const task = tasks.rows[i];
        console.log(`Reassigning: ${task.title.substring(0, 50)}...`);
        console.log(`  Old: ${task.task_number} -> New: ${nextNum}`);

        const newTaskCode = 'JIT' + String(nextNum).padStart(6, '0');
        await pool.query(`
          UPDATE admin_tasks
          SET task_number = $1, task_code = $2
          WHERE id = $3
        `, [nextNum, newTaskCode, task.id]);

        nextNum++;
      }
    }

    // Update sequence
    await pool.query(`SELECT setval('task_code_seq', $1)`, [nextNum - 1]);
    console.log(`\nSequence updated to: ${nextNum - 1}`);

    // Verify no more duplicates
    const verifyDup = await pool.query(`
      SELECT task_number, COUNT(*) as cnt
      FROM admin_tasks
      GROUP BY task_number
      HAVING COUNT(*) > 1
    `);

    if (verifyDup.rows.length === 0) {
      console.log('\n✅ All duplicates fixed!');
    } else {
      console.log('\n❌ Still have duplicates:', verifyDup.rows);
    }

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
