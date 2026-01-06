-- ============================================
-- JubileeVerse Database Schema
-- Migration 061: QA Manual Hours and Auto-Remediation
-- ============================================
-- Implements:
-- - manual_hours column for estimating human testing effort
-- - auto_fix_available flag for tests with automated remediation
-- - auto_fix_script column for remediation logic
-- - Extended test status to include 'fixed' state
-- - Test run tracking for auto-fixed issues
-- ============================================

-- ============================================
-- EXTEND qa_test_status ENUM
-- ============================================
-- Add 'fixed' status for tests that were auto-remediated
DO $$ BEGIN
    ALTER TYPE qa_test_status ADD VALUE IF NOT EXISTS 'fixed';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- EXTEND qa_tests TABLE
-- ============================================

-- Add manual_hours column - estimated hours for human to execute this test
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_tests' AND column_name = 'manual_hours'
    ) THEN
        ALTER TABLE qa_tests ADD COLUMN manual_hours DECIMAL(5,2) DEFAULT 0.25;
        COMMENT ON COLUMN qa_tests.manual_hours IS 'Estimated hours for a human to execute this test manually';
    END IF;
END $$;

-- Add auto_fix_available flag - indicates if test has automated remediation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_tests' AND column_name = 'auto_fix_available'
    ) THEN
        ALTER TABLE qa_tests ADD COLUMN auto_fix_available BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN qa_tests.auto_fix_available IS 'TRUE if this test has automated remediation capability';
    END IF;
END $$;

-- Add auto_fix_script column - the remediation logic/script
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_tests' AND column_name = 'auto_fix_script'
    ) THEN
        ALTER TABLE qa_tests ADD COLUMN auto_fix_script TEXT;
        COMMENT ON COLUMN qa_tests.auto_fix_script IS 'Script or configuration for automated remediation';
    END IF;
END $$;

-- Add auto_fix_type column - categorizes the type of fix
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_tests' AND column_name = 'auto_fix_type'
    ) THEN
        ALTER TABLE qa_tests ADD COLUMN auto_fix_type VARCHAR(50);
        COMMENT ON COLUMN qa_tests.auto_fix_type IS 'Type of auto-fix: schema, config, data, cache, permission, constraint';
    END IF;
END $$;

-- ============================================
-- EXTEND qa_test_runs TABLE
-- ============================================

-- Add auto_fixed flag to test runs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_test_runs' AND column_name = 'auto_fixed'
    ) THEN
        ALTER TABLE qa_test_runs ADD COLUMN auto_fixed BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN qa_test_runs.auto_fixed IS 'TRUE if issue was automatically remediated during this run';
    END IF;
END $$;

-- Add fix_description column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_test_runs' AND column_name = 'fix_description'
    ) THEN
        ALTER TABLE qa_test_runs ADD COLUMN fix_description TEXT;
        COMMENT ON COLUMN qa_test_runs.fix_description IS 'Description of the automated fix applied';
    END IF;
END $$;

-- Add fix_details JSONB for structured fix info
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_test_runs' AND column_name = 'fix_details'
    ) THEN
        ALTER TABLE qa_test_runs ADD COLUMN fix_details JSONB;
        COMMENT ON COLUMN qa_test_runs.fix_details IS 'Structured details about the automated fix: {fix_type, before_state, after_state, commands_run}';
    END IF;
END $$;

-- ============================================
-- POPULATE manual_hours ESTIMATES
-- Based on test_type and category complexity
-- ============================================

-- Base estimates by test_type:
-- manual: 0.25-0.5 hours (simple) to 1.0 hours (complex workflow)
-- api: 0.15-0.25 hours (endpoint check) to 0.5 hours (multi-step)
-- automated: 0.1-0.2 hours (run script) to 0.5 hours (with verification)

-- Update manual tests - base on category complexity
UPDATE qa_tests SET manual_hours =
    CASE
        -- High complexity categories (multi-step workflows, setup required)
        WHEN category IN ('security', 'integration', 'billing', 'payment') THEN 0.5
        -- Medium complexity (some setup, multiple validations)
        WHEN category IN ('admin', 'registration', 'login', 'personas') THEN 0.35
        -- Standard complexity (straightforward checks)
        WHEN category IN ('api', 'chat', 'translation', 'community') THEN 0.25
        -- UI/visual tests (quick visual verification)
        WHEN category IN ('ui', 'performance', 'hospitality') THEN 0.2
        -- Default
        ELSE 0.25
    END
WHERE test_type = 'manual' AND (manual_hours IS NULL OR manual_hours = 0.25);

