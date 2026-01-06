#!/usr/bin/env node
/**
 * Update completed work estimates and insert QA tests for Multi-User Plan Infrastructure
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

async function updateWorkEstimates() {
  console.log('=== PART 1: Updating completed_work estimates ===\n');

  // Update completed_work = effort_hours * 0.5 for all completed tasks missing it
  const result = await pool.query(`
    UPDATE admin_tasks
    SET completed_work = effort_hours * 0.5,
        updated_at = NOW()
    WHERE status = 'completed'
      AND completed_work IS NULL
      AND effort_hours IS NOT NULL
    RETURNING task_number, title, effort_hours, completed_work
  `);

  console.log(`Updated ${result.rows.length} tasks with completed_work estimates:`);
  result.rows.forEach(t => {
    console.log(`  Task ${t.task_number}: ${t.effort_hours}h effort → ${t.completed_work}h completed work`);
  });

  // Verify
  const verify = await pool.query(`
    SELECT COUNT(*) as count
    FROM admin_tasks
    WHERE status = 'completed' AND completed_work IS NULL
  `);
  console.log(`\nRemaining completed tasks without completed_work: ${verify.rows[0].count}`);
}

async function insertQATests() {
  console.log('\n=== PART 2: Inserting QA Tests for Multi-User Plan Infrastructure ===\n');

  // Get the highest qa_number to continue numbering
  const maxResult = await pool.query(`
    SELECT qa_number FROM qa_tests
    WHERE qa_number LIKE 'QA-%'
    ORDER BY qa_number DESC
    LIMIT 1
  `);

  let qaNum = 900; // Default start
  if (maxResult.rows.length > 0) {
    const lastNum = parseInt(maxResult.rows[0].qa_number.replace('QA-', ''));
    qaNum = Math.max(lastNum + 10, 900); // Start at 900 or 10 after last
  }

  // QA Tests for Multi-User Plan Infrastructure
  const qaTests = [
    // Database Integrity Tests
    {
      qa_number: `QA-${String(qaNum).padStart(4, '0')}`,
      test_name: 'Shared Token Pool Table Exists',
      category: 'admin',
      test_type: 'automated',
      test_description: 'Verify shared_token_pools table was created with all required columns: id, primary_user_id, plan_type, base_token_limit, purchased_tokens, current_balance, period_start, period_end, status.',
      expected_result: 'Table exists with all columns and proper constraints',
      test_script: "SELECT column_name FROM information_schema.columns WHERE table_name = 'shared_token_pools' ORDER BY ordinal_position;"
    },
    {
      qa_number: `QA-${String(qaNum + 10).padStart(4, '0')}`,
      test_name: 'Plan Memberships Table Exists',
      category: 'admin',
      test_type: 'automated',
      test_description: 'Verify plan_memberships table was created with columns: id, pool_id, user_id, role, status, age_verified, terms_accepted, tokens_used_this_period.',
      expected_result: 'Table exists with all columns including age compliance fields',
      test_script: "SELECT column_name FROM information_schema.columns WHERE table_name = 'plan_memberships' ORDER BY ordinal_position;"
    },
    {
      qa_number: `QA-${String(qaNum + 20).padStart(4, '0')}`,
      test_name: 'Plan Invitations Table Exists',
      category: 'admin',
      test_type: 'automated',
      test_description: 'Verify plan_invitations table has invitation_token, email, status, expires_at, age_attestation_by, age_attestation_text columns.',
      expected_result: 'Table exists with secure token and age attestation tracking',
      test_script: "SELECT column_name FROM information_schema.columns WHERE table_name = 'plan_invitations' ORDER BY ordinal_position;"
    },
    {
      qa_number: `QA-${String(qaNum + 30).padStart(4, '0')}`,
      test_name: 'Plan Type Limits Configured',
      category: 'admin',
      test_type: 'automated',
      test_description: 'Verify plan_type_limits contains entries for visitor (1 user), standard (1 user), ministry (5 users), business (10 users), enterprise (100 users) with appropriate token limits.',
      expected_result: 'All plan types have correct user limits and token allocations',
      test_script: "SELECT plan_type, max_users, monthly_token_limit FROM plan_type_limits ORDER BY max_users;"
    },
    {
      qa_number: `QA-${String(qaNum + 40).padStart(4, '0')}`,
      test_name: 'Sensitive Data Audit Log Table Exists',
      category: 'security',
      test_type: 'automated',
      test_description: 'Verify sensitive_data_audit_log table exists for tracking access to PII and sensitive user data with accessor_user_id, action_type, target_type, target_id, accessor_ip_address.',
      expected_result: 'Audit log table exists with immutable logging capability',
      test_script: "SELECT column_name FROM information_schema.columns WHERE table_name = 'sensitive_data_audit_log' ORDER BY ordinal_position;"
    },

    // API Endpoint Tests
    {
      qa_number: `QA-${String(qaNum + 50).padStart(4, '0')}`,
      test_name: 'GET /api/plan Returns Plan Details',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test GET /api/plan endpoint returns current user plan details including balance, limits, capacity, and member count. Requires authentication.',
      expected_result: 'Returns JSON with hasPlan, planType, balance, limits, members array, pendingInvitations count',
      test_script: 'curl -X GET http://localhost:3000/api/plan -H "Cookie: session=..." --include'
    },
    {
      qa_number: `QA-${String(qaNum + 60).padStart(4, '0')}`,
      test_name: 'GET /api/plan/balance Returns Token Balance',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test GET /api/plan/balance endpoint returns current token balance with available, used, purchased, and limit values.',
      expected_result: 'Returns JSON with balance object containing token allocation details',
      test_script: 'curl -X GET http://localhost:3000/api/plan/balance -H "Cookie: session=..." --include'
    },
    {
      qa_number: `QA-${String(qaNum + 70).padStart(4, '0')}`,
      test_name: 'POST /api/plan/invite Creates Invitation',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test POST /api/plan/invite with email and ageAttestation=true creates a pending invitation with 7-day expiration.',
      expected_result: 'Returns JSON with invitation id, email, expiresAt, invitationToken',
      test_script: 'curl -X POST http://localhost:3000/api/plan/invite -H "Content-Type: application/json" -d \'{"email":"test@example.com","ageAttestation":true}\' -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 80).padStart(4, '0')}`,
      test_name: 'POST /api/plan/invite Requires Age Attestation',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test POST /api/plan/invite fails with 400 error when ageAttestation is false or missing. This enforces 13+ age compliance.',
      expected_result: 'Returns 400 error: "You must confirm the invitee is at least 13 years old"',
      test_script: 'curl -X POST http://localhost:3000/api/plan/invite -H "Content-Type: application/json" -d \'{"email":"test@example.com","ageAttestation":false}\' -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 90).padStart(4, '0')}`,
      test_name: 'POST /api/plan/invitation/:token/accept Joins Plan',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test accepting an invitation with valid token, acceptTerms=true, and ageVerified=true creates new membership.',
      expected_result: 'Returns JSON with membership id, role (associated), status (active)',
      test_script: 'curl -X POST http://localhost:3000/api/plan/invitation/TOKEN/accept -H "Content-Type: application/json" -d \'{"acceptTerms":true,"ageVerified":true}\' -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 100).padStart(4, '0')}`,
      test_name: 'Accept Invitation Requires Terms and Age',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test accepting invitation fails without acceptTerms=true AND ageVerified=true. Both are required for compliance.',
      expected_result: 'Returns 400 error for missing terms or age verification',
      test_script: 'curl -X POST http://localhost:3000/api/plan/invitation/TOKEN/accept -H "Content-Type: application/json" -d \'{"acceptTerms":false,"ageVerified":true}\' -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 110).padStart(4, '0')}`,
      test_name: 'GET /api/plan/members Returns Member List',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test GET /api/plan/members returns all plan members with role, status, tokensUsed, ageVerified, termsAccepted. Only primary/admin roles can access.',
      expected_result: 'Returns JSON with members array containing full member details',
      test_script: 'curl -X GET http://localhost:3000/api/plan/members -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 120).padStart(4, '0')}`,
      test_name: 'GET /api/plan/members Logs Audit Entry',
      category: 'security',
      test_type: 'manual',
      test_description: 'Verify that accessing member list creates an entry in sensitive_data_audit_log with VIEW_PLAN_MEMBERS action type.',
      expected_result: 'New audit log entry created with accessor_user_id, action_type, target_id (pool_id)',
      test_script: "SELECT * FROM sensitive_data_audit_log WHERE action_type = 'view_plan_members' ORDER BY created_at DESC LIMIT 1;"
    },
    {
      qa_number: `QA-${String(qaNum + 130).padStart(4, '0')}`,
      test_name: 'DELETE /api/plan/members/:userId Removes Member',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test DELETE /api/plan/members/:userId removes a member from the plan. Only primary/admin can remove members.',
      expected_result: 'Returns success message, member status set to removed',
      test_script: 'curl -X DELETE http://localhost:3000/api/plan/members/USER_ID -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 140).padStart(4, '0')}`,
      test_name: 'Cannot Remove Primary Account Holder',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test that primary account holder cannot be removed from their own plan. System should prevent this.',
      expected_result: 'Returns 403 error preventing removal of primary user',
      test_script: 'Attempt to remove primary user via DELETE /api/plan/members/:primaryUserId'
    },

    // Permission and Access Control Tests
    {
      qa_number: `QA-${String(qaNum + 150).padStart(4, '0')}`,
      test_name: 'Associated User Cannot View Member List',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test that associated (non-primary, non-admin) users get 403 when trying to access GET /api/plan/members.',
      expected_result: 'Returns 403 error: "Only plan owner can view members"',
      test_script: 'Login as associated user, attempt GET /api/plan/members'
    },
    {
      qa_number: `QA-${String(qaNum + 160).padStart(4, '0')}`,
      test_name: 'Associated User Cannot Invite Others',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test that associated users cannot send invitations. Only primary/admin roles should have invite capability.',
      expected_result: 'Returns 403 error for unauthorized invitation attempt',
      test_script: 'Login as associated user, attempt POST /api/plan/invite'
    },
    {
      qa_number: `QA-${String(qaNum + 170).padStart(4, '0')}`,
      test_name: 'Plan Capacity Enforced - Ministry 5 Users',
      category: 'admin',
      test_type: 'manual',
      test_description: 'Test that ministry plan cannot add more than 5 users. 6th invitation should fail with capacity error.',
      expected_result: 'Returns error when plan capacity (5 users) is reached',
      test_script: 'Create ministry plan with 5 members, attempt 6th invitation'
    },
    {
      qa_number: `QA-${String(qaNum + 180).padStart(4, '0')}`,
      test_name: 'Plan Capacity Enforced - Business 10 Users',
      category: 'admin',
      test_type: 'manual',
      test_description: 'Test that business plan cannot add more than 10 users. System enforces plan_type_limits.',
      expected_result: 'Returns error when plan capacity (10 users) is reached',
      test_script: 'Create business plan with 10 members, attempt 11th invitation'
    },

    // Token Management Tests
    {
      qa_number: `QA-${String(qaNum + 190).padStart(4, '0')}`,
      test_name: 'Token Deduction Uses Pool Balance',
      category: 'api',
      test_type: 'automated',
      test_description: 'Verify that token usage deducts from shared_token_pools.current_balance, not individual user balances.',
      expected_result: 'Pool balance decreases, usage recorded with user_id for tracking',
      test_script: "SELECT deduct_pool_tokens(pool_id, user_id, 100, 'chat', NULL, NULL);"
    },
    {
      qa_number: `QA-${String(qaNum + 200).padStart(4, '0')}`,
      test_name: 'Token Purchase Adds to Pool',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test POST /api/plan/purchase-tokens adds tokens to pool purchased_tokens and current_balance.',
      expected_result: 'Returns purchase confirmation with tokensAdded and newBalance',
      test_script: 'curl -X POST http://localhost:3000/api/plan/purchase-tokens -H "Content-Type: application/json" -d \'{"tokens":10000}\' -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 210).padStart(4, '0')}`,
      test_name: 'Only Primary Can Purchase Tokens',
      category: 'security',
      test_type: 'manual',
      test_description: 'Test that only primary account holder can purchase tokens. Associated users should get 403.',
      expected_result: 'Associated users receive 403 error on purchase attempt',
      test_script: 'Login as associated user, attempt POST /api/plan/purchase-tokens'
    },
    {
      qa_number: `QA-${String(qaNum + 220).padStart(4, '0')}`,
      test_name: 'GET /api/plan/usage Returns Usage History',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test GET /api/plan/usage returns token usage history. Primary/admin see all users, others only see own usage.',
      expected_result: 'Returns usage array with user_id, tokens, usage_type, timestamp',
      test_script: 'curl -X GET http://localhost:3000/api/plan/usage -H "Cookie: session=..."'
    },

    // Invitation Workflow Tests
    {
      qa_number: `QA-${String(qaNum + 230).padStart(4, '0')}`,
      test_name: 'Invitation Expires After 7 Days',
      category: 'api',
      test_type: 'manual',
      test_description: 'Verify invitation expires_at is set to 7 days from creation. Expired invitations cannot be accepted.',
      expected_result: 'Accepting expired invitation returns 400 error: "Invitation has expired"',
      test_script: 'Check expires_at on new invitation, verify rejection after expiry'
    },
    {
      qa_number: `QA-${String(qaNum + 240).padStart(4, '0')}`,
      test_name: 'DELETE /api/plan/invitations/:id Revokes',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test DELETE /api/plan/invitations/:invitationId revokes pending invitation.',
      expected_result: 'Returns success, invitation status changed to revoked',
      test_script: 'curl -X DELETE http://localhost:3000/api/plan/invitations/INV_ID -H "Cookie: session=..."'
    },
    {
      qa_number: `QA-${String(qaNum + 250).padStart(4, '0')}`,
      test_name: 'Cannot Accept Already Accepted Invitation',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test that accepting an already-accepted invitation returns appropriate error.',
      expected_result: 'Returns 400 error: "Invitation has already been accepted"',
      test_script: 'Attempt to accept invitation twice with same or different user'
    },
    {
      qa_number: `QA-${String(qaNum + 260).padStart(4, '0')}`,
      test_name: 'GET /api/plan/my-invitations Shows Pending',
      category: 'api',
      test_type: 'manual',
      test_description: 'Test GET /api/plan/my-invitations returns pending invitations addressed to current user email.',
      expected_result: 'Returns array of pending invitations with inviterName, planType, expiresAt',
      test_script: 'curl -X GET http://localhost:3000/api/plan/my-invitations -H "Cookie: session=..."'
    },

    // Audit and Compliance Tests
    {
      qa_number: `QA-${String(qaNum + 270).padStart(4, '0')}`,
      test_name: 'Terms Acceptance Logged',
      category: 'security',
      test_type: 'manual',
      test_description: 'Verify accepting invitation creates entry in terms_acceptance_log with user_id, terms_version, acceptance_text, ip_address, user_agent.',
      expected_result: 'New terms_acceptance_log entry with full compliance metadata',
      test_script: "SELECT * FROM terms_acceptance_log ORDER BY accepted_at DESC LIMIT 1;"
    },
    {
      qa_number: `QA-${String(qaNum + 280).padStart(4, '0')}`,
      test_name: 'Age Attestation Recorded',
      category: 'security',
      test_type: 'manual',
      test_description: 'Verify invitation creation stores age_attestation_by, age_attestation_text, age_attestation_at in plan_invitations.',
      expected_result: 'Invitation record contains full age attestation audit trail',
      test_script: "SELECT age_attestation_by, age_attestation_text, age_attestation_at FROM plan_invitations ORDER BY created_at DESC LIMIT 1;"
    },
    {
      qa_number: `QA-${String(qaNum + 290).padStart(4, '0')}`,
      test_name: 'Database Trigger Prevents Unverified Activation',
      category: 'security',
      test_type: 'automated',
      test_description: 'Test trg_enforce_age_verification trigger prevents setting membership status to active without age_verified=true.',
      expected_result: 'Database throws error when activating unverified member',
      test_script: "UPDATE plan_memberships SET status = 'active', age_verified = FALSE WHERE id = '...';"
    },
    {
      qa_number: `QA-${String(qaNum + 300).padStart(4, '0')}`,
      test_name: 'Audit Log Cannot Be Deleted',
      category: 'security',
      test_type: 'automated',
      test_description: 'Verify sensitive_data_audit_log entries cannot be deleted (immutable). DELETE should fail or be blocked.',
      expected_result: 'DELETE operation fails or is prevented by database rules',
      test_script: "DELETE FROM sensitive_data_audit_log WHERE id = '...';"
    }
  ];

  let inserted = 0;
  let skipped = 0;

  for (const test of qaTests) {
    try {
      // Check if already exists
      const exists = await pool.query(
        'SELECT id FROM qa_tests WHERE qa_number = $1 OR test_name = $2',
        [test.qa_number, test.test_name]
      );

      if (exists.rows.length > 0) {
        console.log(`⏭️  Skipped ${test.qa_number}: ${test.test_name.substring(0, 40)}... (exists)`);
        skipped++;
        continue;
      }

      await pool.query(`
        INSERT INTO qa_tests (
          qa_number, test_name, test_description, category, test_type,
          test_script, expected_result, status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'jubilee', NOW(), NOW())
      `, [
        test.qa_number,
        test.test_name,
        test.test_description,
        test.category,
        test.test_type,
        test.test_script,
        test.expected_result
      ]);

      console.log(`✅ Inserted ${test.qa_number}: ${test.test_name.substring(0, 50)}...`);
      inserted++;
    } catch (err) {
      console.error(`❌ Error inserting ${test.qa_number}:`, err.message);
    }
  }

  console.log(`\n📊 QA Test Summary:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total defined: ${qaTests.length}`);

  // Show category breakdown
  const categoryCount = await pool.query(`
    SELECT category, COUNT(*) as count
    FROM qa_tests
    GROUP BY category
    ORDER BY count DESC
  `);
  console.log(`\nQA Tests by Category:`);
  categoryCount.rows.forEach(c => console.log(`   ${c.category}: ${c.count}`));
}

async function main() {
  try {
    await updateWorkEstimates();
    await insertQATests();

    console.log('\n✅ All updates complete!');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await pool.end();
  }
}

main();
