-- Migration 058: Multi-User Plan Infrastructure
-- Supports shared token pools, age compliance, community scoping, and auditing
--
-- Key concepts:
-- - Primary subscriber owns the plan and billing
-- - Associated users share tokens but have independent accounts
-- - Default community scoped to plan membership
-- - Age verification required for all associated users
-- - Audit logging for sensitive data access

-- ============================================
-- PLAN TYPES AND LIMITS
-- ============================================

-- Plan type enum with user limits
DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('visitor', 'standard', 'ministry', 'business', 'enterprise');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plan limits configuration table
CREATE TABLE IF NOT EXISTS plan_type_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type VARCHAR(50) NOT NULL UNIQUE,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_associated_users INTEGER NOT NULL DEFAULT 0,
  monthly_token_limit INTEGER NOT NULL DEFAULT 0,
  can_purchase_additional_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  has_default_community BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plan limits
INSERT INTO plan_type_limits (plan_type, max_users, max_associated_users, monthly_token_limit, can_purchase_additional_tokens, has_default_community, description)
VALUES
  ('visitor', 1, 0, 1000, FALSE, FALSE, 'Free visitor with limited tokens'),
  ('standard', 1, 0, 50000, TRUE, FALSE, 'Individual subscriber plan'),
  ('ministry', 5, 4, 200000, TRUE, TRUE, 'Ministry plan with up to 5 users (1 primary + 4 associated)'),
  ('business', 10, 9, 500000, TRUE, TRUE, 'Business plan with up to 10 users (1 primary + 9 associated)'),
  ('enterprise', 100, 99, 2000000, TRUE, TRUE, 'Enterprise plan with custom limits')
ON CONFLICT (plan_type) DO UPDATE SET
  max_users = EXCLUDED.max_users,
  max_associated_users = EXCLUDED.max_associated_users,
  monthly_token_limit = EXCLUDED.monthly_token_limit,
  can_purchase_additional_tokens = EXCLUDED.can_purchase_additional_tokens,
  has_default_community = EXCLUDED.has_default_community,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================
-- SHARED TOKEN POOLS
-- ============================================

-- Shared token pool for plan-level token management
CREATE TABLE IF NOT EXISTS shared_token_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan ownership
  primary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL DEFAULT 'standard',

  -- Token balances
  monthly_allocation INTEGER NOT NULL DEFAULT 0,
  current_balance INTEGER NOT NULL DEFAULT 0,
  tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
  additional_tokens_purchased INTEGER NOT NULL DEFAULT 0,

  -- Period tracking
  period_start TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
  period_end TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_balance CHECK (current_balance >= 0),
  CONSTRAINT positive_allocation CHECK (monthly_allocation >= 0)
);

