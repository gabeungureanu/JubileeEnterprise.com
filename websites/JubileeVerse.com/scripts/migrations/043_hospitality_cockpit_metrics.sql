-- ============================================
-- JubileeVerse Database Schema
-- Migration 043: Hospitality Cockpit Metrics
-- ============================================
-- Creates the data model for the Hospitality Dashboard "Cockpit"
-- using flight-instrument metaphors for situational awareness.
--
-- Gauges:
-- - Attitude Indicator: Overall user mood, trust, hospitality balance
-- - Altimeter: Retention altitude (0-40,000 ft)
-- - Airspeed: Engagement velocity (actions per time unit)
-- - Vertical Speed: Engagement trend direction (climbing/descending)
-- - Heading: Strategic alignment with intended usage
-- - Engine Health: Fuel, Stress, Friction, RPM

-- ============================================
-- DAILY HOSPITALITY METRICS
-- One record per day with all gauge values
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL UNIQUE,

    -- ============================================
    -- ATTITUDE INDICATOR (-90 to +90 degrees)
    -- Nose-up = satisfaction, nose-down = frustration
    -- Roll = segment polarization (-45 to +45)
    -- ============================================
    attitude_pitch DECIMAL(5,2) DEFAULT 0,  -- -90 (crash) to +90 (soaring)
    attitude_roll DECIMAL(5,2) DEFAULT 0,   -- -45 (left skew) to +45 (right skew)
    attitude_stability VARCHAR(20) DEFAULT 'stable' CHECK (attitude_stability IN ('turbulent', 'unstable', 'stable', 'smooth')),

    -- Attitude calculation inputs
    sentiment_score DECIMAL(5,2) DEFAULT 0,         -- -100 to +100 aggregate sentiment
    acceptance_rate DECIMAL(5,2) DEFAULT 0,         -- 0-100% hospitality action acceptance
    negative_keyword_density DECIMAL(5,4) DEFAULT 0, -- 0.0-1.0 negative keywords per message
    drop_off_rate DECIMAL(5,2) DEFAULT 0,           -- 0-100% users leaving after key actions

    -- ============================================
    -- ALTIMETER (0-40,000 feet)
    -- Retention altitude - sustained engagement
    -- ============================================
    altitude_feet INT DEFAULT 0 CHECK (altitude_feet >= 0 AND altitude_feet <= 40000),
    altitude_trend VARCHAR(20) DEFAULT 'level' CHECK (altitude_trend IN ('descending_fast', 'descending', 'level', 'climbing', 'climbing_fast')),

    -- Altitude calculation inputs
    returning_users_7d_pct DECIMAL(5,2) DEFAULT 0,  -- 0-100% 7-day return rate
    returning_users_30d_pct DECIMAL(5,2) DEFAULT 0, -- 0-100% 30-day return rate
    avg_sessions_per_user DECIMAL(5,2) DEFAULT 0,   -- Average sessions per active user
    user_longevity_days DECIMAL(7,2) DEFAULT 0,     -- Average days since first visit for active users

    -- ============================================
    -- AIRSPEED (knots equivalent)
    -- Engagement velocity - actions per time unit
    -- ============================================
    airspeed_knots INT DEFAULT 0 CHECK (airspeed_knots >= 0 AND airspeed_knots <= 500),
    airspeed_zone VARCHAR(20) DEFAULT 'cruise' CHECK (airspeed_zone IN ('stall', 'slow', 'cruise', 'fast', 'overspeed')),

    -- Airspeed calculation inputs
    chat_interactions_per_user DECIMAL(7,2) DEFAULT 0,
    listening_sessions_per_user DECIMAL(5,2) DEFAULT 0,
    prayer_acceptances_per_user DECIMAL(5,2) DEFAULT 0,
    engagement_flows_completed DECIMAL(7,2) DEFAULT 0,
    total_active_users INT DEFAULT 0,

    -- ============================================
    -- VERTICAL SPEED INDICATOR (-2000 to +2000 fpm)
    -- Engagement trend - are we gaining or losing?
    -- ============================================
    vertical_speed_fpm INT DEFAULT 0 CHECK (vertical_speed_fpm >= -2000 AND vertical_speed_fpm <= 2000),
    vertical_trend VARCHAR(20) DEFAULT 'level' CHECK (vertical_trend IN ('dive', 'descent', 'level', 'climb', 'rapid_climb')),

    -- Vertical speed calculation inputs (week-over-week deltas)
    engagement_delta_pct DECIMAL(6,2) DEFAULT 0,    -- % change in engagement score
    retention_delta_pct DECIMAL(6,2) DEFAULT 0,     -- % change in retention
    session_depth_delta_pct DECIMAL(6,2) DEFAULT 0, -- % change in avg session depth

    -- ============================================
    -- HEADING INDICATOR (0-360 degrees)
    -- Strategic alignment - are users on course?
    -- ============================================
    heading_degrees INT DEFAULT 0 CHECK (heading_degrees >= 0 AND heading_degrees <= 360),
    heading_deviation INT DEFAULT 0, -- Degrees off target course

    -- Heading calculation inputs (actual vs target usage distribution)
    usage_prayer_pct DECIMAL(5,2) DEFAULT 0,
    usage_listening_pct DECIMAL(5,2) DEFAULT 0,
    usage_scripture_pct DECIMAL(5,2) DEFAULT 0,
    usage_community_pct DECIMAL(5,2) DEFAULT 0,
    usage_discipleship_pct DECIMAL(5,2) DEFAULT 0,
    usage_other_pct DECIMAL(5,2) DEFAULT 0,

    -- Target distribution (configurable)
    target_prayer_pct DECIMAL(5,2) DEFAULT 25,
    target_listening_pct DECIMAL(5,2) DEFAULT 20,
    target_scripture_pct DECIMAL(5,2) DEFAULT 20,
    target_community_pct DECIMAL(5,2) DEFAULT 20,
    target_discipleship_pct DECIMAL(5,2) DEFAULT 10,
    target_other_pct DECIMAL(5,2) DEFAULT 5,

    -- ============================================
    -- ENGINE HEALTH GAUGES (0-100 scale each)
    -- ============================================

    -- Fuel: Hospitality capacity remaining
    engine_fuel INT DEFAULT 100 CHECK (engine_fuel >= 0 AND engine_fuel <= 100),
    fuel_consumption_rate DECIMAL(5,2) DEFAULT 0,   -- Units per hour
    fuel_warning BOOLEAN DEFAULT FALSE,

    -- Stress: Support pressure level
    engine_stress INT DEFAULT 0 CHECK (engine_stress >= 0 AND engine_stress <= 100),
    unresolved_issues_count INT DEFAULT 0,
    negative_sentiment_spikes INT DEFAULT 0,
    stress_warning BOOLEAN DEFAULT FALSE,

    -- Friction: Workflow resistance
    engine_friction INT DEFAULT 0 CHECK (engine_friction >= 0 AND engine_friction <= 100),
    rework_rate_pct DECIMAL(5,2) DEFAULT 0,         -- % tasks needing rework
    process_inefficiency_score DECIMAL(5,2) DEFAULT 0,
    friction_warning BOOLEAN DEFAULT FALSE,

    -- RPM/Intensity: Concurrency load
    engine_rpm INT DEFAULT 0 CHECK (engine_rpm >= 0 AND engine_rpm <= 100),
    concurrent_listening_rooms INT DEFAULT 0,
    concurrent_ai_sessions INT DEFAULT 0,
    concurrent_community_activity INT DEFAULT 0,
    rpm_warning BOOLEAN DEFAULT FALSE,

    -- ============================================
    -- AGGREGATE HEALTH SCORE
    -- ============================================
    overall_health_score INT DEFAULT 50 CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
    health_status VARCHAR(20) DEFAULT 'nominal' CHECK (health_status IN ('critical', 'warning', 'nominal', 'optimal')),
    alerts_count INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hospitality_daily_metrics_date ON hospitality_daily_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_hospitality_daily_metrics_health ON hospitality_daily_metrics(health_status);
