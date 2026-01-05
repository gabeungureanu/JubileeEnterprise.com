/**
 * Billing API Routes
 * Handles payment methods, billing information, and payment status checks
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware');
const User = require('../models/User');
const database = require('../database');
const logger = require('../utils/logger');

/**
 * GET /api/billing/stripe-config
 * Get Stripe publishable key for client-side initialization
 */
router.get('/stripe-config', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return res.status(503).json({
      success: false,
      error: 'Stripe not configured'
    });
  }

  res.json({
    success: true,
    publishableKey
  });
});

/**
 * POST /api/billing/create-subscription
 * Create a new subscription with Stripe
 */
router.post('/create-subscription', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { paymentMethodId, planId, billing } = req.body;

    // In production, this would:
    // 1. Create or get Stripe customer
    // 2. Attach payment method
    // 3. Create subscription
    // 4. Handle 3D Secure if required
    // 5. Update user's subscription in database

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      // Demo mode - simulate successful subscription
      logger.info('Demo mode: Simulating subscription creation', { userId, planId, billing });

      // Update user's plan in database (for demo)
      const db = database.getPool();
      const planResult = await db.query(
        'SELECT id FROM subscription_plans WHERE slug = $1',
        [planId]
      );

      if (planResult.rows.length > 0) {
        await db.query(
          'UPDATE user_subscriptions SET plan_id = $1, billing_period = $2, updated_at = NOW() WHERE user_id = $3',
          [planResult.rows[0].id, billing === 'yearly' ? 'yearly' : 'monthly', userId]
        );
      }

      return res.json({
        success: true,
        subscriptionId: 'demo_sub_' + Date.now(),
        message: 'Subscription created (demo mode)'
      });
    }

    // Production Stripe integration would go here
    const stripe = require('stripe')(stripeSecretKey);

    // Get or create customer
    const user = await User.findById(userId);
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name || user.email,
        metadata: { userId }
      });
      customerId = customer.id;

      // Save customer ID to user
      const db = database.getPool();
      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId }
    });

    // Get price ID based on plan and billing cycle
    const priceIds = {
      standard: { monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY, yearly: process.env.STRIPE_PRICE_STANDARD_YEARLY },
      ministry: { monthly: process.env.STRIPE_PRICE_MINISTRY_MONTHLY, yearly: process.env.STRIPE_PRICE_MINISTRY_YEARLY },
      business: { monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY, yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY }
    };

    const priceId = priceIds[planId]?.[billing];

    if (!priceId) {
      return res.status(400).json({ success: false, error: 'Invalid plan or billing cycle' });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });

    // Check if 3D Secure is required
    const paymentIntent = subscription.latest_invoice.payment_intent;

    if (paymentIntent.status === 'requires_action') {
      return res.json({
        success: true,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id
      });
    }

    // Update user's subscription in database
    const db = database.getPool();
    const planResult = await db.query('SELECT id FROM subscription_plans WHERE slug = $1', [planId]);

    if (planResult.rows.length > 0) {
      await db.query(
        `UPDATE user_subscriptions
         SET plan_id = $1, billing_period = $2, stripe_subscription_id = $3, status = 'active', updated_at = NOW()
         WHERE user_id = $4`,
        [planResult.rows[0].id, billing === 'yearly' ? 'yearly' : 'monthly', subscription.id, userId]
      );
    }

    res.json({
      success: true,
      subscriptionId: subscription.id
    });

  } catch (error) {
    logger.error('Error creating subscription', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subscription'
    });
  }
});

/**
 * GET /api/billing/check-payment-status
 * Check if the user has a payment failure that needs attention
 * Used by the payment failure popup component
 */
router.get('/check-payment-status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const result = await User.checkPaymentFailure(userId);

    res.json({
      success: true,
      hasFailure: result.hasFailure,
      showNotification: result.showNotification,
      planName: result.planName,
      gracePeriodEndsAt: result.gracePeriodEndsAt,
      daysRemaining: result.daysRemaining,
      billingPeriod: result.billingPeriod
    });
  } catch (error) {
    logger.error('Error checking payment status', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
});

/**
 * POST /api/billing/dismiss-payment-notification
 * Dismiss the payment failure notification for today
 */
router.post('/dismiss-payment-notification', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await User.dismissPaymentNotification(userId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error dismissing payment notification', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss notification'
    });
  }
});

/**
 * POST /api/billing/record-payment-notification-shown
 * Record that the payment failure notification was shown
 */
router.post('/record-payment-notification-shown', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await User.recordPaymentNotificationShown(userId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error recording payment notification shown', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to record notification'
    });
  }
});

/**
 * GET /api/billing/payment-methods
 * Get all payment methods for the current user
 */
router.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const paymentMethods = await User.getPaymentMethods(userId);

    res.json({
      success: true,
      paymentMethods
    });
  } catch (error) {
    logger.error('Error getting payment methods', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get payment methods'
    });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add a new payment method
 * In production, this would integrate with Stripe
 */