-- Index for fast lookup by primary user
CREATE INDEX IF NOT EXISTS idx_token_pools_primary_user ON shared_token_pools(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_token_pools_active ON shared_token_pools(is_active) WHERE is_active = TRUE;

-- Token purchase history
CREATE TABLE IF NOT EXISTS token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES shared_token_pools(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES users(id),
  tokens_purchased INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_method_id UUID REFERENCES payment_methods(id),
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT positive_tokens CHECK (tokens_purchased > 0),
  CONSTRAINT positive_amount CHECK (amount_paid_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_token_purchases_pool ON token_purchases(pool_id);

-- Token usage tracking per user (for analytics, not enforcement)
CREATE TABLE IF NOT EXISTS token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES shared_token_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  tokens_used INTEGER NOT NULL,
  usage_type VARCHAR(50) NOT NULL DEFAULT 'chat', -- chat, analysis, translation, etc.
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_pool ON token_usage_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage_log(created_at);

-- ============================================
-- PLAN MEMBERSHIP
-- ============================================

-- Plan membership status enum
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('pending', 'active', 'suspended', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plan membership role enum
DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('primary', 'associated', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plan memberships table
CREATE TABLE IF NOT EXISTS plan_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pool and user reference
  pool_id UUID NOT NULL REFERENCES shared_token_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role and status
  role VARCHAR(20) NOT NULL DEFAULT 'associated',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Age verification (required for associated users)
  age_verified BOOLEAN NOT NULL DEFAULT FALSE,
  age_verified_at TIMESTAMPTZ,
  age_verified_by UUID REFERENCES users(id),
  age_verification_method VARCHAR(50), -- 'subscriber_attestation', 'document', etc.

  -- Terms acceptance
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  terms_version VARCHAR(20),

  -- Invitation tracking
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,

  -- Usage tracking (per-user within pool)
  tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one membership per user per pool
  CONSTRAINT unique_user_pool UNIQUE (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_pool ON plan_memberships(pool_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON plan_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON plan_memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_active ON plan_memberships(status) WHERE status = 'active';

-- ============================================
-- PLAN INVITATIONS
-- ============================================

-- Invitation status enum
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plan invitations table
CREATE TABLE IF NOT EXISTS plan_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pool reference
  pool_id UUID NOT NULL REFERENCES shared_token_pools(id) ON DELETE CASCADE,

  -- Invitation details
  email VARCHAR(255) NOT NULL,
  invitation_token VARCHAR(255) NOT NULL UNIQUE,

  -- Inviter details
  invited_by UUID NOT NULL REFERENCES users(id),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Age compliance acknowledgment by inviter
  inviter_age_attestation BOOLEAN NOT NULL DEFAULT FALSE,
  inviter_age_attestation_text TEXT, -- The actual text they agreed to
  inviter_age_attestation_at TIMESTAMPTZ,

  -- Response tracking
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

  -- Custom message from inviter
  personal_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_pool ON plan_invitations(pool_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON plan_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON plan_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON plan_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_pending ON plan_invitations(status, expires_at)
  WHERE status = 'pending';

-- ============================================
-- DEFAULT COMMUNITY (PLAN-SCOPED)
-- ============================================

-- Link between token pools and their default communities
CREATE TABLE IF NOT EXISTS plan_default_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES shared_token_pools(id) ON DELETE CASCADE UNIQUE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_communities_pool ON plan_default_communities(pool_id);
CREATE INDEX IF NOT EXISTS idx_plan_communities_community ON plan_default_communities(community_id);

-- ============================================
-- USER TABLE EXTENSIONS
-- ============================================

-- Add plan-related fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'visitor';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_plan_primary BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_pool_id UUID REFERENCES shared_token_pools(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_age_acknowledged BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_age_acknowledged_at TIMESTAMPTZ;

-- Index for finding primary plan owners
CREATE INDEX IF NOT EXISTS idx_users_plan_primary ON users(is_plan_primary) WHERE is_plan_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users(plan_type);

-- ============================================
-- SENSITIVE DATA AUDIT LOGGING
-- ============================================

-- Audit action types
DO $$ BEGIN
  CREATE TYPE audit_action_type AS ENUM (
    'view_user_profile',
    'view_user_demographics',
    'view_user_analytics',
    'view_associated_accounts',
    'view_plan_members',
    'view_safety_flags',
    'view_admin_alerts',
    'export_user_data',
    'modify_user_data',
    'access_conversation_content',
    'query_sensitive_report'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Sensitive data access audit log
CREATE TABLE IF NOT EXISTS sensitive_data_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who accessed
  accessor_user_id UUID NOT NULL REFERENCES users(id),
  accessor_role VARCHAR(50) NOT NULL,
  accessor_ip_address INET,
  accessor_user_agent TEXT,

  -- What was accessed
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'user', 'community', 'plan', 'conversation', etc.
  target_id UUID, -- ID of the target entity
  target_user_id UUID REFERENCES users(id), -- If target is a user or user-owned data
  target_community_id UUID REFERENCES communities(id), -- If target is community-scoped

  -- Context
  access_context TEXT, -- Why access was requested/granted
  query_parameters JSONB, -- Any filters or parameters used
  result_count INTEGER, -- Number of records returned

  -- Access control
  access_granted BOOLEAN NOT NULL DEFAULT TRUE,
  denial_reason TEXT,

  -- Immutable timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- This table should not be modifiable by application users
  -- Only database administrators should have write access
  CONSTRAINT audit_immutable CHECK (TRUE) -- Placeholder for row-level security
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_accessor ON sensitive_data_audit_log(accessor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON sensitive_data_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_community ON sensitive_data_audit_log(target_community_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON sensitive_data_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON sensitive_data_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_denied ON sensitive_data_audit_log(access_granted) WHERE access_granted = FALSE;

-- Prevent updates and deletes on audit log (application-level enforcement)
-- Note: True immutability requires database-level permissions

-- ============================================
-- SUBSCRIBER TERMS AND CONDITIONS LOG
-- ============================================

-- Track all terms acceptances for compliance
CREATE TABLE IF NOT EXISTS terms_acceptance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  terms_type VARCHAR(50) NOT NULL, -- 'service', 'privacy', 'age_compliance', 'plan_subscriber'
  terms_version VARCHAR(20) NOT NULL,
  terms_text_hash VARCHAR(64), -- SHA-256 of the terms text
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- For age compliance specifically
  age_attestation_text TEXT, -- The exact text they agreed to
  min_age_requirement INTEGER DEFAULT 13
);

CREATE INDEX IF NOT EXISTS idx_terms_user ON terms_acceptance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_type ON terms_acceptance_log(terms_type);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to check if pool has capacity for new users
CREATE OR REPLACE FUNCTION check_pool_capacity(pool_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  pool_plan_type VARCHAR(50);
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  -- Get pool's plan type
  SELECT plan_type INTO pool_plan_type FROM shared_token_pools WHERE id = pool_uuid;

  -- Get max users for this plan type
  SELECT max_users INTO max_allowed FROM plan_type_limits WHERE plan_type = pool_plan_type;

  -- Count current active members
  SELECT COUNT(*) INTO current_count
  FROM plan_memberships
  WHERE pool_id = pool_uuid AND status IN ('active', 'pending');

  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct tokens from pool
CREATE OR REPLACE FUNCTION deduct_pool_tokens(
  pool_uuid UUID,
  user_uuid UUID,
  tokens INTEGER,
  usage_type_param VARCHAR(50) DEFAULT 'chat',
  conversation_uuid UUID DEFAULT NULL,
  message_uuid UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_bal INTEGER;
BEGIN
  -- Get current balance with lock
  SELECT current_balance INTO current_bal
  FROM shared_token_pools
  WHERE id = pool_uuid
  FOR UPDATE;

  -- Check if sufficient balance
  IF current_bal < tokens THEN
    RETURN FALSE;
  END IF;

  -- Deduct from pool
  UPDATE shared_token_pools
  SET current_balance = current_balance - tokens,
      tokens_used_this_period = tokens_used_this_period + tokens,
      updated_at = NOW()
  WHERE id = pool_uuid;

  -- Update membership usage
  UPDATE plan_memberships
  SET tokens_used_this_period = tokens_used_this_period + tokens,
      last_active_at = NOW(),
      updated_at = NOW()
  WHERE pool_id = pool_uuid AND user_id = user_uuid;

  -- Log usage
  INSERT INTO token_usage_log (pool_id, user_id, tokens_used, usage_type, conversation_id, message_id)
  VALUES (pool_uuid, user_uuid, tokens, usage_type_param, conversation_uuid, message_uuid);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to add purchased tokens to pool
CREATE OR REPLACE FUNCTION add_purchased_tokens(
  pool_uuid UUID,
  purchaser_uuid UUID,
  tokens INTEGER,
  amount_cents INTEGER,
  payment_id UUID DEFAULT NULL,
  stripe_intent VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  purchase_id UUID;
BEGIN
  -- Add to pool balance
  UPDATE shared_token_pools
  SET current_balance = current_balance + tokens,
      additional_tokens_purchased = additional_tokens_purchased + tokens,
      updated_at = NOW()
  WHERE id = pool_uuid;

  -- Record purchase
  INSERT INTO token_purchases (pool_id, purchased_by, tokens_purchased, amount_paid_cents, payment_method_id, stripe_payment_intent_id)
  VALUES (pool_uuid, purchaser_uuid, tokens, amount_cents, payment_id, stripe_intent)
  RETURNING id INTO purchase_id;

  RETURN purchase_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset pool tokens at period start
CREATE OR REPLACE FUNCTION reset_pool_period(pool_uuid UUID)
RETURNS VOID AS $$
DECLARE
  allocation INTEGER;
BEGIN
  -- Get monthly allocation
  SELECT monthly_allocation INTO allocation FROM shared_token_pools WHERE id = pool_uuid;

  -- Reset pool
  UPDATE shared_token_pools
  SET current_balance = allocation,
      tokens_used_this_period = 0,
      additional_tokens_purchased = 0,
      period_start = DATE_TRUNC('month', NOW()),
      period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
      updated_at = NOW()
  WHERE id = pool_uuid;

  -- Reset member usage counters
  UPDATE plan_memberships
  SET tokens_used_this_period = 0,
      updated_at = NOW()
  WHERE pool_id = pool_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent invitation if pool is at capacity
CREATE OR REPLACE FUNCTION check_invitation_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_pool_capacity(NEW.pool_id) THEN
    RAISE EXCEPTION 'Pool has reached maximum user capacity';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invitation_capacity ON plan_invitations;
CREATE TRIGGER trg_check_invitation_capacity
  BEFORE INSERT ON plan_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION check_invitation_capacity();

-- Trigger to enforce age verification before activation
CREATE OR REPLACE FUNCTION enforce_age_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for associated users (not primary)
  IF NEW.role = 'associated' AND NEW.status = 'active' AND NOT NEW.age_verified THEN
    RAISE EXCEPTION 'Age verification required before activating associated account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_age_verification ON plan_memberships;
CREATE TRIGGER trg_enforce_age_verification
  BEFORE UPDATE ON plan_memberships
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND OLD.status != 'active')
  EXECUTE FUNCTION enforce_age_verification();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active plan members with pool info
CREATE OR REPLACE VIEW v_active_plan_members AS
SELECT
  pm.id as membership_id,
  pm.pool_id,
  pm.user_id,
  pm.role,
  pm.status,
  pm.age_verified,
  pm.terms_accepted,
  pm.tokens_used_this_period as member_tokens_used,
  pm.last_active_at,
  stp.plan_type,
  stp.current_balance as pool_balance,
  stp.tokens_used_this_period as pool_tokens_used,
  stp.monthly_allocation,
  stp.primary_user_id,
  u.email,
  u.display_name,
  u.created_at as user_created_at
FROM plan_memberships pm
JOIN shared_token_pools stp ON pm.pool_id = stp.id
JOIN users u ON pm.user_id = u.id
WHERE pm.status = 'active' AND stp.is_active = TRUE;

-- View: Pool summary with member counts
CREATE OR REPLACE VIEW v_pool_summary AS
SELECT
  stp.id as pool_id,
  stp.primary_user_id,
  stp.plan_type,
  stp.monthly_allocation,
  stp.current_balance,
  stp.tokens_used_this_period,
  stp.additional_tokens_purchased,
  stp.period_start,
  stp.period_end,
  ptl.max_users,
  COUNT(pm.id) FILTER (WHERE pm.status = 'active') as active_members,
  COUNT(pm.id) FILTER (WHERE pm.status = 'pending') as pending_members,
  COUNT(pm.id) as total_members,
  u.email as primary_email,
  u.display_name as primary_name
FROM shared_token_pools stp
JOIN plan_type_limits ptl ON stp.plan_type = ptl.plan_type
JOIN users u ON stp.primary_user_id = u.id
LEFT JOIN plan_memberships pm ON stp.id = pm.pool_id
WHERE stp.is_active = TRUE
GROUP BY stp.id, ptl.max_users, u.email, u.display_name;

-- View: Pending invitations
CREATE OR REPLACE VIEW v_pending_invitations AS
SELECT
  pi.id as invitation_id,
  pi.pool_id,
  pi.email,
  pi.invitation_token,
  pi.invited_by,
  pi.inviter_age_attestation,
  pi.personal_message,
  pi.expires_at,
  pi.created_at,
  stp.plan_type,
  u.display_name as inviter_name,
  u.email as inviter_email
FROM plan_invitations pi
JOIN shared_token_pools stp ON pi.pool_id = stp.id
JOIN users u ON pi.invited_by = u.id
WHERE pi.status = 'pending' AND pi.expires_at > NOW();

-- ============================================
-- INITIAL DATA FOR EXISTING USERS
-- ============================================

-- Create token pools for existing subscribers who don't have one
-- This is a one-time migration step
DO $$
DECLARE
  user_rec RECORD;
  new_pool_id UUID;
  plan_allocation INTEGER;
BEGIN
  -- Find users with subscriptions but no pool
  FOR user_rec IN
    SELECT u.id, u.subscription_tier, u.email
    FROM users u
    LEFT JOIN shared_token_pools stp ON u.id = stp.primary_user_id
    WHERE u.subscription_tier IS NOT NULL
      AND u.subscription_tier != 'free'
      AND stp.id IS NULL
  LOOP
    -- Determine allocation based on tier
    SELECT monthly_token_limit INTO plan_allocation
    FROM plan_type_limits
    WHERE plan_type = COALESCE(user_rec.subscription_tier, 'standard');

    IF plan_allocation IS NULL THEN
      plan_allocation := 50000; -- Default
    END IF;

    -- Create pool
    INSERT INTO shared_token_pools (primary_user_id, plan_type, monthly_allocation, current_balance)
    VALUES (user_rec.id, COALESCE(user_rec.subscription_tier, 'standard'), plan_allocation, plan_allocation)
    RETURNING id INTO new_pool_id;

    -- Create primary membership
    INSERT INTO plan_memberships (pool_id, user_id, role, status, age_verified, terms_accepted)
    VALUES (new_pool_id, user_rec.id, 'primary', 'active', TRUE, TRUE);

    -- Update user
    UPDATE users
    SET is_plan_primary = TRUE,
        primary_pool_id = new_pool_id,
        plan_type = COALESCE(user_rec.subscription_tier, 'standard')
    WHERE id = user_rec.id;

    RAISE NOTICE 'Created pool % for user %', new_pool_id, user_rec.email;
  END LOOP;
END $$;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE shared_token_pools IS 'Manages shared token allocation for multi-user plans. Primary subscriber owns the pool.';
COMMENT ON TABLE plan_memberships IS 'Links users to token pools with role and verification status. Enforces age verification for associated users.';
COMMENT ON TABLE plan_invitations IS 'Tracks invitations to join a plan. Requires age attestation from inviter.';
COMMENT ON TABLE sensitive_data_audit_log IS 'Immutable audit log for access to sensitive user data. Used for compliance and accountability.';
COMMENT ON TABLE terms_acceptance_log IS 'Records all terms and conditions acceptances for legal compliance.';
COMMENT ON FUNCTION deduct_pool_tokens IS 'Atomically deducts tokens from pool and logs usage per user.';
COMMENT ON FUNCTION check_pool_capacity IS 'Checks if pool can accept additional members based on plan limits.';
