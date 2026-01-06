-- ============================================
-- JubileeVerse Database Schema
-- Migration 041: QA Test Numbering System
-- ============================================
-- Adds a unique, persistent QA test number to each test
-- Format: QA-0800, QA-0801, etc. (starting in 800 series)
-- Numbers are auto-generated and never change once assigned

-- Add qa_number column to qa_tests table
ALTER TABLE qa_tests
ADD COLUMN IF NOT EXISTS qa_number VARCHAR(10) UNIQUE;

-- Create sequence for QA test numbers starting at 800
CREATE SEQUENCE IF NOT EXISTS qa_test_number_seq START WITH 800;

-- Function to generate next QA number
CREATE OR REPLACE FUNCTION generate_qa_number()
RETURNS VARCHAR(10) AS $$
DECLARE
    next_num INTEGER;
BEGIN
    next_num := nextval('qa_test_number_seq');
    RETURN 'QA-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign QA number on insert
CREATE OR REPLACE FUNCTION assign_qa_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qa_number IS NULL THEN
        NEW.qa_number := generate_qa_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assigning QA numbers
DROP TRIGGER IF EXISTS qa_tests_assign_number ON qa_tests;
CREATE TRIGGER qa_tests_assign_number
    BEFORE INSERT ON qa_tests
    FOR EACH ROW
    EXECUTE FUNCTION assign_qa_number();

-- Assign QA numbers to existing tests (deterministic order by created_at, then id)
DO $$
DECLARE
    test_record RECORD;
    qa_num VARCHAR(10);
BEGIN
    FOR test_record IN
        SELECT id FROM qa_tests
        WHERE qa_number IS NULL
        ORDER BY created_at ASC, id ASC
    LOOP
        qa_num := generate_qa_number();
        UPDATE qa_tests SET qa_number = qa_num WHERE id = test_record.id;
        RAISE NOTICE 'Assigned % to test %', qa_num, test_record.id;
    END LOOP;
END $$;

-- Add index on qa_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_qa_tests_qa_number ON qa_tests(qa_number);

-- Add NOT NULL constraint after assigning all numbers
-- (Only if all tests have been assigned numbers)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM qa_tests WHERE qa_number IS NULL) THEN
        ALTER TABLE qa_tests ALTER COLUMN qa_number SET NOT NULL;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN qa_tests.qa_number IS 'Unique persistent QA test identifier (QA-0800 format). Never changes once assigned.';