-- Note: Partial index with date filter is not practical here since the filter
-- would need to be updated daily. Instead, use the date index for filtering.
-- CREATE INDEX IF NOT EXISTS idx_hospitality_daily_metrics_week is omitted.

-- ============================================
-- HOSPITALITY ALERTS
-- Active warnings and notifications
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,

    -- Alert classification
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'attitude_nose_down', 'attitude_turbulent', 'attitude_stall',
        'altitude_low', 'altitude_descending_fast',
        'airspeed_stall', 'airspeed_overspeed',
        'vsi_dive',
        'heading_off_course',
        'fuel_low', 'stress_high', 'friction_high', 'rpm_overload'
    )),
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

    -- Alert details
    gauge_name VARCHAR(50) NOT NULL,
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    message TEXT NOT NULL,
    recommendation TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS idx_hospitality_alerts_date ON hospitality_alerts(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_hospitality_alerts_active ON hospitality_alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hospitality_alerts_severity ON hospitality_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_hospitality_alerts_type ON hospitality_alerts(alert_type);

-- ============================================
-- HOSPITALITY COCKPIT CONFIGURATION
-- Configurable thresholds and targets
-- ============================================
CREATE TABLE IF NOT EXISTS hospitality_cockpit_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default configuration
INSERT INTO hospitality_cockpit_config (config_key, config_value, description) VALUES
    ('attitude_thresholds', '{"nose_down_warning": -30, "nose_down_critical": -60, "nose_up_optimal": 45}', 'Pitch thresholds for attitude indicator warnings'),
    ('altitude_thresholds', '{"low_warning": 5000, "low_critical": 2000, "optimal_min": 25000}', 'Altitude thresholds in feet'),
    ('airspeed_thresholds', '{"stall_speed": 50, "slow_speed": 100, "cruise_min": 150, "cruise_max": 300, "overspeed": 400}', 'Airspeed thresholds in knots'),
    ('vsi_thresholds', '{"dive_warning": -1000, "descent_warning": -500, "climb_optimal": 500}', 'Vertical speed thresholds in fpm'),
    ('heading_thresholds', '{"minor_deviation": 15, "major_deviation": 45}', 'Heading deviation thresholds in degrees'),
    ('fuel_thresholds', '{"low_warning": 30, "low_critical": 15}', 'Fuel percentage thresholds'),
    ('stress_thresholds', '{"high_warning": 70, "high_critical": 85}', 'Stress level thresholds'),
    ('friction_thresholds', '{"high_warning": 40, "high_critical": 60}', 'Friction level thresholds'),
    ('rpm_thresholds', '{"overload_warning": 80, "overload_critical": 95}', 'RPM/intensity thresholds'),
    ('target_usage_distribution', '{"prayer": 25, "listening": 20, "scripture": 20, "community": 20, "discipleship": 10, "other": 5}', 'Target feature usage distribution percentages')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for daily metrics
CREATE OR REPLACE FUNCTION update_hospitality_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hospitality_daily_metrics_updated_at ON hospitality_daily_metrics;
CREATE TRIGGER update_hospitality_daily_metrics_updated_at
    BEFORE UPDATE ON hospitality_daily_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_hospitality_metrics_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate attitude from inputs
CREATE OR REPLACE FUNCTION calculate_attitude_pitch(
    p_sentiment DECIMAL,
    p_acceptance_rate DECIMAL,
    p_negative_density DECIMAL,
    p_drop_off_rate DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    pitch DECIMAL;
BEGIN
    -- Weighted calculation:
    -- Sentiment: 40% weight, scale -100 to +100 -> -36 to +36
    -- Acceptance rate: 30% weight, scale 0-100 -> 0 to +27
    -- Negative density: 15% weight (inverted), scale 0-1 -> -13.5 to 0
    -- Drop-off rate: 15% weight (inverted), scale 0-100 -> -13.5 to 0
    pitch := (p_sentiment * 0.36) +
             (p_acceptance_rate * 0.27) -
             (p_negative_density * 100 * 0.135) -
             (p_drop_off_rate * 0.135);

    -- Clamp to -90 to +90
    RETURN GREATEST(-90, LEAST(90, pitch));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate altitude from retention metrics
CREATE OR REPLACE FUNCTION calculate_altitude_feet(
    p_return_7d DECIMAL,
    p_return_30d DECIMAL,
    p_avg_sessions DECIMAL,
    p_longevity DECIMAL
) RETURNS INT AS $$
DECLARE
    altitude INT;
BEGIN
    -- Weighted calculation to 40,000 ft scale:
    -- 7-day return: 30% weight, 0-100 -> 0-12000
    -- 30-day return: 30% weight, 0-100 -> 0-12000
    -- Avg sessions: 20% weight, 0-10+ (capped) -> 0-8000
    -- Longevity: 20% weight, 0-365+ days (capped) -> 0-8000
    altitude := (p_return_7d * 120)::INT +
                (p_return_30d * 120)::INT +
                (LEAST(p_avg_sessions, 10) * 800)::INT +
                (LEAST(p_longevity, 365) / 365 * 8000)::INT;

    RETURN GREATEST(0, LEAST(40000, altitude));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate airspeed from engagement velocity
CREATE OR REPLACE FUNCTION calculate_airspeed_knots(
    p_chat_per_user DECIMAL,
    p_listening_per_user DECIMAL,
    p_prayer_per_user DECIMAL,
    p_flows_completed DECIMAL,
    p_active_users INT
) RETURNS INT AS $$
DECLARE
    raw_velocity DECIMAL;
    airspeed INT;
BEGIN
    -- Calculate raw engagement velocity
    raw_velocity := (p_chat_per_user * 10) +
                    (p_listening_per_user * 25) +
                    (p_prayer_per_user * 15) +
                    (p_flows_completed * 5);

    -- Normalize to active user base and scale to 0-500 knots
    IF p_active_users > 0 THEN
        airspeed := (raw_velocity / GREATEST(1, p_active_users / 100) * 2)::INT;
    ELSE
        airspeed := 0;
    END IF;

    RETURN GREATEST(0, LEAST(500, airspeed));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine airspeed zone
CREATE OR REPLACE FUNCTION get_airspeed_zone(p_airspeed INT) RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE
        WHEN p_airspeed < 50 THEN 'stall'
        WHEN p_airspeed < 100 THEN 'slow'
        WHEN p_airspeed < 300 THEN 'cruise'
        WHEN p_airspeed < 400 THEN 'fast'
        ELSE 'overspeed'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE hospitality_daily_metrics IS 'Daily aggregated metrics for Hospitality Cockpit dashboard - stores all gauge values and calculation inputs';
COMMENT ON TABLE hospitality_alerts IS 'Active and historical alerts generated by the Hospitality Cockpit when gauges exceed thresholds';
COMMENT ON TABLE hospitality_cockpit_config IS 'Configuration for gauge thresholds, targets, and display settings';

COMMENT ON COLUMN hospitality_daily_metrics.attitude_pitch IS 'Attitude indicator pitch: -90 (nose down/frustration) to +90 (nose up/satisfaction)';
COMMENT ON COLUMN hospitality_daily_metrics.attitude_roll IS 'Attitude indicator roll: segment polarization, 0 = balanced';
COMMENT ON COLUMN hospitality_daily_metrics.altitude_feet IS 'Retention altitude: 0-40000 feet representing engagement sustainability';
COMMENT ON COLUMN hospitality_daily_metrics.airspeed_knots IS 'Engagement velocity: rate of meaningful hospitality actions per time unit';
COMMENT ON COLUMN hospitality_daily_metrics.vertical_speed_fpm IS 'Engagement trend: -2000 to +2000 fpm indicating improving or declining engagement';
COMMENT ON COLUMN hospitality_daily_metrics.heading_degrees IS 'Strategic alignment: compass heading indicating direction of user behavior';
COMMENT ON COLUMN hospitality_daily_metrics.engine_fuel IS 'Hospitality capacity remaining (0-100%)';
COMMENT ON COLUMN hospitality_daily_metrics.engine_stress IS 'Support pressure level (0-100%, lower is better)';
COMMENT ON COLUMN hospitality_daily_metrics.engine_friction IS 'Workflow resistance (0-100%, lower is better)';
COMMENT ON COLUMN hospitality_daily_metrics.engine_rpm IS 'Concurrency/intensity load (0-100%)';
