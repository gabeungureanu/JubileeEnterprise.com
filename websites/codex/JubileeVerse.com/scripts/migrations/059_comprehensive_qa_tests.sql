-- ============================================
-- JubileeVerse Database Schema
-- Migration 059: Comprehensive QA Tests for New Features
-- ============================================
-- Adds QA tests for:
-- - Multi-User Plan Infrastructure (Tasks 144-153)
-- - User Analytics Intelligence System (Tasks 133-137)
-- - Safeguard Infrastructure (Tasks 139-143)
-- - Privacy Controls & Demographics (Task 138)
-- ============================================

-- ============================================
-- MULTI-USER PLAN INFRASTRUCTURE TESTS
-- Category: billing (plan management and tokens)
-- ============================================

-- Database Integrity Tests for Multi-User Plans
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Shared Token Pool Table Exists', 'Verify shared_token_pools table is created with correct schema', 'billing', 'automated', 'Table exists with all required columns: id, primary_user_id, plan_type, monthly_allocation, current_balance, tokens_used_this_period'),
    ('Plan Memberships Table Exists', 'Verify plan_memberships table is created with age verification fields', 'billing', 'automated', 'Table exists with age_verified, age_verified_at, terms_accepted, terms_accepted_at columns'),
    ('Plan Invitations Table Exists', 'Verify plan_invitations table has expiration and age attestation tracking', 'billing', 'automated', 'Table exists with expires_at, inviter_age_attestation, invitation_token columns'),
    ('Plan Type Limits Configured', 'Verify plan_type_limits table has correct capacity for each plan tier', 'billing', 'automated', 'visitor=1, standard=1, ministry=5, business=10, enterprise=100 max_users'),
    ('Token Pool Foreign Keys Valid', 'Verify shared_token_pools has valid foreign key to users table', 'billing', 'automated', 'Foreign key constraint on primary_user_id references users(id)'),
    ('Pool Balance Constraint Enforced', 'Verify current_balance cannot go negative via constraint', 'billing', 'automated', 'CHECK constraint prevents current_balance < 0'),
    ('Audit Log Table Immutable', 'Verify sensitive_data_audit_log exists and has no UPDATE trigger', 'billing', 'automated', 'Table exists with accessor_user_id, action_type, target_id columns'),
    ('Terms Acceptance Log Exists', 'Verify terms_acceptance_log tracks legal compliance data', 'billing', 'automated', 'Table has user_id, terms_type, terms_version, ip_address, age_attestation_text')
ON CONFLICT DO NOTHING;

-- API Behavior Tests for Plan Management
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('GET /api/plan Returns Plan Info', 'Verify plan endpoint returns plan type, balance, and member count', 'api', 'api', 'Response includes plan_type, current_balance, monthly_allocation, member_count'),
    ('GET /api/plan/balance Returns Token Balance', 'Verify balance endpoint returns complete token breakdown', 'api', 'api', 'Response includes current_balance, tokens_used_this_period, additional_tokens_purchased'),
    ('GET /api/plan/members Returns Member List', 'Verify members endpoint returns list with roles for authorized users', 'api', 'api', 'Response includes array of members with user_id, role, status, age_verified fields'),
    ('POST /api/plan/invite Creates Invitation', 'Verify invitation creation with age attestation requirement', 'api', 'api', 'Returns invitation_token, email, expires_at when age attestation provided'),
    ('POST /api/plan/invitation/accept Joins Plan', 'Verify invitation acceptance creates membership and validates terms', 'api', 'api', 'Creates plan_membership record with status=active when terms accepted'),
    ('GET /api/plan/usage Returns Usage History', 'Verify usage endpoint returns per-user token consumption', 'api', 'api', 'Response includes array with user_id, tokens_used, usage_type, created_at'),
    ('POST /api/plan/purchase-tokens Adds Tokens', 'Verify token purchase updates pool balance correctly', 'api', 'api', 'Pool current_balance increases, token_purchases record created'),
    ('DELETE /api/plan/members/:userId Removes Member', 'Verify member removal changes status to removed', 'api', 'api', 'Membership status changes to removed, user loses pool access')