-- Update API tests - generally faster but some require setup
UPDATE qa_tests SET manual_hours =
    CASE
        -- Security/auth API tests require more verification
        WHEN category = 'security' THEN 0.35
        -- Integration tests often involve multiple endpoints
        WHEN category = 'integration' THEN 0.4
        -- Standard API checks
        ELSE 0.2
    END
WHERE test_type = 'api' AND (manual_hours IS NULL OR manual_hours = 0.25);

-- Update automated tests - still need human to run and verify
UPDATE qa_tests SET manual_hours =
    CASE
        -- Complex automated tests (database, concurrency)
        WHEN category IN ('security', 'integration', 'performance') THEN 0.25
        -- Standard automated tests
        ELSE 0.15
    END
WHERE test_type = 'automated' AND (manual_hours IS NULL OR manual_hours = 0.25);

-- Special adjustments for specific test patterns
-- Race condition tests are very time-consuming manually
UPDATE qa_tests SET manual_hours = 0.75
WHERE test_name ILIKE '%race%' OR test_name ILIKE '%concurrent%';

-- Edge case tests require careful setup
UPDATE qa_tests SET manual_hours = 0.5
WHERE test_name ILIKE '%edge%' OR test_name ILIKE '%boundary%';

-- Privacy and compliance tests require careful verification
UPDATE qa_tests SET manual_hours = 0.6
WHERE test_name ILIKE '%privacy%' OR test_name ILIKE '%consent%' OR test_name ILIKE '%compliance%';

-- Age verification tests are critical and need thorough checking
UPDATE qa_tests SET manual_hours = 0.5
WHERE test_name ILIKE '%age%verif%' OR test_name ILIKE '%age%attest%';

-- Token/billing tests require transaction verification
UPDATE qa_tests SET manual_hours = 0.45
WHERE test_name ILIKE '%token%' AND category = 'billing';

-- ============================================
-- CONFIGURE AUTO-FIX CAPABILITY
-- Mark tests that can be auto-remediated
-- ============================================

-- Schema/constraint tests - can auto-fix by running migrations
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'schema',
    auto_fix_script = 'RUN_PENDING_MIGRATIONS'
WHERE test_name ILIKE '%table%exists%'
   OR test_name ILIKE '%column%exists%'
   OR test_name ILIKE '%constraint%';

-- Configuration tests - can auto-fix by setting defaults
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'config',
    auto_fix_script = 'APPLY_DEFAULT_CONFIG'
WHERE test_name ILIKE '%configured%'
   OR test_name ILIKE '%threshold%configured%';

-- Index tests - can auto-create missing indexes
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'schema',
    auto_fix_script = 'CREATE_MISSING_INDEXES'
WHERE test_name ILIKE '%index%' AND test_name ILIKE '%performance%';

-- Cache tests - can auto-clear and rebuild
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'cache',
    auto_fix_script = 'CLEAR_AND_REBUILD_CACHE'
WHERE test_name ILIKE '%cache%';

-- Permission tests - can auto-fix role assignments
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'permission',
    auto_fix_script = 'APPLY_ROLE_PERMISSIONS'
WHERE test_name ILIKE '%permission%' AND test_type = 'automated';

-- Seed data tests - can auto-insert missing data
UPDATE qa_tests SET
    auto_fix_available = TRUE,
    auto_fix_type = 'data',
    auto_fix_script = 'INSERT_SEED_DATA'
WHERE test_name ILIKE '%seed%' OR test_name ILIKE '%default%entries%';

-- ============================================
-- UPDATE SUMMARY TRIGGER TO HANDLE 'fixed' STATUS
-- ============================================

CREATE OR REPLACE FUNCTION update_task_qa_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_total INTEGER;
    v_passed INTEGER;
    v_failed INTEGER;
    v_pending INTEGER;
    v_fixed INTEGER;
    v_overall qa_test_status;
BEGIN
    -- Get task_id from the test
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);

    IF v_task_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate aggregates including fixed status
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'passed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'fixed')
    INTO v_total, v_passed, v_failed, v_pending, v_fixed
    FROM qa_tests
    WHERE task_id = v_task_id;

    -- Determine overall status
    -- 'fixed' counts as passed for overall status
    IF v_failed > 0 THEN
        v_overall := 'failed';
    ELSIF v_pending > 0 THEN
        v_overall := 'pending';
    ELSIF (v_passed + v_fixed) = v_total AND v_total > 0 THEN
        v_overall := 'passed';
    ELSE
        v_overall := 'pending';
    END IF;

    -- Upsert summary (note: passed_tests now includes fixed)
    INSERT INTO task_qa_summary (task_id, total_tests, passed_tests, failed_tests, pending_tests, overall_status, last_run_at)
    VALUES (v_task_id, v_total, v_passed + v_fixed, v_failed, v_pending, v_overall, NOW())
    ON CONFLICT (task_id) DO UPDATE SET
        total_tests = v_total,
        passed_tests = v_passed + v_fixed,
        failed_tests = v_failed,
        pending_tests = v_pending,
        overall_status = v_overall,
        last_run_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE VIEW FOR MANUAL HOURS SUMMARY
