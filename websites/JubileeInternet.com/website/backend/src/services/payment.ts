import Stripe from 'stripe';
import { nanoid } from 'nanoid';
import { getDatabase } from '../db/database.js';
import { getConfig } from '../config/index.js';
import { getDomainById, activateDomain } from './domain-registry.js';
import type { JubileeDomain, DomainRegistration } from '../types/index.js';

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripe !== null) {
    return stripe;
  }

  const config = getConfig();
  if (config.STRIPE_SECRET_KEY === undefined) {
    return null;
  }

  stripe = new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  return stripe;
}

export interface CreatePaymentInput {
  domainId: string;
  userId: string;
  years: number;
  amount: number; // cents
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  sessionId?: string;
  error?: string;
}

export async function createDomainPayment(input: CreatePaymentInput): Promise<PaymentResult> {
  const stripeClient = getStripe();
  const config = getConfig();
  const db = getDatabase();

  const domain = await getDomainById(input.domainId);
  if (domain === null) {
    return { success: false, error: 'Domain not found' };
  }

  // Create registration record
  const registrationId = nanoid();
  await db`
    INSERT INTO domain_registrations (
      id, domain_id, user_id, amount, currency, years, registration_type, status
    )
    VALUES (
      ${registrationId}, ${input.domainId}, ${input.userId},
      ${input.amount}, 'USD', ${input.years}, 'new', 'pending'
    )
  `;

  // If Stripe is not configured, simulate free registration (dev mode)
  if (stripeClient === null) {
    console.log('[DEV MODE] Simulating free domain registration');

    // Mark payment as completed
    await db`
      UPDATE domain_registrations
      SET status = 'completed', completed_at = NOW(), transaction_id = ${'dev-' + nanoid()}
      WHERE id = ${registrationId}
    `;

    // Activate domain
    await activateDomain(input.domainId, input.years);

    return {
      success: true,
      paymentUrl: `${config.FRONTEND_URL}/domains/success?domain=${domain.fullDomain}`,
    };
  }

  // Create Stripe checkout session
  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Domain Registration: ${domain.fullDomain}`,
              description: `${input.years} year${input.years > 1 ? 's' : ''} registration for ${domain.fullDomain} on Inspire Web Spaces`,
            },
            unit_amount: input.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl,
      metadata: {
        registrationId,
        domainId: input.domainId,
        userId: input.userId,
        years: input.years.toString(),
      },
    });

    // Update registration with session ID
    await db`
      UPDATE domain_registrations
      SET transaction_id = ${session.id}
      WHERE id = ${registrationId}
    `;

    return {
      success: true,
      paymentUrl: session.url ?? undefined,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Stripe session creation failed:', error);

    // Mark registration as failed
    await db`
      UPDATE domain_registrations
      SET status = 'failed'
      WHERE id = ${registrationId}
    `;

    return {
      success: false,
      error: 'Payment session creation failed',
    };
  }
}

export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  const stripeClient = getStripe();
  const config = getConfig();
  const db = getDatabase();

  if (stripeClient === null || config.STRIPE_WEBHOOK_SECRET === undefined) {
    return { success: false, error: 'Stripe not configured' };
  }

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      config.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return { success: false, error: 'Invalid signature' };
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const registrationId = session.metadata?.['registrationId'];
    const domainId = session.metadata?.['domainId'];
    const years = parseInt(session.metadata?.['years'] ?? '1', 10);

    if (registrationId === undefined || domainId === undefined) {
      console.error('Missing metadata in webhook');
      return { success: false, error: 'Missing metadata' };
    }

    // Mark registration as completed
    await db`
      UPDATE domain_registrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${registrationId}
    `;

    // Activate domain
    await activateDomain(domainId, years);

    console.log(`Domain ${domainId} activated after payment`);
  }

  return { success: true };
}

export async function createRenewalPayment(
  domainId: string,
  userId: string,
  years: number,
  successUrl: string,
  cancelUrl: string
): Promise<PaymentResult> {
  const db = getDatabase();
  const domain = await getDomainById(domainId);

  if (domain === null) {
    return { success: false, error: 'Domain not found' };
  }

  if (domain.ownerId !== userId) {
    return { success: false, error: 'Not authorized' };
  }

  // Get TLD price
  const [tld] = await db<{ pricePerYear: number }[]>`
    SELECT price_per_year as "pricePerYear"
    FROM jubilee_tlds
    WHERE id = ${domain.tldId}
  `;

  const amount = (tld?.pricePerYear ?? 300) * years;

  return createDomainPayment({
    domainId,
    userId,
    years,
    amount,
    successUrl,
    cancelUrl,
  });
}

export async function getRegistrationHistory(domainId: string): Promise<DomainRegistration[]> {
  const db = getDatabase();

  return db<DomainRegistration[]>`
    SELECT
      id, domain_id as "domainId", user_id as "userId", transaction_id as "transactionId",
      amount, currency, years, registration_type as "registrationType", status,
      created_at as "createdAt", completed_at as "completedAt"
    FROM domain_registrations
    WHERE domain_id = ${domainId}
    ORDER BY created_at DESC
  `;
}