router.post('/payment-methods', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const paymentData = req.body;

    // Validate required fields
    if (!paymentData.cardLastFour || !paymentData.cardExpMonth || !paymentData.cardExpYear) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment method fields'
      });
    }

    const paymentMethod = await User.addPaymentMethod(userId, paymentData);

    res.json({
      success: true,
      paymentMethod
    });
  } catch (error) {
    logger.error('Error adding payment method', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to add payment method'
    });
  }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const paymentMethodId = req.params.id;

    const success = await User.removePaymentMethod(userId, paymentMethodId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing payment method', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment method'
    });
  }
});

/**
 * PUT /api/billing/payment-methods/:id/default
 * Set a payment method as default
 */
router.put('/payment-methods/:id/default', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const paymentMethodId = req.params.id;

    const success = await User.setDefaultPaymentMethod(userId, paymentMethodId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error setting default payment method', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to set default payment method'
    });
  }
});

/**
 * GET /api/billing/billing-information
 * Get billing information for the current user
 */
router.get('/billing-information', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const billingInfo = await User.getBillingInformation(userId);

    res.json({
      success: true,
      billingInfo
    });
  } catch (error) {
    logger.error('Error getting billing information', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get billing information'
    });
  }
});

/**
 * PUT /api/billing/billing-information
 * Update billing information
 */
router.put('/billing-information', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const billingData = req.body;

    const billingInfo = await User.updateBillingInformation(userId, billingData);

    res.json({
      success: true,
      billingInfo
    });
  } catch (error) {
    logger.error('Error updating billing information', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to update billing information'
    });
  }
});

/**
 * GET /api/billing/tax-ids
 * Get tax IDs for the current user
 */
router.get('/tax-ids', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const taxIds = await User.getTaxIds(userId);

    res.json({
      success: true,
      taxIds
    });
  } catch (error) {
    logger.error('Error getting tax IDs', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get tax IDs'
    });
  }
});

/**
 * POST /api/billing/tax-ids
 * Add a new tax ID
 */
router.post('/tax-ids', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { taxIdType, taxIdValue } = req.body;

    if (!taxIdType || !taxIdValue) {
      return res.status(400).json({
        success: false,
        error: 'Tax ID type and value are required'
      });
    }

    const taxId = await User.addTaxId(userId, taxIdType, taxIdValue);

    res.json({
      success: true,
      taxId
    });
  } catch (error) {
    logger.error('Error adding tax ID', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to add tax ID'
    });
  }
});

/**
 * DELETE /api/billing/tax-ids/:id
 * Remove a tax ID
 */
router.delete('/tax-ids/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const taxIdId = req.params.id;

    const success = await User.removeTaxId(userId, taxIdId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Tax ID not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing tax ID', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to remove tax ID'
    });
  }
});

/**
 * GET /api/billing/invoices
 * Get invoice history for the current user
 */
router.get('/invoices', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const invoices = await User.getInvoices(userId, limit, offset);

    res.json({
      success: true,
      invoices,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error getting invoices', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get invoices'
    });
  }
});