ON CONFLICT DO NOTHING;

-- Security & Permissions Tests for Multi-User Plans
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Associated Users Cannot View Members', 'Verify associated role users get 403 on /api/plan/members', 'security', 'api', 'Returns 403 Forbidden for non-primary, non-admin users'),
    ('Associated Users Cannot Invite', 'Verify associated role users get 403 on POST /api/plan/invite', 'security', 'api', 'Returns 403 Forbidden for associated role users'),
    ('Only Primary Can Purchase Tokens', 'Verify only primary account holder can POST /api/plan/purchase-tokens', 'security', 'api', 'Returns 403 Forbidden for non-primary users'),
    ('Primary Cannot Be Removed', 'Verify DELETE /api/plan/members fails for primary user', 'security', 'api', 'Returns 400 Bad Request - cannot remove primary account holder'),
    ('Age Attestation Required for Invite', 'Verify POST /api/plan/invite fails without age attestation', 'security', 'api', 'Returns 400 Bad Request when inviter_age_attestation is false'),
    ('Terms Required for Membership', 'Verify invitation acceptance fails without terms acceptance', 'security', 'api', 'Returns 400 Bad Request when terms_accepted is false'),
    ('Age Verification Trigger Enforced', 'Verify database trigger prevents activating unverified associated users', 'security', 'automated', 'trg_enforce_age_verification blocks activation when age_verified=FALSE'),
    ('Expired Invitations Rejected', 'Verify invitation acceptance fails after 7-day expiration', 'security', 'api', 'Returns 400 Bad Request for expired invitation tokens'),
    ('Duplicate Invitation Prevention', 'Verify same email cannot be invited twice to same pool', 'security', 'api', 'Returns 409 Conflict when pending invitation exists for email'),
    ('Member List Access Logged', 'Verify accessing /api/plan/members creates audit log entry', 'security', 'automated', 'sensitive_data_audit_log entry created with action_type=view_plan_members')
ON CONFLICT DO NOTHING;

-- Token Management Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Pool Capacity Enforced on Invite', 'Verify invitation fails when pool is at max capacity', 'billing', 'api', 'Returns 400 Bad Request when pool has reached max_users limit'),
    ('Token Deduction Atomic', 'Verify deduct_pool_tokens function updates balance atomically', 'billing', 'automated', 'Function returns FALSE when insufficient balance, no partial deduction'),
    ('Token Purchase Updates Balance', 'Verify add_purchased_tokens function increases current_balance and logs purchase', 'billing', 'automated', 'current_balance increases, token_purchases record created with amount_paid_cents'),
    ('Usage Tracking Per User', 'Verify token_usage_log records user_id for each deduction', 'billing', 'automated', 'token_usage_log entries have correct pool_id, user_id, tokens_used'),
    ('Period Reset Function Works', 'Verify reset_pool_period resets balances and updates period dates', 'billing', 'automated', 'current_balance resets to monthly_allocation, tokens_used_this_period=0'),
    ('Member Usage Counter Updates', 'Verify plan_memberships.tokens_used_this_period updates on deduction', 'billing', 'automated', 'Member tokens_used_this_period increases with each deduction'),
    ('Pool Views Return Correct Data', 'Verify v_pool_summary view aggregates member counts correctly', 'billing', 'automated', 'View returns active_members, pending_members, total_members accurately'),
    ('Pending Invitations View Works', 'Verify v_pending_invitations excludes expired invitations', 'billing', 'automated', 'View only includes invitations where expires_at > NOW()')
ON CONFLICT DO NOTHING;

-- Audit & Compliance Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Terms Acceptance Logged', 'Verify terms_acceptance_log records IP address and user agent', 'security', 'automated', 'Log entry has ip_address, user_agent, accepted_at timestamp'),
    ('Age Attestation Recorded', 'Verify age attestation text is stored in terms_acceptance_log', 'security', 'automated', 'Log entry has age_attestation_text and min_age_requirement=13'),
    ('Audit Log Records Access', 'Verify sensitive_data_audit_log captures accessor details', 'security', 'automated', 'Log entries include accessor_user_id, accessor_role, accessor_ip_address'),
    ('Audit Log Deletion Prevented', 'Verify sensitive_data_audit_log cannot be deleted by application', 'security', 'automated', 'DELETE on audit log fails or is blocked by permissions'),
    ('Access Timestamps Accurate', 'Verify audit log created_at matches actual access time', 'security', 'automated', 'Timestamps are within 1 second of request time')
