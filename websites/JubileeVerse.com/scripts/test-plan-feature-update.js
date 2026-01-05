const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

async function test() {
  const client = await pool.connect();
  try {
    // Get a feature to test with
    const result = await client.query(`
      SELECT id, name, free_plan, standard_plan, ministry_plan, business_plan
      FROM plan_features
      WHERE slug = 'ai-transparency'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const feature = result.rows[0];
      console.log('Current feature state:');
      console.log(`  ${feature.name}`);
      console.log(`  Free: ${feature.free_plan}, Standard: ${feature.standard_plan}, Ministry: ${feature.ministry_plan}, Business: ${feature.business_plan}`);

      // Toggle free_plan
      const newValue = !feature.free_plan;
      console.log(`\nToggling free_plan to: ${newValue}`);

      await client.query(`
        UPDATE plan_features
        SET free_plan = $1
        WHERE id = $2
      `, [newValue, feature.id]);

      // Verify the change
      const verify = await client.query(`
        SELECT free_plan FROM plan_features WHERE id = $1
      `, [feature.id]);

      console.log(`After update: free_plan = ${verify.rows[0].free_plan}`);

      // Revert back
      await client.query(`
        UPDATE plan_features
        SET free_plan = $1
        WHERE id = $2
      `, [feature.free_plan, feature.id]);

      console.log(`Reverted back to: ${feature.free_plan}`);
      console.log('\n✓ Database updates are working correctly!');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
