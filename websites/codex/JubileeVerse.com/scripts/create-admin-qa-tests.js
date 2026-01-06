/**
 * Create Admin QA Tests
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jubileeverse',
  user: 'guardian',
  password: 'askShaddai4e!'
});

async function createAdminTests() {
  const client = await pool.connect();
  try {
    // Get max QA number
    const maxNum = await client.query('SELECT MAX(CAST(SUBSTRING(qa_number FROM 4) AS INTEGER)) as max_num FROM qa_tests');
    let nextNum = (maxNum.rows[0]?.max_num || 0) + 1;

    const tests = [
      {
        test_name: 'Admin Dashboard Page Load',
        test_description: 'Verify the admin dashboard page loads correctly with header and sidebar',
        expected_result: 'Admin dashboard displays with header, left sidebar, and main content area'
      },
      {
        test_name: 'Admin Dashboard Access Control',
        test_description: 'Verify non-admin users cannot access the admin dashboard',
        expected_result: 'Non-admin users are redirected to home page'
      },
      {
        test_name: 'Admin Sidebar Navigation',
        test_description: 'Verify clicking sidebar icons navigates to correct admin pages',
        expected_result: 'Each icon navigates to correct page and shows active state'
      },
      {
        test_name: 'Admin Tasks Page Load',
        test_description: 'Verify the admin tasks page loads with header, sidebar, and right control panel',
        expected_result: 'Tasks page displays with velocity dashboard, task queue, and view controls'
      },
      {
        test_name: 'Admin Tasks View Switching',
        test_description: 'Verify switching between Dashboard, Tasks, and QA views via right sidebar',
        expected_result: 'Each view button switches the center content without page reload'
      },
      {
        test_name: 'Admin Tasks Create Task',
        test_description: 'Verify the create task modal opens and allows task creation',
        expected_result: 'Modal opens with form fields and saves task to database'
      },
      {
        test_name: 'Admin Hospitality Page Load',
        test_description: 'Verify the hospitality page loads with header, sidebar, and right control panel',
        expected_result: 'Hospitality page displays with dashboard view as default'
      },
      {
        test_name: 'Admin Hospitality Dashboard View',
        test_description: 'Verify the hospitality dashboard displays metrics and gauges',
        expected_result: 'Dashboard shows engagement metrics and performance gauges'
      },
      {
        test_name: 'Admin Hospitality View Switching',
        test_description: 'Verify switching between Dashboard, Subscribers, Visitors, and Rules views',
        expected_result: 'Each view button switches content without page reload'
      },
      {
        test_name: 'Admin Hospitality Subscribers View',
        test_description: 'Verify the subscribers view displays subscriber hospitality data',
        expected_result: 'Subscribers view shows list with engagement metrics'
      },
      {
        test_name: 'Admin Hospitality Visitors View',
        test_description: 'Verify the visitors view displays visitor hospitality data',
        expected_result: 'Visitors view shows list with session data'
      },
      {
        test_name: 'Admin Hospitality Rules View',
        test_description: 'Verify the rules view displays hospitality rules management',
        expected_result: 'Rules view shows rule list with toggle controls'
      },
      {
        test_name: 'Admin Header Navigation',
        test_description: 'Verify header links navigate correctly',
        expected_result: 'Each link navigates to the correct page'
      },
      {
        test_name: 'Admin Header Sign Out',
        test_description: 'Verify Sign Out button logs user out',
        expected_result: 'User is logged out and redirected'
      },
      {
        test_name: 'Admin Sidebar Tooltips',
        test_description: 'Verify hovering over sidebar icons shows tooltip labels',
        expected_result: 'Tooltips appear on hover for each icon'
      },
      {
        test_name: 'Admin Sidebar Active State',
        test_description: 'Verify the correct sidebar icon is highlighted based on current page',
        expected_result: 'Active page icon shows gold highlight color'
      }
    ];

    for (const test of tests) {
      const qaNumber = 'QA-' + String(nextNum).padStart(4, '0');
      await client.query(
        `INSERT INTO qa_tests (id, qa_number, test_name, test_description, category, test_type, expected_result, status, created_by, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [qaNumber, test.test_name, test.test_description, 'admin', 'manual', test.expected_result, 'pending', 'jubilee']
      );
      console.log('Created:', qaNumber, '-', test.test_name);
      nextNum++;
    }

    console.log('\nTotal admin tests created:', tests.length);
  } finally {
    client.release();
    pool.end();
  }
}

createAdminTests().catch(console.error);
