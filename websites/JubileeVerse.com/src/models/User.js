/**
 * User Model
 * Handles all user-related database operations
 */

const database = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Convert database row to user object (snake_case to camelCase)
 */
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    preferredLanguage: row.preferred_language,
    defaultPersonaId: row.default_persona_id,
    emailVerified: row.email_verified,
    emailVerifiedAt: row.email_verified_at,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Analytics fields
    userType: row.user_type,
    subscriptionTier: row.subscription_tier,
    analyticsConsent: row.analytics_consent,
    analyticsConsentAt: row.analytics_consent_at,
    // Declared denomination (user self-identified)
    declaredDenomination: row.declared_denomination,
    declaredDenominationAt: row.declared_denomination_at,
    // Extended declared demographics (user self-reported - NEVER inferred)
    declaredSex: row.declared_sex,
    declaredSexAt: row.declared_sex_at,
    declaredPrimaryLanguage: row.declared_primary_language,
    declaredSecondaryLanguages: row.declared_secondary_languages || [],
    declaredLanguageInterests: row.declared_language_interests || [],
    declaredChurchBackground: row.declared_church_background,
    declaredChurchAttendance: row.declared_church_attendance,
    declaredYearsBeliever: row.declared_years_believer,
    declaredAgeRange: row.declared_age_range,
    declaredMaritalStatus: row.declared_marital_status,
    declaredParentStatus: row.declared_parent_status,
    demographicsUpdatedAt: row.demographics_updated_at
  };
}

/**
 * Find user by ID
 */
async function findById(userId) {
  const result = await database.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return rowToUser(result.rows[0]);
}

/**
 * Find user by email
 */
async function findByEmail(email) {
  const result = await database.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return rowToUser(result.rows[0]);
}

/**
 * Find user by verification token
 */
async function findByVerificationToken(token) {
  const result = await database.query(
    `SELECT u.* FROM users u
     JOIN email_verification_tokens evt ON u.id = evt.user_id
     WHERE evt.token = $1 AND evt.verified_at IS NULL AND evt.expires_at > NOW()`,
    [token]
  );
  return rowToUser(result.rows[0]);
}

/**
 * Find user by password reset token
 */
async function findByResetToken(token) {
  const result = await database.query(
    `SELECT u.*, prt.expires_at as reset_token_expires FROM users u
     JOIN password_reset_tokens prt ON u.id = prt.user_id
     WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
    [token]
  );
  if (!result.rows[0]) return null;
  const user = rowToUser(result.rows[0]);
  user.resetTokenExpires = result.rows[0].reset_token_expires;
  return user;
}

/**
 * Create new user
 */
async function create(userData) {
  const id = uuidv4();
  const result = await database.query(
    `INSERT INTO users (id, email, password_hash, display_name, preferred_language, role, is_active, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      userData.email.toLowerCase(),
      userData.passwordHash,
      userData.displayName,
      userData.preferredLanguage || 'en',
      userData.role || 'user',
      userData.isActive !== false,
      userData.emailVerified || false
    ]
  );

  // Create default user settings
  await database.query(
    `INSERT INTO user_settings (user_id, preferred_bible_version) VALUES ($1, 'NIV')`,
    [id]
  );

  return rowToUser(result.rows[0]);
}

/**
 * Update user
 */