ON CONFLICT DO NOTHING;

-- ============================================
-- USER ANALYTICS INTELLIGENCE SYSTEM TESTS
-- Category: api (analytics endpoints)
-- ============================================

-- Database Integrity Tests for Analytics
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Conversation Analysis Table Exists', 'Verify conversation_analysis table has sentiment and emotion columns', 'api', 'automated', 'Table has sentiment_score, emotion_* columns (10 emotions), fivefold_* columns'),
    ('Analytics Consent Column Exists', 'Verify users table has analytics_consent boolean column', 'api', 'automated', 'users.analytics_consent column exists with default FALSE'),
    ('Monthly Analytics Table Exists', 'Verify user_monthly_analytics table exists with aggregation columns', 'api', 'automated', 'Table has year_month, is_finalized, avg_* columns for all metrics'),
    ('Emotion Scores Validated', 'Verify emotion columns have CHECK constraints for 0-100 range', 'api', 'automated', 'All emotion_* columns have CHECK constraint >= 0 AND <= 100'),
    ('Five-Fold Columns Present', 'Verify fivefold_* columns exist for all five ministry gifts', 'api', 'automated', 'Columns exist: fivefold_apostle, fivefold_prophet, fivefold_evangelist, fivefold_pastor, fivefold_teacher'),
    ('MBTI Columns Present', 'Verify mbti_* columns exist with default value 50', 'api', 'automated', 'Columns mbti_e_i, mbti_s_n, mbti_t_f, mbti_j_p exist with DEFAULT 50'),
    ('Analysis Message Unique', 'Verify conversation_analysis has unique constraint on message_id', 'api', 'automated', 'UNIQUE constraint prevents duplicate analysis per message')
ON CONFLICT DO NOTHING;

-- API Behavior Tests for Analytics
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('POST /api/conversation/analyze Triggers Analysis', 'Verify analysis endpoint creates conversation_analysis record', 'api', 'api', 'Creates analysis record with sentiment, emotions, and fivefold scores'),
    ('GET /api/user/analytics Returns Current Month', 'Verify analytics endpoint returns current month data', 'api', 'api', 'Response includes avg_sentiment, dominant_emotion, engagement_health'),
    ('GET /api/user/analytics/:yearMonth Returns History', 'Verify historical analytics are accessible by year-month', 'api', 'api', 'Response includes is_finalized flag and all aggregated metrics'),
    ('PUT /api/user/analytics-consent Toggles Consent', 'Verify consent endpoint updates analytics_consent field', 'api', 'api', 'users.analytics_consent toggles, analytics_consent_at updated'),
    ('DELETE /api/user/analytics Purges Data', 'Verify analytics purge deletes conversation_analysis records', 'api', 'api', 'All conversation_analysis records for user deleted'),
    ('Analysis Respects Consent', 'Verify /api/conversation/analyze only works when consent=TRUE', 'api', 'api', 'Returns 403 or skips analysis when analytics_consent=FALSE'),
    ('Monthly Aggregation Calculates Correctly', 'Verify monthly analytics averages match individual records', 'api', 'automated', 'avg_sentiment in monthly matches AVG(sentiment_score) from conversation_analysis')
ON CONFLICT DO NOTHING;

