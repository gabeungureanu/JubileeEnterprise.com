-- ============================================
-- JubileeVerse Database Schema
-- Migration 017: Billing and Payment Tracking
-- ============================================
-- This migration adds tables for:
-- 1. Payment methods (cards on file)
-- 2. Billing information (name, address, phone, tax ID)
-- 3. Invoices and payment history
-- 4. Payment failure tracking for renewal notifications

-- ============================================
-- Payment Methods Table
-- Stores saved payment methods (credit cards) for users
-- Note: We only store last 4 digits for display, actual card data is in Stripe
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Stripe references
    stripe_payment_method_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),

    -- Card display info (safe to store)
    card_brand VARCHAR(50), -- visa, mastercard, amex, discover, etc.
    card_last_four VARCHAR(4),
    card_exp_month INT CHECK (card_exp_month >= 1 AND card_exp_month <= 12),
    card_exp_year INT,

    -- Card holder info
    cardholder_name VARCHAR(255),

    -- Billing address for this card
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2), -- ISO 3166-1 alpha-2 country code

    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Billing Information Table
-- Stores billing contact info separate from payment methods
-- ============================================
CREATE TABLE IF NOT EXISTS billing_information (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Contact name
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_phone VARCHAR(50),
    phone_country_code VARCHAR(5), -- e.g., +1, +44, +40

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2), -- ISO 3166-1 alpha-2 country code

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Tax IDs Table
-- Stores tax identification numbers for business billing
-- ============================================
CREATE TABLE IF NOT EXISTS billing_tax_ids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Tax ID info
    tax_id_type VARCHAR(50), -- us_ein, eu_vat, gb_vat, au_abn, ca_bn, etc.
    tax_id_value VARCHAR(100),

    -- Stripe reference
    stripe_tax_id VARCHAR(255),

    -- Verification status
    verification_status VARCHAR(30) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'unverified', 'unavailable')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Invoices Table
-- Tracks all invoices generated for subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,

    -- Stripe references
    stripe_invoice_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),

    -- Invoice details
    invoice_number VARCHAR(50),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Amounts (stored in cents for precision)
    subtotal_cents INT DEFAULT 0,
    tax_cents INT DEFAULT 0,
    discount_cents INT DEFAULT 0,
    total_cents INT NOT NULL DEFAULT 0,
    amount_paid_cents INT DEFAULT 0,
    amount_due_cents INT DEFAULT 0,

    -- Currency
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'failed')),

    -- Payment method used
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    card_brand VARCHAR(50),
    card_last_four VARCHAR(4),

    -- Description
    description TEXT,

    -- Billing period this invoice covers
    period_start DATE,
    period_end DATE,

    -- PDF URL (from Stripe)
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,

    -- Failure tracking
    last_payment_error TEXT,
    payment_attempt_count INT DEFAULT 0,
    next_payment_attempt_at TIMESTAMPTZ,

    -- Timestamps
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Invoice Line Items Table
-- Individual line items on invoices
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    -- Stripe reference
    stripe_line_item_id VARCHAR(255),

    -- Item details
    description TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_amount_cents INT NOT NULL,
    total_cents INT NOT NULL,

    -- For subscription items
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    period_start DATE,
    period_end DATE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Payment Failure Notifications Table
-- Tracks payment failures and notification status
-- ============================================
CREATE TABLE IF NOT EXISTS payment_failure_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

    -- Failure details
    failure_reason VARCHAR(255),
    failure_code VARCHAR(50),
    failure_message TEXT,

    -- Grace period
    grace_period_ends_at TIMESTAMPTZ, -- Date when access will be revoked

    -- Notification tracking
    notification_shown_at TIMESTAMPTZ, -- Last time popup was shown
    notification_dismissed_at TIMESTAMPTZ, -- When user dismissed the popup
    notification_count INT DEFAULT 0, -- How many times shown

    -- Email notification tracking
    email_sent_at TIMESTAMPTZ,
    email_reminder_count INT DEFAULT 0,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_type VARCHAR(30) CHECK (resolution_type IN ('payment_succeeded', 'plan_downgraded', 'subscription_cancelled', 'manual_override')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Add fields to user_subscriptions table
-- ============================================
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_payment_amount_cents INT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_failure_count INT DEFAULT 0;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- ============================================
-- Add billing check fields to users table
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_check_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_notification_dismissed_at TIMESTAMPTZ;

-- ============================================
-- Indexes
-- ============================================

-- Payment methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);