-- ============================================

CREATE OR REPLACE VIEW v_qa_manual_hours_summary AS
SELECT
    COUNT(*) as total_tests,
    ROUND(SUM(manual_hours)::NUMERIC, 2) as total_manual_hours,
    ROUND(SUM(manual_hours) / 8, 1) as total_manual_days,
    ROUND(SUM(manual_hours) / 40, 1) as total_manual_weeks,
    COUNT(*) FILTER (WHERE auto_fix_available = TRUE) as auto_fixable_tests,
    ROUND(SUM(CASE WHEN auto_fix_available THEN manual_hours ELSE 0 END)::NUMERIC, 2) as auto_fixable_hours
FROM qa_tests;

-- Category breakdown
CREATE OR REPLACE VIEW v_qa_manual_hours_by_category AS
SELECT
    category,
    COUNT(*) as test_count,
    ROUND(SUM(manual_hours)::NUMERIC, 2) as total_hours,
    ROUND(AVG(manual_hours)::NUMERIC, 2) as avg_hours_per_test,
    COUNT(*) FILTER (WHERE auto_fix_available = TRUE) as auto_fixable_count
FROM qa_tests
GROUP BY category
ORDER BY total_hours DESC;

-- ============================================
-- CREATE FUNCTION TO FORMAT HOURS AS HUMAN-READABLE
-- ============================================

CREATE OR REPLACE FUNCTION format_hours_human_readable(hours DECIMAL)
RETURNS TEXT AS $$
DECLARE
    weeks INTEGER;
    days INTEGER;
    remaining_hours DECIMAL;
    result TEXT := '';
BEGIN
    IF hours IS NULL OR hours <= 0 THEN
        RETURN '0 hours';
    END IF;

    -- Calculate weeks (40 hours = 1 week)
    IF hours >= 40 THEN
        weeks := FLOOR(hours / 40);
        hours := hours - (weeks * 40);

        IF weeks = 1 THEN
            result := '1 week';
        ELSE
            result := weeks || ' weeks';
        END IF;
    END IF;

    -- Calculate days (8 hours = 1 day)
    IF hours >= 8 THEN
        days := FLOOR(hours / 8);
        hours := hours - (days * 8);

        IF result != '' THEN
            result := result || ' ';
        END IF;

        IF days = 1 THEN
            result := result || '1 day';
        ELSE
            result := result || days || ' days';
        END IF;
    END IF;

    -- Remaining hours
    IF hours > 0 THEN
        IF result != '' THEN
            result := result || ' ';
        END IF;

        IF hours = 1 THEN
            result := result || '1 hour';
        ELSE
            result := result || ROUND(hours, 1) || ' hours';
        END IF;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_qa_tests_auto_fix ON qa_tests(auto_fix_available) WHERE auto_fix_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_qa_tests_manual_hours ON qa_tests(manual_hours);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_auto_fixed ON qa_test_runs(auto_fixed) WHERE auto_fixed = TRUE;

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON TABLE qa_tests IS 'QA test cases with manual effort estimates and auto-remediation capabilities';
COMMENT ON VIEW v_qa_manual_hours_summary IS 'Summary of total manual testing hours saved by automation';
COMMENT ON VIEW v_qa_manual_hours_by_category IS 'Manual testing hours breakdown by category';
COMMENT ON FUNCTION format_hours_human_readable IS 'Converts decimal hours to human-readable format (weeks, days, hours)';

-- Log migration completion
DO $$
DECLARE
    v_total_hours DECIMAL;
    v_formatted TEXT;
BEGIN
    SELECT SUM(manual_hours) INTO v_total_hours FROM qa_tests;
    SELECT format_hours_human_readable(v_total_hours) INTO v_formatted;

    RAISE NOTICE 'Migration 061: Added manual_hours and auto-fix columns to QA system';
    RAISE NOTICE 'Total manual testing effort: % hours (approximately %)', v_total_hours, v_formatted;
END $$;
