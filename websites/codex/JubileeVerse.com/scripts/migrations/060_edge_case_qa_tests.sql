-- ============================================
-- JubileeVerse Database Schema
-- Migration 060: Edge Case and Failure Condition QA Tests
-- ============================================
-- Adds critical QA tests for:
-- - Race conditions and concurrent access scenarios
-- - NULL handling and boundary value testing
-- - Error propagation and rollback scenarios
-- - Cross-feature interaction risks
-- - Scheduled job failure modes
-- ============================================

-- ============================================
-- RACE CONDITION & CONCURRENCY TESTS
-- Category: security (data integrity under load)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Token Deduction Race Condition', 'Verify two users deducting tokens simultaneously from same pool cannot overdraw', 'security', 'automated', 'Only one deduction succeeds when balance insufficient for both, no negative balance'),
    ('Capacity Check vs Invitation Race', 'Verify parallel invitations when pool at limit rejects second invitation', 'security', 'automated', 'Only first invitation succeeds when pool at max_users - 1'),
    ('Concurrent Month Finalization', 'Verify finalize_monthly_analytics called twice simultaneously handles race correctly', 'security', 'automated', 'Both calls complete without error, is_finalized=TRUE set exactly once'),
    ('Alert Acknowledgment Race', 'Verify two admins acknowledging same alert simultaneously preserves both actions', 'security', 'automated', 'First acknowledged_by preserved or audit log records both attempts'),
    ('Duplicate Conversation Analysis Race', 'Verify parallel analysis for same message_id rejects second INSERT', 'security', 'automated', 'First analysis succeeds, second returns conflict error gracefully'),
    ('Token Purchase During Deduction', 'Verify add_purchased_tokens during deduct_pool_tokens maintains balance integrity', 'security', 'automated', 'Final balance = initial + purchased - deducted, no race-induced errors'),
    ('Period Reset During Active Usage', 'Verify reset_pool_period called during deduct_pool_tokens does not corrupt data', 'security', 'automated', 'Either reset completes first or deduction completes first, no partial states'),
    ('Threshold Update During Analysis', 'Verify safeguard_thresholds update during active safety analysis applies consistently', 'security', 'automated', 'Analysis uses threshold snapshot from start of analysis')
ON CONFLICT DO NOTHING;

-- ============================================
-- NULL HANDLING & EMPTY DATA TESTS
-- Category: api (data validation)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('User With No Messages Monthly Stats', 'Verify get_user_monthly_stats returns valid data for user with zero messages', 'api', 'automated', 'Returns all NULL or 0 averages, not errors or mixed types'),
    ('Empty JSONB Arrays in Aggregation', 'Verify monthly aggregation handles empty primary_needs, challenges, topics arrays', 'api', 'automated', 'Monthly analytics shows empty arrays [], not NULL'),
    ('NULL Confidence Score Aggregation', 'Verify AVG calculation handles NULL confidence_score correctly', 'api', 'automated', 'Average computed from non-NULL values only, documented behavior'),
    ('Missing Payment Method Token Purchase', 'Verify add_purchased_tokens with NULL payment_id logs warning or rejects', 'api', 'api', 'Purchase rejected or audit trail notes missing payment method'),
    ('NULL Age Attestation Text', 'Verify plan invitation with NULL inviter_age_attestation_text fails validation', 'api', 'api', 'Returns 400 Bad Request - attestation text required'),
    ('Empty Evidence Tokens Array', 'Verify safety_flag can be created with empty evidence_tokens[]', 'api', 'automated', 'Record created, empty array stored, not NULL'),
    ('NULL Persona in Performance Record', 'Verify persona_performance with NULL persona_id is rejected', 'api', 'automated', 'Foreign key constraint prevents NULL persona_id'),
    ('Missing User Default Persona', 'Verify user without default_persona_id can still chat', 'api', 'api', 'System assigns default persona or returns helpful error')
ON CONFLICT DO NOTHING;