-- Billing information indexes
CREATE INDEX IF NOT EXISTS idx_billing_info_user ON billing_information(user_id);

-- Tax IDs indexes
CREATE INDEX IF NOT EXISTS idx_billing_tax_ids_user ON billing_tax_ids(user_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_failed ON invoices(user_id) WHERE status = 'failed';

-- Invoice line items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- Payment failure notifications indexes
CREATE INDEX IF NOT EXISTS idx_payment_failures_user ON payment_failure_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_active ON payment_failure_notifications(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_failures_grace ON payment_failure_notifications(grace_period_ends_at) WHERE is_active = TRUE;

-- ============================================
-- Triggers
-- ============================================

-- Update timestamps trigger for payment_methods
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for billing_information
CREATE TRIGGER update_billing_information_updated_at
    BEFORE UPDATE ON billing_information
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for billing_tax_ids
CREATE TRIGGER update_billing_tax_ids_updated_at
    BEFORE UPDATE ON billing_tax_ids
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for invoices
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for payment_failure_notifications
CREATE TRIGGER update_payment_failure_notifications_updated_at
    BEFORE UPDATE ON payment_failure_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Function to check for active payment failures
-- Returns true if user has an active payment failure that needs attention
-- ============================================
CREATE OR REPLACE FUNCTION check_payment_failure(p_user_id UUID)
RETURNS TABLE (
    has_failure BOOLEAN,
    failure_id UUID,
    grace_period_ends_at TIMESTAMPTZ,
    days_remaining INT,
    plan_name VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as has_failure,
        pfn.id as failure_id,
        pfn.grace_period_ends_at,
        GREATEST(0, EXTRACT(DAY FROM pfn.grace_period_ends_at - NOW())::INT) as days_remaining,
        sp.name as plan_name
    FROM payment_failure_notifications pfn
    JOIN user_subscriptions us ON us.id = pfn.subscription_id
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE pfn.user_id = p_user_id
    AND pfn.is_active = TRUE
    AND pfn.resolved_at IS NULL
    LIMIT 1;

    -- If no rows returned, return a "no failure" row
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, NULL::INT, NULL::VARCHAR(50);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to record payment failure notification shown
-- ============================================
CREATE OR REPLACE FUNCTION record_payment_notification_shown(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE payment_failure_notifications
    SET notification_shown_at = NOW(),
        notification_count = notification_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND is_active = TRUE;

    UPDATE users
    SET last_payment_check_date = CURRENT_DATE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to dismiss payment notification for the day
-- ============================================
CREATE OR REPLACE FUNCTION dismiss_payment_notification(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE payment_failure_notifications
    SET notification_dismissed_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND is_active = TRUE;

    UPDATE users
    SET payment_notification_dismissed_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- View for easy subscription status check with billing info
-- ============================================
CREATE OR REPLACE VIEW user_subscription_status AS
SELECT
    u.id as user_id,
    u.email,
    u.display_name,
    us.id as subscription_id,
    us.status as subscription_status,
    us.billing_period,
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.tier_level,
    sp.price_monthly_cents,
    sp.price_yearly_cents,
    us.current_period_start,
    us.current_period_end,
    us.next_billing_date,
    us.payment_failed_at,
    us.payment_failure_count,
    us.grace_period_ends_at,
    pm.card_brand,
    pm.card_last_four,
    pm.card_exp_month,
    pm.card_exp_year,
    pfn.id as active_failure_id,
    pfn.grace_period_ends_at as failure_grace_ends,
    CASE
        WHEN pfn.is_active = TRUE THEN TRUE
        ELSE FALSE
    END as has_payment_failure
FROM users u
LEFT JOIN user_subscriptions us ON us.user_id = u.id
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
LEFT JOIN payment_methods pm ON pm.id = us.payment_method_id
LEFT JOIN payment_failure_notifications pfn ON pfn.user_id = u.id AND pfn.is_active = TRUE;