async function update(userId, updates) {
  const fieldMap = {
    displayName: 'display_name',
    avatarUrl: 'avatar_url',
    preferredLanguage: 'preferred_language',
    defaultPersonaId: 'default_persona_id',
    emailVerified: 'email_verified',
    isActive: 'is_active',
    passwordHash: 'password_hash',
    // Analytics fields
    userType: 'user_type',
    subscriptionTier: 'subscription_tier',
    analyticsConsent: 'analytics_consent',
    analyticsConsentAt: 'analytics_consent_at',
    // Declared denomination
    declaredDenomination: 'declared_denomination',
    declaredDenominationAt: 'declared_denomination_at',
    // Extended declared demographics (user self-reported - NEVER inferred)
    declaredSex: 'declared_sex',
    declaredSexAt: 'declared_sex_at',
    declaredPrimaryLanguage: 'declared_primary_language',
    declaredSecondaryLanguages: 'declared_secondary_languages',
    declaredLanguageInterests: 'declared_language_interests',
    declaredChurchBackground: 'declared_church_background',
    declaredChurchAttendance: 'declared_church_attendance',
    declaredYearsBeliever: 'declared_years_believer',
    declaredAgeRange: 'declared_age_range',
    declaredMaritalStatus: 'declared_marital_status',
    declaredParentStatus: 'declared_parent_status',
    demographicsUpdatedAt: 'demographics_updated_at'
  };

  const dbUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key] || key;
    dbUpdates[dbField] = value;
  }

  const fields = Object.keys(dbUpdates);
  const values = Object.values(dbUpdates);

  if (fields.length === 0) return findById(userId);

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const result = await database.query(
    `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, ...values]
  );
  return rowToUser(result.rows[0]);
}

/**
 * Set verification token for user
 */
async function setVerificationToken(userId, token) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await database.query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

/**
 * Set password reset token
 */
async function setResetToken(userId, token, expiresAt) {
  await database.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(userId) {
  await database.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId]
  );
}

/**
 * Increment failed login attempts (placeholder - can add to user_settings or separate table)
 */
async function incrementFailedAttempts(userId) {
  // Could track this in user_settings or a separate login_attempts table
  // For now, just log it
}

/**
 * Reset failed login attempts
 */
async function resetFailedAttempts(userId) {
  // Reset counter
}

/**
 * Update user preferences
 */
async function updatePreferences(userId, preferences) {
  const result = await database.query(
    `UPDATE user_settings SET preferences = preferences || $2, updated_at = NOW()
     WHERE user_id = $1 RETURNING *`,
    [userId, JSON.stringify(preferences)]
  );
  return result.rows[0];
}

/**
 * Get user preferences
 */
async function getPreferences(userId) {
  const result = await database.query(
    `SELECT * FROM user_settings WHERE user_id = $1`,
    [userId]
  );

  if (!result.rows[0]) {
    return {
      theme: 'system',
      preferredBibleVersion: 'NIV',
      notificationsEnabled: true,
      emailNotifications: true
    };
  }

  return {
    theme: result.rows[0].theme,
    preferredBibleVersion: result.rows[0].preferred_bible_version,
    notificationsEnabled: result.rows[0].notifications_enabled,
    emailNotifications: result.rows[0].email_notifications,
    ...result.rows[0].preferences
  };
}

/**
 * Delete user (soft delete)
 */
async function softDelete(userId) {
  await database.query(
    `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  return true;
}

/**
 * Get user's subscription plan
 */