-- ============================================
-- BOUNDARY VALUE TESTS
-- Category: security (input validation)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Zero Token Deduction Rejected', 'Verify deduct_pool_tokens(pool_id, 0) is rejected or no-op', 'security', 'automated', 'Function returns FALSE or raises error, no zero-value log entry'),
    ('Negative Token Deduction Rejected', 'Verify deduct_pool_tokens(pool_id, -100) is rejected', 'security', 'automated', 'Function returns FALSE or raises error, balance unchanged'),
    ('Negative Token Purchase Rejected', 'Verify add_purchased_tokens with negative tokens fails', 'security', 'automated', 'CHECK constraint (tokens_purchased > 0) prevents insertion'),
    ('Sentiment Score Above 100 Rejected', 'Verify conversation_analysis.sentiment_score > 100 rejected by constraint', 'security', 'automated', 'INSERT fails with CHECK constraint violation'),
    ('Emotion Score Below 0 Rejected', 'Verify emotion_* columns reject negative values', 'security', 'automated', 'CHECK constraint (>= 0) prevents negative scores'),
    ('Confidence Above 100 Rejected', 'Verify confidence columns reject values > 100', 'security', 'automated', 'CHECK constraint (<= 100) prevents oversized values'),
    ('Integer Overflow Token Allocation', 'Verify additional_tokens_purchased near INT_MAX does not overflow', 'security', 'automated', 'Addition fails gracefully before overflow or uses BIGINT'),
    ('Threshold Confidence Above 100 Rejected', 'Verify safeguard_thresholds.alert_confidence_threshold > 100 rejected', 'security', 'automated', 'UPDATE fails or constraint added to prevent invalid thresholds'),
    ('Max Users Capacity at Zero', 'Verify plan_type_limits with max_users=0 prevents any memberships', 'security', 'automated', 'No memberships can be created, appropriate error returned'),
    ('Invitation Expires At Past Date', 'Verify invitation with expires_at in past is rejected on creation', 'security', 'api', 'Creation fails or immediately marks as expired')
ON CONFLICT DO NOTHING;

-- ============================================
-- AGE VERIFICATION & COMPLIANCE TESTS
-- Category: security (child safety critical)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Activate Associated User Without Age Verify', 'Verify INSERT with status=active, role=associated, age_verified=FALSE fails', 'security', 'automated', 'Database trigger prevents activation without age verification'),
    ('Primary User Age Verification Bypass', 'Verify initializePlan with ageVerified=FALSE for primary user fails', 'security', 'api', 'Returns 400 Bad Request - primary must verify age'),
    ('Associated User Direct Status Update', 'Verify UPDATE plan_memberships SET status=active bypasses app validation', 'security', 'automated', 'Database trigger still enforces age verification on UPDATE'),
    ('Minimum Age 13 Enforcement', 'Verify age attestation with min_age < 13 is rejected', 'security', 'api', 'Terms acceptance with min_age_requirement < 13 fails'),
    ('Terms Version Mismatch', 'Verify membership activation with outdated terms_version fails', 'security', 'api', 'User must accept current terms version'),
    ('Age Attestation Without Timestamp', 'Verify age verification without age_verified_at timestamp is incomplete', 'security', 'automated', 'Record flagged as invalid until timestamp provided')
ON CONFLICT DO NOTHING;

-- ============================================
-- PRIVACY & CONSENT ENFORCEMENT TESTS
-- Category: security (privacy critical)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Analyze Without Analytics Consent', 'Verify conversation analysis blocked when analytics_consent=FALSE', 'security', 'api', 'POST /api/conversation/analyze returns 403 or skips silently'),
    ('Consent Revoked Existing Analysis', 'Verify setting analytics_consent=FALSE triggers data purge', 'security', 'automated', 'conversation_analysis and user_monthly_analytics deleted within 24hrs'),
    ('Private Conversation Marked After Analysis', 'Verify marking is_private=TRUE after analysis triggers cleanup', 'security', 'automated', 'Related conversation_analysis records deleted or anonymized'),
    ('Safety Flag Private Conversation', 'Verify safety_flag INSERT for is_private=TRUE blocked by trigger', 'security', 'automated', 'Trigger raises exception: Cannot create safety records for private conversations'),
    ('Persona Performance Private Conversation', 'Verify persona_performance INSERT for is_private=TRUE blocked', 'security', 'automated', 'Trigger prevents insertion for private conversations'),
    ('Retroactive Privacy Change Cascade', 'Verify changing is_private cascades to analytics and safeguards', 'security', 'automated', 'All related records deleted when conversation marked private'),
    ('Mixed Plan Consent Analytics', 'Verify plan aggregation excludes users with analytics_consent=FALSE', 'security', 'automated', 'Only consented members data included in plan-level analytics'),
    ('Finalized Analytics Then Private', 'Verify finalized monthly analytics updated when source marked private', 'security', 'automated', 'Monthly aggregation recalculated excluding private data')