-- Consent & Privacy Tests for Analytics
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Consent Required for Analysis', 'Verify conversation analysis blocked when consent not granted', 'security', 'api', 'No conversation_analysis record created when analytics_consent=FALSE'),
    ('Consent Revocation Triggers Purge', 'Verify monthly job purges analytics when consent revoked', 'security', 'automated', 'conversation_analysis and user_monthly_analytics deleted for revoked users'),
    ('Private Conversations Excluded', 'Verify is_private=TRUE conversations excluded from analytics', 'security', 'automated', 'No conversation_analysis records exist for private conversations'),
    ('Finalized Analytics Immutable', 'Verify is_finalized=TRUE monthly records cannot be updated', 'security', 'automated', 'UPDATE on finalized records blocked or ignored'),
    ('Analytics Access Logged', 'Verify analytics_access_log records access to user analytics', 'security', 'automated', 'Log entry created when admin views user analytics')
ON CONFLICT DO NOTHING;

-- ============================================
-- SAFEGUARD INFRASTRUCTURE TESTS
-- Category: security (safety and admin alerts)
-- ============================================

-- Database Integrity Tests for Safeguards
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Safety Flags Table Exists', 'Verify safety_flags table has category, severity, confidence columns', 'security', 'automated', 'Table has category, subcategory, severity, confidence, evidence_tokens columns'),
    ('Admin Alerts Table Exists', 'Verify admin_alerts table has alert_type, redacted_summary columns', 'security', 'automated', 'Table has alert_type, category, severity, redacted_summary, status columns'),
    ('Alert Access Log Exists', 'Verify admin_alert_access_log tracks who viewed alerts', 'security', 'automated', 'Table has alert_id, accessed_by, access_type, access_granted columns'),
    ('Persona Performance Table Exists', 'Verify persona_performance tracks behavior metrics', 'security', 'automated', 'Table has relatability, friendliness, boundary_clarity, overall_score columns'),
    ('Safeguard Thresholds Configured', 'Verify safeguard_thresholds has default entries for all categories', 'security', 'automated', 'Thresholds exist for self_harm, harm_to_others, sexual_advance, grooming_behavior'),
    ('Safety Flag Privacy Trigger', 'Verify trg_safety_flags_privacy prevents records for private conversations', 'security', 'automated', 'Trigger raises exception when conversation.is_private=TRUE'),
    ('Severity Enum Valid', 'Verify severity values are low, moderate, elevated, high, critical', 'security', 'automated', 'Only valid severity values accepted in safety_flags and admin_alerts')
ON CONFLICT DO NOTHING;

-- Admin Alert API Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('GET /api/admin/safeguard/dashboard Returns Overview', 'Verify dashboard endpoint returns alert counts by severity', 'admin', 'api', 'Response includes new_alerts_count, critical_count, high_count breakdown'),
    ('GET /api/admin/safeguard/alerts Returns Paginated List', 'Verify alerts endpoint supports pagination and filtering', 'admin', 'api', 'Response includes alerts array with pagination metadata'),
    ('GET /api/admin/safeguard/alerts/urgent Returns High Priority', 'Verify urgent endpoint returns only critical/high severity alerts', 'admin', 'api', 'Only alerts with severity critical or high returned'),
    ('POST /api/admin/safeguard/alerts/:id/acknowledge Works', 'Verify acknowledge endpoint updates status and timestamp', 'admin', 'api', 'Alert status changes to acknowledged, acknowledged_at set'),
    ('POST /api/admin/safeguard/alerts/:id/resolve Works', 'Verify resolve endpoint updates status with resolution notes', 'admin', 'api', 'Alert status changes to resolved, resolution_notes saved'),
    ('POST /api/admin/safeguard/alerts/:id/escalate Works', 'Verify escalate endpoint increases severity level', 'admin', 'api', 'Alert severity increases, status changes to escalated'),
    ('GET /api/admin/safeguard/flags/user/:userId Works', 'Verify user safety history endpoint returns past flags', 'admin', 'api', 'Response includes array of safety_flags for the user'),
    ('GET /api/admin/safeguard/personas/:id/metrics Works', 'Verify persona metrics endpoint returns performance data', 'admin', 'api', 'Response includes avg_relatability, boundary_handling_success_rate')
ON CONFLICT DO NOTHING;