async function getSubscription(userId) {
  try {
    const result = await database.query(
      `SELECT us.*, sp.name as plan_name, sp.slug as plan_slug, sp.tier_level as plan_tier,
              sp.features as plan_features, sp.daily_word_limit, sp.monthly_word_limit
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 AND us.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      planSlug: row.plan_slug,
      planTier: row.plan_tier,
      planFeatures: row.plan_features,
      dailyWordLimit: row.daily_word_limit,
      monthlyWordLimit: row.monthly_word_limit,
      status: row.status,
      billingPeriod: row.billing_period,
      startedAt: row.started_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end
    };
  } catch (error) {
    // If subscription tables don't exist yet, return default free plan
    return {
      planName: 'Free',
      planSlug: 'free',
      planTier: 0,
      planFeatures: {},
      status: 'active'
    };
  }
}

/**
 * Record AI usage for a user
 */
async function recordUsage(userId, wordsSent, wordsReceived) {
  const today = new Date().toISOString().split('T')[0];

  try {
    await database.query(
      `INSERT INTO ai_usage_daily (user_id, usage_date, words_sent, words_received, request_count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET
         words_sent = ai_usage_daily.words_sent + $3,
         words_received = ai_usage_daily.words_received + $4,
         request_count = ai_usage_daily.request_count + 1,
         updated_at = NOW()`,
      [userId, today, wordsSent, wordsReceived]
    );
    return true;
  } catch (error) {
    // Usage tracking is optional - don't fail if tables don't exist
    return false;
  }
}

/**
 * Get user's usage stats
 */
async function getUsageStats(userId) {
  try {
    const result = await database.query(
      `SELECT lifetime_words_sent, lifetime_words_received, lifetime_request_count
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      lifetimeWordsSent: row.lifetime_words_sent || 0,
      lifetimeWordsReceived: row.lifetime_words_received || 0,
      lifetimeRequestCount: row.lifetime_request_count || 0
    };
  } catch (error) {
    return {
      lifetimeWordsSent: 0,
      lifetimeWordsReceived: 0,
      lifetimeRequestCount: 0
    };
  }
}

// ============================================
// Billing and Payment Methods
// ============================================

/**
 * Check if user has an active payment failure that needs attention
 * Only returns failure if not dismissed today
 */
async function checkPaymentFailure(userId) {
  try {
    const result = await database.query(
      `SELECT
        pfn.id as failure_id,
        pfn.grace_period_ends_at,
        pfn.failure_reason,
        pfn.notification_dismissed_at,
        GREATEST(0, EXTRACT(DAY FROM pfn.grace_period_ends_at - NOW())::INT) as days_remaining,
        sp.name as plan_name,
        us.billing_period
       FROM payment_failure_notifications pfn
       JOIN user_subscriptions us ON us.id = pfn.subscription_id
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE pfn.user_id = $1
       AND pfn.is_active = TRUE
       AND pfn.resolved_at IS NULL
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { hasFailure: false };
    }

    const row = result.rows[0];

    // Check if notification was dismissed today
    const dismissedAt = row.notification_dismissed_at;
    const today = new Date().toISOString().split('T')[0];
    const dismissedToday = dismissedAt &&
      new Date(dismissedAt).toISOString().split('T')[0] === today;

    return {
      hasFailure: true,
      showNotification: !dismissedToday,
      failureId: row.failure_id,
      gracePeriodEndsAt: row.grace_period_ends_at,
      daysRemaining: row.days_remaining,
      planName: row.plan_name,
      billingPeriod: row.billing_period,
      failureReason: row.failure_reason
    };
  } catch (error) {
    // If tables don't exist, return no failure
    return { hasFailure: false };
  }
}

/**
 * Dismiss payment failure notification for today
 */
async function dismissPaymentNotification(userId) {
  try {
    await database.query(
      `UPDATE payment_failure_notifications
       SET notification_dismissed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
       AND is_active = TRUE`,
      [userId]
    );

    await database.query(
      `UPDATE users
       SET payment_notification_dismissed_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Record that payment notification was shown
 */
async function recordPaymentNotificationShown(userId) {
  try {
    await database.query(
      `UPDATE payment_failure_notifications
       SET notification_shown_at = NOW(),
           notification_count = notification_count + 1,
           updated_at = NOW()
       WHERE user_id = $1
       AND is_active = TRUE`,
      [userId]
    );

    await database.query(
      `UPDATE users
       SET last_payment_check_date = CURRENT_DATE
       WHERE id = $1`,
      [userId]
    );

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's payment methods
 */
async function getPaymentMethods(userId) {
  try {
    const result = await database.query(
      `SELECT id, card_brand, card_last_four, card_exp_month, card_exp_year,
              cardholder_name, is_default, created_at
       FROM payment_methods
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      cardBrand: row.card_brand,
      cardLastFour: row.card_last_four,
      cardExpMonth: row.card_exp_month,
      cardExpYear: row.card_exp_year,
      cardholderName: row.cardholder_name,
      isDefault: row.is_default,
      createdAt: row.created_at
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Add a payment method
 */
async function addPaymentMethod(userId, paymentData) {
  const id = uuidv4();

  try {
    // If this is the first payment method or is_default is true, unset other defaults
    if (paymentData.isDefault) {
      await database.query(
        `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`,
        [userId]
      );
    }

    const result = await database.query(
      `INSERT INTO payment_methods (
        id, user_id, stripe_payment_method_id, stripe_customer_id,
        card_brand, card_last_four, card_exp_month, card_exp_year,
        cardholder_name, billing_address_line1, billing_address_line2,
        billing_city, billing_state, billing_postal_code, billing_country,
        is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id,
        userId,
        paymentData.stripePaymentMethodId,
        paymentData.stripeCustomerId,
        paymentData.cardBrand,
        paymentData.cardLastFour,
        paymentData.cardExpMonth,
        paymentData.cardExpYear,
        paymentData.cardholderName,
        paymentData.billingAddressLine1,
        paymentData.billingAddressLine2,
        paymentData.billingCity,
        paymentData.billingState,
        paymentData.billingPostalCode,
        paymentData.billingCountry,
        paymentData.isDefault || false
      ]
    );

    return {
      id: result.rows[0].id,
      cardBrand: result.rows[0].card_brand,
      cardLastFour: result.rows[0].card_last_four
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Remove a payment method
 */
async function removePaymentMethod(userId, paymentMethodId) {
  try {
    await database.query(
      `UPDATE payment_methods
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [paymentMethodId, userId]
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Set a payment method as default
 */
async function setDefaultPaymentMethod(userId, paymentMethodId) {
  try {
    // Unset all other defaults
    await database.query(
      `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`,
      [userId]
    );

    // Set the new default
    await database.query(
      `UPDATE payment_methods
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [paymentMethodId, userId]
    );

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get billing information for a user
 */
async function getBillingInformation(userId) {
  try {
    const result = await database.query(
      `SELECT * FROM billing_information WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      billingName: row.billing_name,
      billingEmail: row.billing_email,
      billingPhone: row.billing_phone,
      phoneCountryCode: row.phone_country_code,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country
    };
  } catch (error) {
    return null;
  }
}

/**
 * Update billing information
 */
async function updateBillingInformation(userId, billingData) {
  try {
    const result = await database.query(
      `INSERT INTO billing_information (
        user_id, billing_name, billing_email, billing_phone, phone_country_code,
        address_line1, address_line2, city, state, postal_code, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET
        billing_name = EXCLUDED.billing_name,
        billing_email = EXCLUDED.billing_email,
        billing_phone = EXCLUDED.billing_phone,
        phone_country_code = EXCLUDED.phone_country_code,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        billingData.billingName,
        billingData.billingEmail,
        billingData.billingPhone,
        billingData.phoneCountryCode,
        billingData.addressLine1,
        billingData.addressLine2,
        billingData.city,
        billingData.state,
        billingData.postalCode,
        billingData.country
      ]
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get tax IDs for a user
 */
async function getTaxIds(userId) {
  try {
    const result = await database.query(
      `SELECT id, tax_id_type, tax_id_value, verification_status
       FROM billing_tax_ids
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      taxIdType: row.tax_id_type,
      taxIdValue: row.tax_id_value,
      verificationStatus: row.verification_status
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Add a tax ID
 */
async function addTaxId(userId, taxIdType, taxIdValue) {
  const id = uuidv4();

  try {
    const result = await database.query(
      `INSERT INTO billing_tax_ids (id, user_id, tax_id_type, tax_id_value)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, taxIdType, taxIdValue]
    );

    return {
      id: result.rows[0].id,
      taxIdType: result.rows[0].tax_id_type,
      taxIdValue: result.rows[0].tax_id_value
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Remove a tax ID
 */
async function removeTaxId(userId, taxIdId) {
  try {
    await database.query(
      `DELETE FROM billing_tax_ids WHERE id = $1 AND user_id = $2`,
      [taxIdId, userId]
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get invoices for a user
 */
async function getInvoices(userId, limit = 10, offset = 0) {
  try {
    const result = await database.query(
      `SELECT id, invoice_number, invoice_date, total_cents, status,
              card_brand, card_last_four, description, period_start, period_end,
              invoice_pdf_url, paid_at
       FROM invoices
       WHERE user_id = $1
       ORDER BY invoice_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      totalCents: row.total_cents,
      total: (row.total_cents / 100).toFixed(2),
      status: row.status,
      cardBrand: row.card_brand,
      cardLastFour: row.card_last_four,
      description: row.description,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      invoicePdfUrl: row.invoice_pdf_url,
      paidAt: row.paid_at
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Get subscription with full billing status
 */
async function getSubscriptionWithBillingStatus(userId) {
  try {
    const result = await database.query(
      `SELECT
        us.id as subscription_id,
        us.status as subscription_status,
        us.billing_period,
        us.current_period_start,
        us.current_period_end,
        us.next_billing_date,
        us.payment_failed_at,
        us.payment_failure_count,
        us.grace_period_ends_at,
        sp.id as plan_id,
        sp.name as plan_name,
        sp.slug as plan_slug,
        sp.tier_level,
        sp.price_monthly_cents,
        sp.price_yearly_cents,
        sp.features as plan_features,
        pm.id as payment_method_id,
        pm.card_brand,
        pm.card_last_four,
        pm.card_exp_month,
        pm.card_exp_year,
        pfn.id as active_failure_id,
        pfn.grace_period_ends_at as failure_grace_ends,
        CASE WHEN pfn.is_active = TRUE THEN TRUE ELSE FALSE END as has_payment_failure
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       LEFT JOIN payment_methods pm ON pm.id = us.payment_method_id
       LEFT JOIN payment_failure_notifications pfn ON pfn.subscription_id = us.id AND pfn.is_active = TRUE
       WHERE us.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      subscriptionId: row.subscription_id,
      subscriptionStatus: row.subscription_status,
      billingPeriod: row.billing_period,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      nextBillingDate: row.next_billing_date,
      paymentFailedAt: row.payment_failed_at,
      paymentFailureCount: row.payment_failure_count,
      gracePeriodEndsAt: row.grace_period_ends_at,
      planId: row.plan_id,
      planName: row.plan_name,
      planSlug: row.plan_slug,
      tierLevel: row.tier_level,
      priceMonthly: row.price_monthly_cents ? (row.price_monthly_cents / 100).toFixed(2) : '0.00',
      priceYearly: row.price_yearly_cents ? (row.price_yearly_cents / 100).toFixed(2) : '0.00',
      planFeatures: row.plan_features,
      paymentMethodId: row.payment_method_id,
      cardBrand: row.card_brand,
      cardLastFour: row.card_last_four,
      cardExpMonth: row.card_exp_month,
      cardExpYear: row.card_exp_year,
      hasPaymentFailure: row.has_payment_failure
    };
  } catch (error) {
    return null;
  }
}

/**
 * Update user's default persona
 * @param {string} userId - User UUID
 * @param {string} personaId - Persona UUID (or null to clear)
 */
async function setDefaultPersona(userId, personaId) {
  const result = await database.query(
    `UPDATE users SET default_persona_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, personaId]
  );
  return rowToUser(result.rows[0]);
}

/**
 * Get user's default persona with full persona details
 * @param {string} userId - User UUID
 * @returns {Object|null} Persona details or null if not set
 */
async function getDefaultPersona(userId) {
  const result = await database.query(
    `SELECT p.id, p.slug, p.name, p.avatar_url, p.short_bio
     FROM users u
     JOIN personas p ON u.default_persona_id = p.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    avatarUrl: row.avatar_url,
    description: row.short_bio
  };
}

// ============================================
// Declared Demographics (User Self-Reported)
// These fields are NEVER inferred from conversation content
// ============================================

/**
 * Update declared demographics for a user
 * Automatically sets timestamps for fields that are changed
 * @param {string} userId - User UUID
 * @param {Object} demographics - Demographics data to update
 */
async function updateDeclaredDemographics(userId, demographics) {
  const updates = {
    demographicsUpdatedAt: new Date()
  };

  // Map fields and auto-set timestamps for changed values
  if (demographics.sex !== undefined) {
    updates.declaredSex = demographics.sex;
    updates.declaredSexAt = new Date();
  }
  if (demographics.primaryLanguage !== undefined) {
    updates.declaredPrimaryLanguage = demographics.primaryLanguage;
  }
  if (demographics.secondaryLanguages !== undefined) {
    updates.declaredSecondaryLanguages = demographics.secondaryLanguages;
  }
  if (demographics.languageInterests !== undefined) {
    updates.declaredLanguageInterests = demographics.languageInterests;
  }
  if (demographics.churchBackground !== undefined) {
    updates.declaredChurchBackground = demographics.churchBackground;
  }
  if (demographics.churchAttendance !== undefined) {
    updates.declaredChurchAttendance = demographics.churchAttendance;
  }
  if (demographics.yearsBeliever !== undefined) {
    updates.declaredYearsBeliever = demographics.yearsBeliever;
  }
  if (demographics.ageRange !== undefined) {
    updates.declaredAgeRange = demographics.ageRange;
  }
  if (demographics.maritalStatus !== undefined) {
    updates.declaredMaritalStatus = demographics.maritalStatus;
  }
  if (demographics.parentStatus !== undefined) {
    updates.declaredParentStatus = demographics.parentStatus;
  }
  if (demographics.denomination !== undefined) {
    updates.declaredDenomination = demographics.denomination;
    updates.declaredDenominationAt = new Date();
  }

  return update(userId, updates);
}

/**
 * Get declared demographics for a user
 * @param {string} userId - User UUID
 * @returns {Object} Declared demographics data
 */
async function getDeclaredDemographics(userId) {
  const result = await database.query(
    `SELECT
      declared_sex,
      declared_sex_at,
      declared_primary_language,
      declared_secondary_languages,
      declared_language_interests,
      declared_church_background,
      declared_church_attendance,
      declared_years_believer,
      declared_age_range,
      declared_marital_status,
      declared_parent_status,
      declared_denomination,
      declared_denomination_at,
      demographics_updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    sex: row.declared_sex,
    sexDeclaredAt: row.declared_sex_at,
    primaryLanguage: row.declared_primary_language,
    secondaryLanguages: row.declared_secondary_languages || [],
    languageInterests: row.declared_language_interests || [],
    churchBackground: row.declared_church_background,
    churchAttendance: row.declared_church_attendance,
    yearsBeliever: row.declared_years_believer,
    ageRange: row.declared_age_range,
    maritalStatus: row.declared_marital_status,
    parentStatus: row.declared_parent_status,
    denomination: row.declared_denomination,
    denominationDeclaredAt: row.declared_denomination_at,
    updatedAt: row.demographics_updated_at
  };
}

/**
 * Update analytics consent for a user
 * Also purges existing analytics data if consent is revoked
 * @param {string} userId - User UUID
 * @param {boolean} consent - Whether user consents to analytics
 */
async function updateAnalyticsConsent(userId, consent) {
  const updates = {
    analyticsConsent: consent,
    analyticsConsentAt: consent ? new Date() : null
  };

  // If revoking consent, the aggregation job will handle purging data
  // We just update the consent flag here
  return update(userId, updates);
}

/**
 * Get analytics consent status for a user
 * @param {string} userId - User UUID
 * @returns {Object} Analytics consent data
 */
async function getAnalyticsConsent(userId) {
  const result = await database.query(
    `SELECT analytics_consent, analytics_consent_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    consent: row.analytics_consent === true,
    consentedAt: row.analytics_consent_at
  };
}

module.exports = {
  findById,
  findByEmail,
  findByVerificationToken,
  findByResetToken,
  create,
  update,
  setVerificationToken,
  setResetToken,
  updateLastLogin,
  incrementFailedAttempts,
  resetFailedAttempts,
  updatePreferences,
  getPreferences,
  softDelete,
  getSubscription,
  recordUsage,
  getUsageStats,
  // Default Persona
  setDefaultPersona,
  getDefaultPersona,
  // Declared Demographics (user self-reported - NEVER inferred)
  updateDeclaredDemographics,
  getDeclaredDemographics,
  // Analytics consent
  updateAnalyticsConsent,
  getAnalyticsConsent,
  // Billing and Payment Methods
  checkPaymentFailure,
  dismissPaymentNotification,
  recordPaymentNotificationShown,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  getBillingInformation,
  updateBillingInformation,
  getTaxIds,
  addTaxId,
  removeTaxId,
  getInvoices,
  getSubscriptionWithBillingStatus
};