ON CONFLICT DO NOTHING;

-- ============================================
-- ALERT LIFECYCLE & STATE MACHINE TESTS
-- Category: admin (workflow integrity)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Alert Status Invalid Transition', 'Verify dismissed alert cannot transition to resolved', 'admin', 'api', 'Returns 400 Bad Request - invalid status transition'),
    ('Alert Expired During Review', 'Verify accessing alert after expires_at shows expiration notice', 'admin', 'api', 'Alert detail shows expired status, actions disabled'),
    ('Escalate Already Critical Alert', 'Verify escalating critical severity alert is no-op or logged', 'admin', 'api', 'Returns 200 OK but severity unchanged, action logged'),
    ('Resolve Without Resolution Notes', 'Verify resolving alert without resolution_notes shows warning', 'admin', 'api', 'Resolution accepted but flagged as incomplete'),
    ('Re-acknowledge Acknowledged Alert', 'Verify second acknowledgment preserves original timestamp', 'admin', 'api', 'Original acknowledged_at preserved, second attempt logged'),
    ('View Alert Without Required Auth Level', 'Verify user with insufficient authorization_level blocked', 'admin', 'api', 'Returns 403 Forbidden, access logged as denied'),
    ('Alert Detail Access Audit Entry', 'Verify viewing detailed alert creates access log with IP', 'admin', 'automated', 'admin_alert_access_log entry includes IP and user agent'),
    ('Delete Alert Access Log Prevented', 'Verify DELETE on admin_alert_access_log fails', 'admin', 'automated', 'DELETE operation blocked by permissions')
ON CONFLICT DO NOTHING;

-- ============================================
-- SCHEDULED JOB FAILURE MODE TESTS
-- Category: integration (system stability)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Monthly Aggregation Job Crash Recovery', 'Verify aggregate_persona_engagement crash mid-run does not corrupt data', 'integration', 'automated', 'Partial data rolled back, job can be safely retried'),
    ('Period Reset Job Failure Recovery', 'Verify reset_pool_period failure leaves pool in consistent state', 'integration', 'automated', 'Either full reset or no reset, no partial state'),
    ('Cleanup Job Zero Days Parameter', 'Verify cleanup_old_conversation_analysis(0) is rejected', 'integration', 'automated', 'Function rejects days_to_keep < 30 or validates reasonable minimum'),
    ('Finalization Job Duplicate Month', 'Verify finalize_monthly_analytics for already-finalized month is no-op', 'integration', 'automated', 'Returns 0 affected rows, no errors or data corruption'),
    ('Consent Purge Job Mid-Failure', 'Verify analytics purge job partial failure is recoverable', 'integration', 'automated', 'Failed user records retried on next run'),
    ('Token Reset Missing Pool', 'Verify reset_pool_period for non-existent pool_id handled gracefully', 'integration', 'automated', 'Returns error or no-op, does not crash job'),
    ('Aggregation Job Daylight Saving', 'Verify monthly aggregation handles DST boundaries correctly', 'integration', 'automated', 'Period boundaries calculated correctly during DST transitions'),
    ('Job Lock Contention', 'Verify concurrent job runs for same operation are serialized', 'integration', 'automated', 'Advisory locks or similar prevent duplicate job execution')
ON CONFLICT DO NOTHING;