/**
 * GET /api/billing/subscription-status
 * Get full subscription status with billing information
 */
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const status = await User.getSubscriptionWithBillingStatus(userId);

    res.json({
      success: true,
      subscription: status
    });
  } catch (error) {
    logger.error('Error getting subscription status', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

// ============================================
// Admin Testing Endpoints (JQA - JubileeVerse Quality Assurance)
// These endpoints allow admins to simulate billing scenarios for testing
// ============================================

/**
 * GET /api/billing/admin/panel
 * Returns the admin testing panel HTML if user is admin
 * This ensures the HTML is never sent to non-admin users
 */
router.get('/admin/panel', requireAdmin, async (req, res) => {
  res.json({
    success: true,
    isAdmin: true,
    html: `
      <div id="jqa-admin-panel" style="
        position: fixed;
        top: 0;
        right: 0;
        background: #1a1a1a;
        color: #fff;
        padding: 8px 16px;
        font-size: 12px;
        font-family: 'Open Sans', sans-serif;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom-left-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      ">
        <span style="color: #fbbf24; font-weight: 600;">JQA:</span>
        <a href="#" onclick="JQAAdmin.simulatePaymentFailed(); return false;" style="color: #ef4444; text-decoration: none;">Payment Failed</a>
        <span style="color: #666;">|</span>
        <a href="#" onclick="JQAAdmin.cancelSubscription(); return false;" style="color: #9ca3af; text-decoration: none;">Cancel Subscription</a>
        <span style="color: #666;">|</span>
        <span style="color: #9ca3af;">Activate Plans:</span>
        <a href="#" onclick="JQAAdmin.activatePlan('free'); return false;" style="color: #10b981; text-decoration: none;">Free</a>
        <span style="color: #666;">|</span>
        <a href="#" onclick="JQAAdmin.activatePlan('standard'); return false;" style="color: #3b82f6; text-decoration: none;">Standard</a>
        <span style="color: #666;">|</span>
        <a href="#" onclick="JQAAdmin.activatePlan('ministry'); return false;" style="color: #8b5cf6; text-decoration: none;">Ministry</a>
        <span style="color: #666;">|</span>
        <a href="#" onclick="JQAAdmin.activatePlan('business'); return false;" style="color: #f59e0b; text-decoration: none;">Business</a>
        <span style="color: #666;">|</span>
      </div>
    `
  });
});

/**
 * POST /api/billing/admin/simulate-payment-failed
 * Simulate a payment failure for the current admin user
 */
router.post('/admin/simulate-payment-failed', requireAdmin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const db = database.getPostgres();

    // Get user's current subscription
    const subResult = await db.query(
      `SELECT us.id, sp.name as plan_name
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No subscription found for this user'
      });
    }

    const subscription = subResult.rows[0];

    // Update subscription status to failed
    await db.query(
      `UPDATE user_subscriptions
       SET status = 'past_due',
           payment_failed_at = NOW(),
           payment_failure_count = COALESCE(payment_failure_count, 0) + 1,
           grace_period_ends_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [subscription.id]
    );

    // Create a payment failure notification
    await db.query(
      `INSERT INTO payment_failure_notifications (
        id, user_id, subscription_id, failure_reason, failure_code,
        failure_message, grace_period_ends_at, is_active
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'card_declined', 'insufficient_funds',
        'Your card was declined due to insufficient funds.', NOW() + INTERVAL '7 days', TRUE
      )
      ON CONFLICT (user_id) WHERE is_active = TRUE
      DO UPDATE SET
        failure_reason = EXCLUDED.failure_reason,
        failure_code = EXCLUDED.failure_code,
        failure_message = EXCLUDED.failure_message,
        grace_period_ends_at = EXCLUDED.grace_period_ends_at,
        notification_dismissed_at = NULL,
        updated_at = NOW()`,
      [userId, subscription.id]
    );

    // Clear the localStorage flag so popup shows again
    logger.info('Admin simulated payment failure', { userId, subscriptionId: subscription.id });

    res.json({
      success: true,
      message: `Payment failure simulated for ${subscription.plan_name}. Refresh the page to see the notification.`
    });
  } catch (error) {
    logger.error('Error simulating payment failure', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to simulate payment failure: ' + error.message
    });
  }
});

/**
 * POST /api/billing/admin/cancel-subscription
 * Cancel the current admin user's subscription
 */
router.post('/admin/cancel-subscription', requireAdmin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const db = database.getPostgres();

    // Update subscription to cancelled
    await db.query(
      `UPDATE user_subscriptions
       SET status = 'cancelled',
           cancelled_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    // Resolve any active payment failure notifications
    await db.query(
      `UPDATE payment_failure_notifications
       SET is_active = FALSE,
           resolved_at = NOW(),
           resolution_type = 'subscription_cancelled'
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    logger.info('Admin cancelled subscription', { userId });

    res.json({
      success: true,
      message: 'Subscription cancelled. Refresh the page to see the changes.'
    });
  } catch (error) {
    logger.error('Error cancelling subscription', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription: ' + error.message
    });
  }
});

/**
 * POST /api/billing/admin/activate-plan
 * Activate a specific plan for the current admin user
 */
router.post('/admin/activate-plan', requireAdmin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { planSlug } = req.body;
    const db = database.getPostgres();

    if (!planSlug) {
      return res.status(400).json({
        success: false,
        error: 'Plan slug is required'
      });
    }

    // Get the plan ID
    const planResult = await db.query(
      `SELECT id, name FROM subscription_plans WHERE slug = $1`,
      [planSlug]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Plan "${planSlug}" not found`
      });
    }

    const plan = planResult.rows[0];

    // Update or insert subscription
    await db.query(
      `INSERT INTO user_subscriptions (
        id, user_id, plan_id, status, billing_period,
        current_period_start, current_period_end
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'active', 'monthly',
        NOW(), NOW() + INTERVAL '1 month'
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'active',
        billing_period = 'monthly',
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '1 month',
        cancelled_at = NULL,
        payment_failed_at = NULL,
        payment_failure_count = 0,
        grace_period_ends_at = NULL`,
      [userId, plan.id]
    );

    // Resolve any active payment failure notifications
    await db.query(
      `UPDATE payment_failure_notifications
       SET is_active = FALSE,
           resolved_at = NOW(),
           resolution_type = 'payment_succeeded'
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    logger.info('Admin activated plan', { userId, planSlug, planName: plan.name });

    res.json({
      success: true,
      message: `Activated ${plan.name}. Refresh the page to see the changes.`
    });
  } catch (error) {
    logger.error('Error activating plan', { error: error.message, userId: req.session.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to activate plan: ' + error.message
    });
  }
});

module.exports = router;
