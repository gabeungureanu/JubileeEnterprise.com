-- ============================================
-- JubileeVerse Database Schema
-- Migration 038: QA Tests System
-- ============================================
-- Implements a QA testing system integrated with the task workflow.
-- Tests are created when tasks move to Reviewing status and must
-- be executed before task approval.

-- QA Test Status Enum
DO $$ BEGIN
    CREATE TYPE qa_test_status AS ENUM (
        'pending',
        'running',
        'passed',
        'failed',
        'skipped'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- QA Test Category Enum
DO $$ BEGIN
    CREATE TYPE qa_test_category AS ENUM (
        'login',
        'registration',
        'chat',
        'personas',
        'hospitality',
        'payment',
        'billing',
        'admin',
        'translation',
        'community',
        'api',
        'ui',
        'performance',
        'security',
        'integration',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- QA Tests Table - stores individual test cases
CREATE TABLE IF NOT EXISTS qa_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Test identification
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    category qa_test_category NOT NULL DEFAULT 'other',

    -- Test configuration
    test_type VARCHAR(50) DEFAULT 'manual', -- manual, automated, api
    test_script TEXT, -- For automated tests, the script/code to run
    expected_result TEXT,

    -- Associated task (optional - some tests are standalone)
    task_id UUID REFERENCES admin_tasks(id) ON DELETE SET NULL,

    -- Test status and results
    status qa_test_status NOT NULL DEFAULT 'pending',
    last_run_at TIMESTAMPTZ,
    last_result TEXT,
    last_error TEXT,

    -- Execution metadata
    run_count INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,

    -- Ownership
    created_by task_owner DEFAULT 'jubilee',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QA Test Runs Table - stores historical test execution results
CREATE TABLE IF NOT EXISTS qa_test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Test reference
    test_id UUID NOT NULL REFERENCES qa_tests(id) ON DELETE CASCADE,
    task_id UUID REFERENCES admin_tasks(id) ON DELETE SET NULL,

    -- Run details
    status qa_test_status NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Results
    result_summary TEXT,
    result_details JSONB,
    error_message TEXT,
    stack_trace TEXT,

    -- Who ran the test
    executed_by task_owner DEFAULT 'gabriel',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task QA Summary Table - stores aggregated QA status for tasks
CREATE TABLE IF NOT EXISTS task_qa_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,

    -- Aggregated status
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    pending_tests INTEGER DEFAULT 0,

    -- Overall status
    overall_status qa_test_status DEFAULT 'pending',
    last_run_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(task_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qa_tests_task_id ON qa_tests(task_id);
CREATE INDEX IF NOT EXISTS idx_qa_tests_category ON qa_tests(category);
CREATE INDEX IF NOT EXISTS idx_qa_tests_status ON qa_tests(status);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_test_id ON qa_test_runs(test_id);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_task_id ON qa_test_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_created_at ON qa_test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_qa_summary_task_id ON task_qa_summary(task_id);

-- Trigger to update qa_tests.updated_at
CREATE OR REPLACE FUNCTION update_qa_test_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qa_tests_updated_at ON qa_tests;
CREATE TRIGGER qa_tests_updated_at
    BEFORE UPDATE ON qa_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_test_updated_at();

-- Trigger to update task_qa_summary.updated_at
DROP TRIGGER IF EXISTS task_qa_summary_updated_at ON task_qa_summary;
CREATE TRIGGER task_qa_summary_updated_at
    BEFORE UPDATE ON task_qa_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_test_updated_at();

-- Function to update task QA summary when test status changes
CREATE OR REPLACE FUNCTION update_task_qa_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_total INTEGER;
    v_passed INTEGER;
    v_failed INTEGER;
    v_pending INTEGER;
    v_overall qa_test_status;
BEGIN
    -- Get task_id from the test
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);

    IF v_task_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate aggregates
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'passed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COUNT(*) FILTER (WHERE status = 'pending')
    INTO v_total, v_passed, v_failed, v_pending
    FROM qa_tests
    WHERE task_id = v_task_id;

    -- Determine overall status
    IF v_failed > 0 THEN
        v_overall := 'failed';
    ELSIF v_pending > 0 THEN
        v_overall := 'pending';
    ELSIF v_passed = v_total AND v_total > 0 THEN
        v_overall := 'passed';
    ELSE
        v_overall := 'pending';
    END IF;

    -- Upsert summary
    INSERT INTO task_qa_summary (task_id, total_tests, passed_tests, failed_tests, pending_tests, overall_status, last_run_at)
    VALUES (v_task_id, v_total, v_passed, v_failed, v_pending, v_overall, NOW())
    ON CONFLICT (task_id) DO UPDATE SET
        total_tests = v_total,
        passed_tests = v_passed,
        failed_tests = v_failed,
        pending_tests = v_pending,
        overall_status = v_overall,
        last_run_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update summary when test status changes
DROP TRIGGER IF EXISTS update_task_qa_summary_trigger ON qa_tests;
CREATE TRIGGER update_task_qa_summary_trigger
    AFTER INSERT OR UPDATE OF status ON qa_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_task_qa_summary();

-- Insert sample QA tests for common categories
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('User Login Flow', 'Verify user can log in with valid credentials', 'login', 'manual', 'User successfully logged in and redirected to dashboard'),
    ('Invalid Login Rejection', 'Verify invalid credentials are rejected', 'login', 'manual', 'Error message displayed, user not logged in'),
    ('Session Persistence', 'Verify session remains active across page refreshes', 'login', 'manual', 'User stays logged in after refresh'),
    ('User Registration', 'Verify new user registration flow', 'registration', 'manual', 'New user account created successfully'),
    ('Email Verification', 'Verify email verification process works', 'registration', 'manual', 'Email received and verification link works'),
    ('Chat Message Send', 'Verify messages can be sent in chat', 'chat', 'manual', 'Message appears in chat thread'),
    ('Chat Streaming Response', 'Verify AI responses stream properly', 'chat', 'manual', 'Response streams character by character'),
    ('Persona Selection', 'Verify persona can be selected and applied', 'personas', 'manual', 'Selected persona responds with appropriate style'),
    ('Hospitality Page Load', 'Verify hospitality page loads correctly', 'hospitality', 'manual', 'Page loads with all components visible'),
    ('Payment Processing', 'Verify payment can be processed', 'payment', 'manual', 'Payment completes successfully'),
    ('Subscription Update', 'Verify subscription can be changed', 'billing', 'manual', 'Subscription tier updated correctly'),
    ('Admin Dashboard Load', 'Verify admin dashboard loads', 'admin', 'manual', 'Dashboard displays all metrics'),
    ('Task Creation', 'Verify tasks can be created', 'admin', 'manual', 'Task created and appears in queue'),
    ('Translation API', 'Verify translation endpoint works', 'translation', 'api', 'Text translated correctly'),
    ('API Authentication', 'Verify API requires authentication', 'api', 'api', 'Unauthenticated requests rejected'),
    ('Responsive Layout', 'Verify UI responds to viewport changes', 'ui', 'manual', 'Layout adapts correctly to different sizes')
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE qa_tests IS 'QA test cases for validating functionality before task approval';
COMMENT ON TABLE qa_test_runs IS 'Historical record of QA test executions';
COMMENT ON TABLE task_qa_summary IS 'Aggregated QA status for each task';