-- ============================================
-- CROSS-FEATURE INTERACTION TESTS
-- Category: integration (system coherence)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Multi-User Plan Mixed Consent', 'Verify plan analytics excludes users who revoked consent', 'integration', 'automated', 'Aggregation filters by individual analytics_consent, not plan-level'),
    ('Private Conversation Active Alert', 'Verify marking conversation private updates related active alerts', 'integration', 'automated', 'Alert status changes to show data no longer accessible'),
    ('Token Reset During Analysis', 'Verify period reset and analytics aggregation do not conflict', 'integration', 'automated', 'Both operations complete, period data consistent'),
    ('Age Verification Failure Cascade', 'Verify associated user age_verified=FALSE prevents full access', 'integration', 'automated', 'User cannot use tokens, create conversations, or access community'),
    ('Plan Downgrade Excess Members', 'Verify downgrading from ministry (5) to standard (1) handles extra members', 'integration', 'api', 'Returns error or gracefully removes/suspends excess members'),
    ('Persona Flagged Analytics Impact', 'Verify persona flagged_for_review=TRUE affects analytics visibility', 'integration', 'automated', 'Flagged persona metrics shown with warning indicator'),
    ('Deleted User Pool Membership', 'Verify deleting user cascades to pool membership and tokens', 'integration', 'automated', 'ON DELETE CASCADE removes membership, usage logs preserved'),
    ('Community Scoped Plan Access', 'Verify plan_default_communities access respects membership status', 'integration', 'api', 'Only active plan members can access plan community')
ON CONFLICT DO NOTHING;

-- ============================================
-- JSONB VALIDATION & SCHEMA TESTS
-- Category: api (data integrity)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Malformed Primary Needs JSONB', 'Verify non-array primary_needs value is rejected', 'api', 'automated', 'INSERT fails or application validates before storage'),
    ('Struggles Array Missing Required Fields', 'Verify struggles entry without score/confidence rejected', 'api', 'automated', 'Validation rejects incomplete struggle objects'),
    ('Commandment Cues Score Overflow', 'Verify commandment_cues with score > 100 rejected or clamped', 'api', 'automated', 'Value clamped to 100 or INSERT rejected'),
    ('Huge JSONB Array Performance', 'Verify dominant_topics with 10000 entries does not crash', 'api', 'automated', 'Array truncated to reasonable limit or rejected with size error'),
    ('Empty Domain Relevance Object', 'Verify empty domain_relevance={} handled correctly', 'api', 'automated', 'No analysis fields populated, record still valid'),
    ('Invalid JSONB Type in Persona Affinity', 'Verify persona_affinity with wrong type is rejected', 'api', 'automated', 'Expected object structure validated before storage'),
    ('JSONB Special Characters', 'Verify JSONB fields handle unicode and special characters', 'api', 'automated', 'Unicode preserved correctly in storage and retrieval'),
    ('Null vs Empty Array Distinction', 'Verify NULL and [] are treated differently in JSONB fields', 'api', 'automated', 'Queries distinguish between no data (NULL) and empty data ([])'),
    ('Deep Nested JSONB Structure', 'Verify deeply nested improvement_areas JSONB is handled', 'api', 'automated', 'Nested objects stored and retrieved correctly')
ON CONFLICT DO NOTHING;

-- ============================================
-- MBTI & FIVE-FOLD VALIDATION TESTS
-- Category: api (analytics accuracy)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('MBTI All Axes at 100', 'Verify illogical MBTI distribution (all 100) is flagged or rejected', 'api', 'automated', 'Warning logged or validation rejects impossible distribution'),
    ('Five-Fold Tied Scores Dominant', 'Verify monthly dominant_fivefold when all scores equal picks deterministically', 'api', 'automated', 'Consistent tiebreaker logic applied, not random'),
    ('MBTI Type Derivation Edge Case', 'Verify likely_mbti_type derived correctly when all axes at 50', 'api', 'automated', 'Returns NULL or indicates indeterminate type'),
    ('Emotion All Zero Dominant', 'Verify dominant_emotion when all emotion scores are 0 returns NULL', 'api', 'automated', 'No emotion labeled dominant when all are zero'),
    ('Five-Fold Sum Validation', 'Verify five-fold scores summing > 500 is flagged', 'api', 'automated', 'Warning logged if sum exceeds reasonable threshold')
ON CONFLICT DO NOTHING;