-- Access Control Tests for Safeguards
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Safeguard Endpoints Require Admin', 'Verify all /api/admin/safeguard/* endpoints require admin role', 'security', 'api', 'Returns 403 for non-admin users'),
    ('Alert Detail Access Logged', 'Verify viewing alert details creates access log entry', 'security', 'automated', 'admin_alert_access_log entry created with access_type=view_detail'),
    ('Authorized Roles Can Access', 'Verify safety_reviewer, counselor, admin, superadmin can access', 'security', 'api', 'Returns 200 OK for users with authorized roles'),
    ('Unauthorized Roles Blocked', 'Verify regular users cannot access safeguard endpoints', 'security', 'api', 'Returns 403 Forbidden for role=user'),
    ('Access Denial Logged', 'Verify denied access attempts are logged in access log', 'security', 'automated', 'access_log entry created with access_granted=FALSE, denial_reason set'),
    ('Detail Access Requires Authorization', 'Verify requires_authorization flag controls detail access', 'security', 'api', 'Detail view blocked when requires_authorization=TRUE and not authorized')
ON CONFLICT DO NOTHING;

-- Persona Performance Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Persona Metrics Aggregated Monthly', 'Verify persona_engagement_metrics aggregates performance data', 'personas', 'automated', 'Monthly aggregation includes avg_relatability, boundary_test_count'),
    ('Boundary Testing Ratio Calculated', 'Verify boundary_testing_ratio compares to platform average', 'personas', 'automated', 'Ratio calculated using calculate_persona_boundary_ratio function'),
    ('Disproportionate Testing Flagged', 'Verify personas with high boundary testing are flagged', 'personas', 'automated', 'flagged_for_review=TRUE when boundary_testing_ratio > 2.0'),
    ('Persona Privacy Trigger Works', 'Verify trg_persona_performance_privacy blocks private conversations', 'personas', 'automated', 'INSERT fails with exception for private conversation'),
    ('Crisis Response Tracked', 'Verify crisis_response_appropriate field evaluates persona handling', 'personas', 'automated', 'Field populated when encountered_crisis_signal=TRUE')
ON CONFLICT DO NOTHING;

-- ============================================
-- PRIVACY CONTROLS & DEMOGRAPHICS TESTS
-- Category: security (privacy) and api (demographics)
-- ============================================

-- Privacy Flag Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Conversation Privacy Flag Exists', 'Verify conversations.is_private column exists', 'security', 'automated', 'Column is_private exists with DEFAULT FALSE'),
    ('GET /api/conversation/:id/privacy Returns Status', 'Verify privacy endpoint returns is_private flag', 'api', 'api', 'Response includes is_private boolean'),
    ('PUT /api/conversation/:id/privacy Updates Flag', 'Verify privacy toggle endpoint works correctly', 'api', 'api', 'is_private updates, marked_private_at timestamp set'),
    ('GET /api/user/private-conversations Lists Private', 'Verify endpoint returns list of private conversations', 'api', 'api', 'Response includes array of conversation IDs where is_private=TRUE'),
    ('Private Flag Excludes From Analytics', 'Verify private conversations have no conversation_analysis records', 'security', 'automated', 'No conversation_analysis joins to conversations with is_private=TRUE'),
    ('Private Flag Excludes From Safeguards', 'Verify private conversations have no safety_flags records', 'security', 'automated', 'No safety_flags joins to conversations with is_private=TRUE'),
    ('Privacy Verification Function Works', 'Verify verify_conversation_not_private returns correct boolean', 'security', 'automated', 'Returns TRUE only when conversation exists AND is_private=FALSE')
ON CONFLICT DO NOTHING;

-- Demographics API Tests
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Demographics Columns Exist', 'Verify users table has declared_* demographic columns', 'api', 'automated', 'Columns exist: declared_sex, declared_primary_language, declared_church_background, declared_age_range'),
    ('GET /api/user/demographics Returns Profile', 'Verify demographics endpoint returns all declared fields', 'api', 'api', 'Response includes all declared_* fields from user profile'),
    ('PUT /api/user/demographics Updates Fields', 'Verify demographics update endpoint saves values', 'api', 'api', 'Declared fields update, demographics_updated_at timestamp set'),
    ('DELETE /api/user/demographics/:field Clears Field', 'Verify individual field can be cleared', 'api', 'api', 'Specified declared_* field set to NULL'),
    ('Demographics Never Inferred', 'Verify no AI inference populates declared_* fields', 'security', 'automated', 'declared_* fields only populated via user input, never conversation_analysis'),
    ('Language Declaration Valid', 'Verify declared_primary_language accepts ISO codes', 'api', 'api', 'Valid ISO 639-1 codes accepted (en, es, fr, etc.)'),
    ('Age Range Options Valid', 'Verify declared_age_range accepts valid enum values', 'api', 'api', 'Only teen, young_adult, adult, senior accepted'),
    ('Marital Status Options Valid', 'Verify declared_marital_status accepts valid values', 'api', 'api', 'Only single, dating, engaged, married, divorced, widowed accepted')
ON CONFLICT DO NOTHING;

-- ============================================
-- INTEGRATION & CROSS-FEATURE TESTS
-- Category: integration
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Plan Tokens Deducted from Pool', 'Verify chat token usage deducts from shared_token_pools not user', 'integration', 'automated', 'Token deduction updates pool.current_balance, not legacy user balance'),
    ('Analytics Excludes Private for Pool Users', 'Verify private flag respected for multi-user plan members', 'integration', 'automated', 'is_private conversations excluded regardless of pool membership'),
    ('Safeguards Check Privacy First', 'Verify safety analysis skips private conversations', 'integration', 'automated', 'verify_conversation_not_private called before safety flag creation'),
    ('Audit Log Tracks Cross-Feature Access', 'Verify audit log captures access across all sensitive endpoints', 'integration', 'automated', 'Audit entries exist for plan members, analytics, and safeguard access'),
    ('Consent Revocation Cascades', 'Verify revoking analytics consent purges all related data', 'integration', 'automated', 'conversation_analysis, user_monthly_analytics deleted on consent=FALSE'),
    ('Plan Downgrade Handles Capacity', 'Verify downgrading plan type handles excess members', 'integration', 'api', 'Appropriate error or member removal when new plan has lower max_users'),
    ('Monthly Jobs Complete Successfully', 'Verify MonthlyAnalyticsAggregationJob runs without errors', 'integration', 'automated', 'Job finalizes previous month, recalculates current month, purges revoked consent data'),
    ('Token Period Reset Monthly', 'Verify token pools reset on schedule', 'integration', 'automated', 'Pool balances reset to monthly_allocation on period boundary')
ON CONFLICT DO NOTHING;

-- ============================================
-- PERFORMANCE & STABILITY TESTS
-- Category: performance
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Audit Log Query Performance', 'Verify audit log queries complete within 500ms for 100k records', 'performance', 'automated', 'Query with accessor_user_id filter completes < 500ms'),
    ('Analytics Aggregation Performance', 'Verify monthly aggregation completes within acceptable time', 'performance', 'automated', 'Aggregation for 10k users completes in reasonable time'),
    ('Alert Pagination Performance', 'Verify paginated alert queries maintain performance', 'performance', 'automated', 'Page load with offset + limit completes < 200ms'),
    ('Token Deduction Concurrency', 'Verify concurrent token deductions maintain consistency', 'performance', 'automated', 'No race conditions when multiple deductions hit same pool'),
    ('Pool Capacity Check Performance', 'Verify check_pool_capacity function is efficient', 'performance', 'automated', 'Function completes in < 10ms')
ON CONFLICT DO NOTHING;

-- ============================================
-- ADD DOCUMENTATION FOR NEW QA TESTS
-- This is handled in the frontend JavaScript
-- The admin-tasks.html QA_TEST_DOCS object should be extended
-- ============================================

-- Add comments for documentation
COMMENT ON TABLE qa_tests IS 'QA test cases including comprehensive tests for multi-user plans, analytics, safeguards, and privacy controls';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 059: Added comprehensive QA tests for new features';
    RAISE NOTICE 'Total tests added: approximately 95 new test cases';
    RAISE NOTICE 'Categories covered: billing, api, security, admin, personas, integration, performance';
END $$;
