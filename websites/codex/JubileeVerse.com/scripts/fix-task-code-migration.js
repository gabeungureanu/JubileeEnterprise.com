#!/usr/bin/env node
/**
 * Fix task_code migration - ensure unique values before adding constraint
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
    console.log('=== Fixing task_code column ===\n');

    // Check if task_code column exists
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admin_tasks' AND column_name = 'task_code'
    `);

    if (colCheck.rows.length === 0) {
      console.log('Adding task_code column...');
      await pool.query(`ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS task_code VARCHAR(12)`);
    } else {
      console.log('task_code column already exists');
    }

    // Check for sequence
    const seqCheck = await pool.query(`
      SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'task_code_seq'
    `);

    if (seqCheck.rows.length === 0) {
      console.log('Creating task_code_seq sequence...');
      await pool.query(`CREATE SEQUENCE IF NOT EXISTS task_code_seq START WITH 1 INCREMENT BY 1`);
    }

    // Get max task_number to set sequence correctly
    const maxResult = await pool.query(`SELECT COALESCE(MAX(task_number), 0) as max_num FROM admin_tasks`);
    const maxNum = maxResult.rows[0].max_num;
    console.log(`Max task_number: ${maxNum}`);

    // Set sequence to max + 1
    await pool.query(`SELECT setval('task_code_seq', $1)`, [maxNum]);
    console.log(`Sequence set to: ${maxNum}`);

    // Generate unique task_code for all rows that don't have one
    console.log('Generating task_code values...');
    await pool.query(`
      UPDATE admin_tasks
      SET task_code = 'JIT' || LPAD(task_number::TEXT, 6, '0')
      WHERE task_code IS NULL OR task_code = ''
    `);

    // Check for any duplicates
    const dupCheck = await pool.query(`
      SELECT task_code, COUNT(*) as cnt
      FROM admin_tasks
      WHERE task_code IS NOT NULL
      GROUP BY task_code
      HAVING COUNT(*) > 1
    `);

    if (dupCheck.rows.length > 0) {
      console.log('Found duplicates, fixing...');
      for (const dup of dupCheck.rows) {
        console.log(`  Duplicate: ${dup.task_code} (${dup.cnt} occurrences)`);
      }

      // Fix duplicates by regenerating based on task_number
      await pool.query(`
        UPDATE admin_tasks
        SET task_code = 'JIT' || LPAD(task_number::TEXT, 6, '0')
      `);
    }

    // Verify no duplicates remain
    const verifyDup = await pool.query(`
      SELECT task_code, COUNT(*) as cnt
      FROM admin_tasks
      WHERE task_code IS NOT NULL
      GROUP BY task_code
      HAVING COUNT(*) > 1
    `);

    if (verifyDup.rows.length > 0) {
      console.log('ERROR: Still have duplicates!');
      console.log(verifyDup.rows);
      return;
    }

    console.log('No duplicates - safe to add constraint');

    // Drop existing constraint if any
    await pool.query(`ALTER TABLE admin_tasks DROP CONSTRAINT IF EXISTS admin_tasks_task_code_unique`);

    // Add unique constraint
    console.log('Adding unique constraint...');
    await pool.query(`ALTER TABLE admin_tasks ADD CONSTRAINT admin_tasks_task_code_unique UNIQUE (task_code)`);

    // Create index
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_tasks_task_code ON admin_tasks(task_code)`);

    // Make NOT NULL
    await pool.query(`ALTER TABLE admin_tasks ALTER COLUMN task_code SET NOT NULL`);

    // Add comment
    await pool.query(`COMMENT ON COLUMN admin_tasks.task_code IS 'Unique task code in JIT + 6 digit format (JIT000001, JIT000042, etc.)'`);

    // Create trigger function if not exists
    await pool.query(`
      CREATE OR REPLACE FUNCTION generate_task_code()
      RETURNS TRIGGER AS $$
      DECLARE
          next_num INTEGER;
      BEGIN
          SELECT nextval('task_code_seq') INTO next_num;
          NEW.task_code := 'JIT' || LPAD(next_num::TEXT, 6, '0');
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create trigger
    await pool.query(`DROP TRIGGER IF EXISTS admin_tasks_generate_code ON admin_tasks`);
    await pool.query(`
      CREATE TRIGGER admin_tasks_generate_code
          BEFORE INSERT ON admin_tasks
          FOR EACH ROW
          WHEN (NEW.task_code IS NULL)
          EXECUTE FUNCTION generate_task_code()
    `);

    console.log('\n✅ task_code migration completed successfully!');

    // Show sample
    const sample = await pool.query(`
      SELECT task_number, task_code, title
      FROM admin_tasks
      ORDER BY task_number DESC
      LIMIT 5
    `);

    console.log('\nSample tasks:');
    sample.rows.forEach(t => {
      console.log(`  ${t.task_code} - ${t.title.substring(0, 50)}...`);
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