-- ============================================
-- TEMPORAL & DATE EDGE CASE TESTS
-- Category: integration (time handling)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('User Created Mid-Month Analytics', 'Verify user created mid-month has correct analytics period', 'integration', 'automated', 'Analytics only include data from user creation date forward'),
    ('Invitation Expires Exact Now', 'Verify invitation with expires_at=NOW() is immediately expired', 'integration', 'automated', 'Invitation acceptance fails as expired'),
    ('Leap Year February Analytics', 'Verify February analytics in leap year handles 29 days', 'integration', 'automated', 'Period end correctly calculated for Feb 29'),
    ('Year Boundary Analytics Rollover', 'Verify December to January analytics transition is seamless', 'integration', 'automated', 'Year_month 2025-12 finalizes, 2026-01 starts correctly'),
    ('Timezone Aware Timestamps', 'Verify all TIMESTAMPTZ fields handle timezone correctly', 'integration', 'automated', 'UTC storage with correct local time conversion'),
    ('Future Date Acceptance Log', 'Verify terms_acceptance with future accepted_at is rejected', 'integration', 'automated', 'Validation prevents future timestamps'),
    ('Stale Session Token Usage', 'Verify session token older than expiry blocked even if valid signature', 'security', 'automated', 'Token rejected based on age, not just signature')
ON CONFLICT DO NOTHING;

-- ============================================
-- PERSONA PERFORMANCE EDGE CASES
-- Category: personas (metrics accuracy)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Division By Zero Boundary Ratio', 'Verify calculate_persona_boundary_ratio handles 0 conversations', 'personas', 'automated', 'Returns 0 or NULL, not division error'),
    ('Platform Average Zero Boundary', 'Verify ratio calculation when entire platform has 0 boundary tests', 'personas', 'automated', 'Returns 0 or 1, not division by zero error'),
    ('Multiple Crisis Types Single Interaction', 'Verify persona_performance handles multiple simultaneous crisis signals', 'personas', 'automated', 'Primary crisis type recorded, others logged separately'),
    ('New Persona No Historical Data', 'Verify persona metrics for brand new persona returns zeros not errors', 'personas', 'automated', 'All metric fields 0 or NULL, no query failures'),
    ('Persona Deleted Mid-Aggregation', 'Verify aggregation handles persona deleted during processing', 'personas', 'automated', 'Orphaned records handled gracefully, no foreign key errors')
ON CONFLICT DO NOTHING;

-- ============================================
-- ERROR PROPAGATION & ROLLBACK TESTS
-- Category: integration (system resilience)
-- ============================================

INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('API Error Returns Proper Status', 'Verify all API errors return appropriate HTTP status codes', 'api', 'api', 'Validation errors 400, auth errors 401/403, server errors 500'),
    ('Database Constraint Error Message', 'Verify constraint violations return user-friendly errors', 'api', 'api', 'Error message explains what constraint was violated'),
    ('Transaction Rollback on Partial Failure', 'Verify multi-step operations rollback on any step failure', 'integration', 'automated', 'No partial data persisted after failed transaction'),
    ('Cascade Delete Audit Trail', 'Verify cascading deletes maintain audit trail before deletion', 'integration', 'automated', 'Audit log entries created before ON DELETE CASCADE runs'),
    ('Connection Pool Exhaustion', 'Verify system handles database connection pool exhaustion', 'performance', 'automated', 'Graceful degradation with retry logic, not crash'),
    ('Redis Unavailable Token Operations', 'Verify token operations handle Redis outage gracefully', 'integration', 'automated', 'Fallback to database or queued retry'),
    ('AI Service Timeout Handling', 'Verify conversation analysis handles AI service timeout', 'api', 'api', 'Timeout returns 503, no partial analysis stored'),
    ('Webhook Delivery Failure', 'Verify webhook failures are logged and retried', 'integration', 'automated', 'Failed webhooks queued for retry with backoff')
ON CONFLICT DO NOTHING;

-- ============================================
-- DOCUMENTATION AND COMMENTS
-- ============================================

COMMENT ON TABLE qa_tests IS 'QA test cases including edge cases, race conditions, boundary values, and failure scenarios for comprehensive system validation';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 060: Added edge case and failure condition QA tests';
    RAISE NOTICE 'Test categories: race conditions, NULL handling, boundary values, privacy, age verification, job failures, cross-feature';
END $$;
