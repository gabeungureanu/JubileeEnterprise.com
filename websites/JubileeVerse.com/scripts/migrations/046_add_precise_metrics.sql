-- ============================================
-- JubileeVerse Database Schema
-- Migration 046: Add Precise Metrics Columns
-- ============================================
-- Adds columns for precise, auditable metrics:
-- - value_delivered_hours (VDH) - formerly HEH Delivered
-- - actual_hours_worked (AHW) - from work session logs
-- - ai_optimization_pct - (VDH / AHW) * 100
-- - wph_calculated - precise WPH = VDH / AHW
-- - calculation_timestamp - when metrics were last computed

-- Add value_delivered_hours column (VDH)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'value_delivered_hours'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN value_delivered_hours DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN daily_progress_metrics.value_delivered_hours IS 'Value Delivered Hours (VDH) - total human-equivalent hours of work value delivered';

        -- Populate from existing rolling_7day_heh
        UPDATE daily_progress_metrics
        SET value_delivered_hours = rolling_7day_heh
        WHERE value_delivered_hours = 0 AND rolling_7day_heh > 0;
    END IF;
END $$;

-- Add actual_hours_worked column (AHW)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'actual_hours_worked'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN actual_hours_worked DECIMAL(8,2) DEFAULT 0;
        COMMENT ON COLUMN daily_progress_metrics.actual_hours_worked IS 'Actual Hours Worked (AHW) - real clock hours from work session logs';

        -- Populate from weekly_hours_consumed (estimate for existing data)
        UPDATE daily_progress_metrics
        SET actual_hours_worked = weekly_hours_consumed
        WHERE actual_hours_worked = 0 AND weekly_hours_consumed > 0;
    END IF;
END $$;

-- Add ai_optimization_pct column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'ai_optimization_pct'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN ai_optimization_pct DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN daily_progress_metrics.ai_optimization_pct IS 'AI Optimization % = (VDH / AHW) * 100';

        -- Calculate for existing data
        UPDATE daily_progress_metrics
        SET ai_optimization_pct = CASE
            WHEN actual_hours_worked > 0 THEN (value_delivered_hours / actual_hours_worked) * 100
            WHEN weekly_hours_consumed > 0 THEN (rolling_7day_heh / weekly_hours_consumed) * 100
            ELSE 0
        END
        WHERE ai_optimization_pct = 0;
    END IF;
END $$;

-- Add wph_calculated column (precise WPH)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'wph_calculated'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN wph_calculated DECIMAL(10,4) DEFAULT 0;
        COMMENT ON COLUMN daily_progress_metrics.wph_calculated IS 'Work Per Hour = VDH / AHW (precise, 4 decimal places)';

        -- Calculate for existing data
        UPDATE daily_progress_metrics
        SET wph_calculated = CASE
            WHEN actual_hours_worked > 0 THEN value_delivered_hours / actual_hours_worked
            WHEN weekly_hours_consumed > 0 THEN rolling_7day_heh / weekly_hours_consumed
            ELSE velocity_wph
        END
        WHERE wph_calculated = 0;
    END IF;
END $$;

-- Add calculation_timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'calculation_timestamp'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN calculation_timestamp TIMESTAMPTZ DEFAULT NOW();
        COMMENT ON COLUMN daily_progress_metrics.calculation_timestamp IS 'Timestamp of when metrics were last computed for auditability';
    END IF;
END $$;

-- Add value_delivered_dollars column (precise, not formatted)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_progress_metrics' AND column_name = 'value_delivered_dollars'
    ) THEN
        ALTER TABLE daily_progress_metrics ADD COLUMN value_delivered_dollars DECIMAL(12,2) DEFAULT 0;
        COMMENT ON COLUMN daily_progress_metrics.value_delivered_dollars IS 'Value Delivered ($) = VDH * $150/hr (precise dollar amount)';

        -- Calculate for existing data
        UPDATE daily_progress_metrics
        SET value_delivered_dollars = value_delivered_hours * 150
        WHERE value_delivered_dollars = 0 AND value_delivered_hours > 0;
    END IF;
END $$;

-- Create index for calculation_timestamp queries
CREATE INDEX IF NOT EXISTS idx_daily_progress_calculation_ts
ON daily_progress_metrics(calculation_timestamp DESC);

-- Create index for WPH queries
CREATE INDEX IF NOT EXISTS idx_daily_progress_wph_calculated
ON daily_progress_metrics(wph_calculated DESC);

-- ============================================
-- METRIC CALCULATION AUDIT LOG
-- Tracks every metric computation for auditability
-- ============================================
CREATE TABLE IF NOT EXISTS metric_calculation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What was calculated
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,

    -- Formula used
    formula TEXT NOT NULL,

    -- Input values
    input_values JSONB DEFAULT '{}',
    -- Example: {"vdh": 2500, "ahw": 32, "hourly_rate": 150}

    -- Source data reference
    source_table VARCHAR(100),
    source_query TEXT,

    -- Computation context
    computed_for_date DATE,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(100),
    verified_at TIMESTAMPTZ,

    -- Notes
    notes TEXT
);

-- Create indexes for metric calculation log
CREATE INDEX IF NOT EXISTS idx_metric_calc_log_name ON metric_calculation_log(metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_calc_log_date ON metric_calculation_log(computed_for_date);
CREATE INDEX IF NOT EXISTS idx_metric_calc_log_computed ON metric_calculation_log(computed_at DESC);

-- ============================================
-- STORED FUNCTION: Record Precise Metrics
-- ============================================
CREATE OR REPLACE FUNCTION record_precise_metrics(
    p_metric_date DATE DEFAULT CURRENT_DATE,
    p_value_delivered_hours DECIMAL DEFAULT 0,
    p_actual_hours_worked DECIMAL DEFAULT 0,
    p_hourly_rate DECIMAL DEFAULT 150
)
RETURNS TABLE (
    wph DECIMAL,
    ai_optimization_pct DECIMAL,
    value_delivered_dollars DECIMAL
) AS $$
DECLARE
    v_wph DECIMAL;
    v_ai_opt DECIMAL;
    v_value_dollars DECIMAL;
BEGIN
    -- Calculate WPH = VDH / AHW
    IF p_actual_hours_worked > 0 THEN
        v_wph := p_value_delivered_hours / p_actual_hours_worked;
    ELSE
        v_wph := 0;
    END IF;

    -- Calculate AI Optimization % = (VDH / AHW) * 100
    v_ai_opt := v_wph * 100;

    -- Calculate Value Delivered ($) = VDH * hourly_rate
    v_value_dollars := p_value_delivered_hours * p_hourly_rate;

    -- Update daily_progress_metrics
    UPDATE daily_progress_metrics SET
        value_delivered_hours = p_value_delivered_hours,
        actual_hours_worked = p_actual_hours_worked,
        wph_calculated = v_wph,
        ai_optimization_pct = v_ai_opt,
        value_delivered_dollars = v_value_dollars,
        calculation_timestamp = NOW()
    WHERE metric_date = p_metric_date;

    -- Log the calculation
    INSERT INTO metric_calculation_log (
        metric_name, metric_value, formula, input_values,
        source_table, computed_for_date
    ) VALUES
    ('wph', v_wph, 'WPH = VDH / AHW',
     jsonb_build_object('vdh', p_value_delivered_hours, 'ahw', p_actual_hours_worked),
     'daily_progress_metrics', p_metric_date),
    ('ai_optimization_pct', v_ai_opt, 'AI_OPT% = (VDH / AHW) * 100',
     jsonb_build_object('vdh', p_value_delivered_hours, 'ahw', p_actual_hours_worked),
     'daily_progress_metrics', p_metric_date),
    ('value_delivered_dollars', v_value_dollars, 'VALUE($) = VDH * $150',
     jsonb_build_object('vdh', p_value_delivered_hours, 'hourly_rate', p_hourly_rate),
     'daily_progress_metrics', p_metric_date);

    RETURN QUERY SELECT v_wph, v_ai_opt, v_value_dollars;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE metric_calculation_log IS 'Audit log of all metric calculations for transparency and verification';
COMMENT ON FUNCTION record_precise_metrics IS 'Records precise metrics with full formula audit trail';
